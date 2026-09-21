const test = require('node:test');
const assert = require('node:assert/strict');
const { calculator:c } = require('../api/_bazi-runtime');
function chart(text) {
  const parts=text.split(' ');
  return c.buildFromPillars(Object.fromEntries(['year','month','day','hour'].map((p,i)=>[p,{gan:parts[i][0],zhi:parts[i][1]}])),'male');
}

test('十天干均识别同五行异干根，根事件仍沿用冲合后的有效力量', () => {
  const examples={甲:'卯',乙:'寅',丙:'午',丁:'巳',戊:'丑',己:'辰',庚:'酉',辛:'申',壬:'子',癸:'亥'};
  for(const [gan,zhi] of Object.entries(examples)) {
    const g='甲乙丙丁戊己庚辛壬癸'.indexOf(gan),z='子丑寅卯辰巳午未申酉戌亥'.indexOf(zhi);
    const b=chart(`${gan}${g%2?'丑':'子'} ${z%2?'己':'戊'}${zhi} 戊戌 壬子`);
    const evidence=c.buildEvidenceSettlement(b),stem=evidence.stemAt('year');
    const opposite=evidence.roots.find(r=>r.position==='month'&&r.element===c.WU_XING[gan]&&r.gan!==gan);
    assert.ok(opposite,gan+' 的异干根应存在');
    assert.ok(stem.rootIds.includes(opposite.id),gan+' 不可漏算异干根');
    const linked=evidence.roots.filter(r=>stem.rootIds.includes(r.id));
    assert.ok(linked.every(r=>r.element===stem.element),'不得混入异五行根');
    assert.equal(stem.rootPower,Number(linked.reduce((sum,r)=>sum+r.effectivePower,0).toFixed(3)));
    assert.equal(new Set(stem.rootIds).size,stem.rootIds.length);
  }
});

test('阴干十二长生位置无同五行藏根时，不获得杀印承载补偿', () => {
  for(const [text,score] of [['甲子 丁卯 己未 癸酉',27],['庚申 己丑 癸卯 丁巳',26]]) {
    const result=c.auditDayMasterStrength(chart(text));
    assert.equal(result.scoreTrace.find(s=>s.id==='sha-seal-mediation').delta,0);
    assert.equal(result.result.score,score);
    assert.equal(50+result.scoreTrace.reduce((sum,s)=>sum+s.delta,0),result.result.rawScore);
  }
  const positive=c.auditDayMasterStrength(chart('己酉 丁丑 癸卯 庚子'));
  assert.ok(positive.scoreTrace.find(s=>s.id==='sha-seal-mediation').delta>0,'真有子水禄根的对照仍有制化补偿');
});

test('已经润局的弱金不因缺少完整申酉根被强制判成火炎土燥', () => {
  for(const text of ['壬子 丁未 辛丑 戊子','丙申 己未 辛亥 壬戌']) {
    const b=chart(text),climate=c.getClimateState(b),result=c.getYongJi(b);
    assert.equal(climate.moistureStatus,'润局已到位');
    assert.equal(climate.needsCooling,false);
    assert.ok(result.candidateScores.length>0,'应进入正式候选比较');
    assert.doesNotMatch(result.reasoning,/火炎土燥|一水三用|六月辛金/);
    assert.ok(!result.tiaoHouYongShen.includes('水'),'已有足量润局不再登记补水调候任务');
  }
});

test('缺乏有效水源的燥土弱金仍保留润燥需求，不把庚金写成辛金', () => {
  for(const text of ['甲申 甲戌 辛未 丙午','戊戌 己未 庚戌 戊寅']) {
    const b=chart(text),result=c.getYongJi(b);
    assert.notEqual(c.getClimateState(b).moistureStatus,'润局已到位');
    assert.equal(result.yongShen[0],'水');
    assert.match(result.reasoning,new RegExp('^'+b.day.gan+'金'));
    assert.doesNotMatch(result.reasoning,/水制七杀（伤官制杀）|一水三用/);
  }
});
