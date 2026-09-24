const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let PGlite;
try { ({PGlite}=require('@electric-sql/pglite')); } catch (_) { /* Optional isolated PostgreSQL test runtime. */ }

test('PostgreSQL payment transaction: replay, rollback, account ownership and permissions',
  {skip:!PGlite&&'Install @electric-sql/pglite in a test-only directory and set NODE_PATH'},async()=>{
  const db=new PGlite();
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
    await db.exec(fs.readFileSync(path.join(__dirname,'../schema.sql'),'utf8'));
    const migration=fs.readFileSync(path.join(__dirname,'../schema-payment-channels.sql'),'utf8');
    await db.exec(migration);await db.exec(migration);
    const guestMigration=fs.readFileSync(path.join(__dirname,'../schema-guest-purchases.sql'),'utf8');
    await db.exec(guestMigration);await db.exec(guestMigration);
    await db.exec("INSERT INTO users(id,email,password) VALUES(123,'fixture@example.test','not-a-real-password')");
    await db.exec("INSERT INTO users(id,email,password) VALUES(456,'other@example.test','not-a-real-password')");
    let sequence=0;
    async function make(kind='credits',extra={}){
      const id='wx_'+(++sequence).toString(16).padStart(24,'0');
      const row={order_id:id,provider:'xunhu',payment_method:'wechat',provider_appid:'fixture',user_id:123,
        kind,amount_cents:990,title:'Fixture',return_path:'/pricing?paid='+id,
        ...(kind==='credits'?{credits:10,redemption_code:'CODE'+sequence}:kind==='monthly'?{days:30,redemption_code:'CODE'+sequence}:
          {report_type:'bazi',report_key:'key'+sequence,report_params:{year:2000},label:'Fixture report'}),...extra};
      const keys=Object.keys(row);await db.query('INSERT INTO payment_orders('+keys.join(',')+') VALUES('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(row));return id;
    }
    const fulfill=(id,tx='tx_'+id,app='fixture',amount=990)=>db.query('SELECT fulfill_wechat_payment($1,$2,$3,$4)',[id,app,amount,tx]);
    const claim=async(id,user=123)=>(await db.query('SELECT claim_wechat_purchase($1,$2) AS status',[id,user])).rows[0].status;
    for (const kind of ['credits','monthly','report','hepan']) {
      for (const before of [true,false]) {
        const id=await make(kind==='hepan'?'report':kind,{user_id:null,...(kind==='hepan'?{report_type:'hepan'}:{})});
        if(before) assert.equal(await claim(id),'pending');
        await fulfill(id);
        // Used credits and an already-started membership must survive binding unchanged.
        if(kind==='credits')await db.query('UPDATE user_credits SET credits=7,total_used=3 WHERE order_id=$1',[id]);
        const table=kind==='credits'?'user_credits':kind==='monthly'?'user_subscriptions':kind==='report'?'report_orders':'payment_orders';
        const snapshot=(await db.query('SELECT * FROM '+table+' WHERE order_id=$1',[id])).rows[0];
        assert.equal(await claim(id),'paid');assert.equal(await claim(id),'paid');
        assert.equal(await claim(id,456),'unavailable');
        await fulfill(id);
        const saved=(await db.query('SELECT * FROM '+table+' WHERE order_id=$1',[id])).rows[0];
        assert.equal(Number(saved.user_id),123);
        assert.deepEqual({...saved,user_id:null},{...snapshot,user_id:null});
      }
    }
    const conflicted=await make('credits',{user_id:null});await fulfill(conflicted);
    await db.query('UPDATE user_credits SET user_id=456 WHERE order_id=$1',[conflicted]);
    await assert.rejects(claim(conflicted),/binding failed/);
    assert.equal((await db.query('SELECT user_id FROM payment_orders WHERE order_id=$1',[conflicted])).rows[0].user_id,null);
    const missing=await make('report',{user_id:null});await fulfill(missing);
    await db.query('DELETE FROM report_orders WHERE order_id=$1',[missing]);
    await assert.rejects(claim(missing),/binding failed/);
    assert.equal((await db.query('SELECT user_id FROM payment_orders WHERE order_id=$1',[missing])).rows[0].user_id,null);
    assert.equal(await claim('wx_'+'f'.repeat(24)),'unavailable');
    for(const kind of ['credits','monthly','report']){
      const id=await make(kind);await Promise.all([fulfill(id),fulfill(id),fulfill(id)]);
      const table=kind==='credits'?'user_credits':kind==='monthly'?'user_subscriptions':'report_orders';
      const rows=(await db.query('SELECT * FROM '+table+' WHERE order_id=$1',[id])).rows;
      assert.equal(rows.length,1);assert.equal(Number(rows[0].user_id),123);
      if(kind==='credits')assert.equal(rows[0].credits,10);
      if(kind==='monthly')assert.equal((new Date(rows[0].expires_at)-new Date(rows[0].starts_at))/86400000,30);
      if(kind==='report'){assert.equal(rows[0].status,'paid');assert.equal(rows[0].amount,'9.90');}
      await assert.rejects(fulfill(id,'different_tx'),/Transaction mismatch/);
    }
    const victim=await make();await assert.rejects(fulfill(victim,'tx_wrong','other',990),/verification/);
    await assert.rejects(fulfill(victim,'tx_wrong','fixture',1),/verification/);
    assert.equal((await db.query('SELECT status FROM payment_orders WHERE order_id=$1',[victim])).rows[0].status,'pending');
    const first=await make(),second=await make();await fulfill(first,'shared_tx');
    await assert.rejects(fulfill(second,'shared_tx'),/unique/);
    assert.equal((await db.query('SELECT * FROM user_credits WHERE order_id=$1',[second])).rows.length,0);
    assert.equal((await db.query('SELECT status FROM payment_orders WHERE order_id=$1',[second])).rows[0].status,'pending');
    const collision=await make('credits',{redemption_code:'CODE1'});
    await assert.rejects(fulfill(collision),/unique/);
    assert.equal((await db.query('SELECT status FROM payment_orders WHERE order_id=$1',[collision])).rows[0].status,'pending');
    const guest=await make('credits',{user_id:null});await fulfill(guest);
    assert.equal((await db.query('SELECT user_id FROM user_credits WHERE order_id=$1',[guest])).rows[0].user_id,null);
    const hepan=await make('report',{report_type:'hepan'});await fulfill(hepan);await fulfill(hepan);
    assert.equal((await db.query('SELECT status FROM payment_orders WHERE order_id=$1',[hepan])).rows[0].status,'paid');
    assert.equal((await db.query('SELECT * FROM report_orders WHERE order_id=$1',[hepan])).rows.length,0);
    await assert.rejects(make('credits',{credits:null}),/check constraint/);
    for(const role of ['anon','authenticated']){
      await db.exec('SET ROLE '+role);
      await assert.rejects(db.query('SELECT * FROM payment_orders'),/permission denied/);
      await assert.rejects(fulfill(victim),/permission denied/);
      await assert.rejects(claim(victim),/permission denied/);
      await db.exec('RESET ROLE');
    }
    await db.exec('SET ROLE service_role');await fulfill(victim);await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT status FROM payment_orders WHERE order_id=$1',[victim])).rows[0].status,'paid');
  } finally {await db.close();}
});
