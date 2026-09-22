const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const elements = {}, genders = {};
  function select() {
    return {
      options: [], selectedIndex: -1, disabled: false,
      get value() { return String(this.options[this.selectedIndex]?.value ?? ''); },
      set value(v) { this.selectedIndex = this.options.findIndex(o => String(o.value) === String(v)); },
      get selectedOptions() { return this.selectedIndex < 0 ? [] : [this.options[this.selectedIndex]]; },
      set innerHTML(v) { this.options = [{ value: '', getAttribute() { return null; } }]; this.selectedIndex = 0; },
      appendChild(o) { this.options.push(o); },
    };
  }
  function choices(values) { const s = select(); s.innerHTML = ''; values.forEach(value => s.appendChild({value, getAttribute(){return null;}})); return s; }
  for (const pid of ['p1','p2']) {
    for (const prefix of ['s','l']) {
      elements[prefix+'Year-'+pid] = choices(['1992','1995','2017']);
      elements[prefix+'Month-'+pid] = choices(Array.from({length:12},(_,i)=>i+1));
      elements[prefix+'Day-'+pid] = select();
      elements[prefix+'Minute-'+pid] = {value:''};
      const h = select(); h.innerHTML = '';
      for (const clock of [23,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22]) {
        h.appendChild({value:clock===23?0:Math.floor((clock+1)/2),getAttribute(){return String(clock);}});
      }
      elements[prefix+'Hour-'+pid] = h;
    }
    elements['name-'+pid] = {value:pid};
    for(const id of ['zishiHuanri','solarEnabled']) elements[id+'-'+pid] = {checked:false};
    for(const id of ['province','city','district']) elements[id+'-'+pid] = choices(['测试省','测试市','测试区']);
    elements['lunarPreview-'+pid] = {classList:{remove(){}}};
    genders[pid] = [{value:'male',checked:false},{value:'female',checked:false}];
  }
  const document = {
    getElementById(id){return elements[id];},
    querySelectorAll(selector){return genders[selector.includes('p1')?'p1':'p2'];},
    querySelector(selector){return this.querySelectorAll(selector).find(g=>g.checked);},
    createElement(){return {value:'',textContent:'',getAttribute(){return null;}};},
  };
  const context = {document,modeP1:'solar',modeP2:'solar',REGION_DATA:{测试省:{测试市:['测试区']}},showToast(){},showLunarPreview(){}};
  context.window=context;vm.createContext(context);
  const root=path.join(__dirname,'..');
  vm.runInContext(fs.readFileSync(path.join(root,'js/lunar.js'),'utf8'),context);
  const html=fs.readFileSync(path.join(root,'hepan.html'),'utf8');
  vm.runInContext(html.slice(html.indexOf('function updateSolarDays('),html.indexOf('function showSolarLunarHint(')),context);
  vm.runInContext(html.slice(html.indexOf('function swapPersons('),html.indexOf('function switchModeForPersonUI(')),context);
  context.switchModeForPersonUI=()=>{};
  return {context,elements,genders};
}

test('swapping people preserves exact clocks with duplicate branch values and rebuilds dates',()=>{
  const {context:c,elements:e}=fixture();
  c.applyPersonData('p1',{name:'测试甲',sYear:'1992',sMonth:'1',sDay:'31',sHour:'0',sClock:'0',sMinute:'45',gender:'female'});
  c.applyPersonData('p2',{name:'测试乙',sYear:'1995',sMonth:'2',sDay:'28',sHour:'6',sClock:'12',gender:'male'});
  c.swapPersons();
  assert.equal(c.selectedPersonClock('sHour-p1'),'12');
  assert.equal(c.selectedPersonClock('sHour-p2'),'0');
  assert.equal(e['sDay-p2'].value,'31');
  assert.equal(e['sMinute-p2'].value,'45');
  c.swapPersons();
  assert.equal(c.selectedPersonClock('sHour-p1'),'0');
  assert.equal(e['sDay-p1'].value,'31');
});

test('filling an incomplete person clears previous gender and location rather than mixing identities',()=>{
  const {context:c,elements:e,genders:g}=fixture();
  c.applyPersonData('p1',{gender:'male',prov:'测试省',city:'测试市',dist:'测试区'});
  c.applyPersonData('p1',{name:'未填写'});
  assert.ok(g.p1.every(r=>!r.checked));
  for(const id of ['province','city','district'])assert.equal(e[id+'-p1'].value,'');
  assert.equal(e['city-p1'].disabled,true);
});

test('lunar transfer rebuilds the selected leap month and retains late Zi hour',()=>{
  const {context:c,elements:e}=fixture();
  c.applyPersonData('p1',{lYear:'2017',lMonth:'r6',lDay:'15',lHour:'0',lClock:'23',lMinute:'10'});
  const data=c.collectPersonData('p1');c.applyPersonData('p2',data);
  assert.equal(e['lMonth-p2'].value,'r6');
  assert.equal(e['lDay-p2'].value,'15');
  assert.equal(c.selectedPersonClock('lHour-p2'),'23');
});
