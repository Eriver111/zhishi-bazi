// 盲测盘合法性校验（2026-08-14）：五虎遁（年上起月）/ 五鼠遁（日上起时）。
// 月干idx = ((年干idx%5)*2 + 2 + (月支idx-2+12)%12) % 10
// 时干idx = ((日干idx%5)*2 + 时支idx) % 10
// 不合法盘退回，禁止进入盲测（GPT 收口裁决硬性要求）。
var GAN = '甲乙丙丁戊己庚辛壬癸';
var ZHI = '子丑寅卯辰巳午未申酉戌亥';
var DISKS = [
  ['S01', '壬申', '壬寅', '甲寅', '丁卯'],
  ['S02', '庚午', '甲申', '甲午', '癸酉'],
  ['S03', '甲辰', '庚午', '丙午', '癸巳'],
  ['S04', '壬子', '壬子', '丁酉', '辛亥'],
  ['S05', '丙戌', '甲午', '戊戌', '丁巳'],
  ['S06', '乙亥', '己卯', '己酉', '丙寅'],
  ['S07', '庚申', '乙酉', '庚申', '乙酉'],
  ['S08', '丁巳', '乙巳', '辛亥', '甲午'],
  ['BND01', '甲戌', '戊辰', '甲子', '壬申'],
  ['BND02', '辛未', '丁酉', '丁亥', '癸卯']
];

function ganIdx(g) { var i = GAN.indexOf(g); if (i < 0) throw new Error('非法天干: ' + g); return i; }
function zhiIdx(z) { var i = ZHI.indexOf(z); if (i < 0) throw new Error('非法地支: ' + z); return i; }
function yueGanExpected(yearGan, monthZhi) {
  return GAN[((ganIdx(yearGan) % 5) * 2 + 2 + ((zhiIdx(monthZhi) - 2 + 12) % 12)) % 10];
}
function shiGanExpected(dayGan, hourZhi) {
  return GAN[((ganIdx(dayGan) % 5) * 2 + zhiIdx(hourZhi)) % 10];
}

var bad = 0;
DISKS.forEach(function (d) {
  var id = d[0], y = d[1], m = d[2], day = d[3], h = d[4];
  var ey = yueGanExpected(y[0], m[1]);
  var es = shiGanExpected(day[0], h[1]);
  var okM = ey === m[0], okH = es === h[0];
  if (!okM || !okH) bad++;
  console.log((okM && okH ? '✅' : '❌') + ' ' + id + ' ' + y + ' ' + m + ' ' + day + ' ' + h +
    ' | 月干应' + ey + '实' + m[0] + (okM ? '✓' : '✗') +
    ' 时干应' + es + '实' + h[0] + (okH ? '✓' : '✗'));
});
console.log(bad === 0 ? '\n🎉 10/10 全部合法，可进入盲测' : '\n❌ ' + bad + ' 盘不合法，退回换盘');
process.exit(bad === 0 ? 0 : 1);
