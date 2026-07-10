const fs=require('fs');
let c=fs.readFileSync('js/bazi.js','utf-8');

// Fix 1: Function signature - add yongJi parameter
c=c.replace(
  'function analyzeWealth(bazi, gender) {',
  'function analyzeWealth(bazi, gender, yongJi) {'
);

// Fix 2: Direction logic — use 喜用忌
let oldDir=`    // --- 财富方位与城市 ---
    const wxDirection = { '金':'西','木':'东','水':'北','火':'南','土':'中' };
    const wxDirMap = {
        '金': { dir:'西方', d:'西', cities: ['成都','重庆','西安','昆明','贵阳','兰州','银川','西宁','拉萨','乌鲁木齐'] },
        '木': { dir:'东方', d:'东', cities: ['上海','苏州','杭州','南京','宁波','无锡','合肥','福州','厦门','济南'] },
        '水': { dir:'北方', d:'北', cities: ['北京','天津','沈阳','大连','哈尔滨','长春','石家庄','太原','呼和浩特','青岛'] },
        '火': { dir:'南方', d:'南', cities: ['深圳','广州','东莞','佛山','珠海','海口','三亚','南宁','长沙','武汉'] },
        '土': { dir:'中原', d:'中', cities: ['郑州','洛阳','开封','武汉','长沙','南昌','合肥','西安','石家庄','太原'] }
    };
    // 不利方位：克财星的五行方位
    const wxKe = { '木':'金','火':'水','土':'木','金':'火','水':'土' };
    const killerWX = wxKe[caiWX];
    const badDirInfo = wxDirMap[killerWX] || wxDirMap['金'];
    const goodDirInfo = wxDirMap[caiWX] || wxDirMap['土'];`;

let newDir=`    // --- 财富方位与城市（基于喜用忌而非死磕财星） ---
    const wxDirMap = {
        '金': { dir:'西方', d:'西', cities: ['成都','重庆','西安','昆明','贵阳','兰州','银川','西宁','拉萨','乌鲁木齐'] },
        '木': { dir:'东方', d:'东', cities: ['上海','苏州','杭州','南京','宁波','无锡','合肥','福州','厦门','济南'] },
        '水': { dir:'北方', d:'北', cities: ['北京','天津','沈阳','大连','哈尔滨','长春','石家庄','太原','呼和浩特','青岛'] },
        '火': { dir:'南方', d:'南', cities: ['深圳','广州','东莞','佛山','珠海','海口','三亚','南宁','长沙','武汉'] },
        '土': { dir:'中原', d:'中', cities: ['郑州','洛阳','开封','武汉','长沙','南昌','合肥','西安','石家庄','太原'] }
    };
    // 旺财方位：用喜神五行（身强宜克泄耗方向，身弱宜生扶方向）
    var goodWX = caiWX;  // 默认财星方向
    var badWX = (function(){var m={'木':'金','火':'水','土':'木','金':'火','水':'土'};return m[caiWX]||'金';})(); // 默认克财星方向
    if (yongJi && yongJi.xiShen && yongJi.xiShen.length > 0) {
        goodWX = yongJi.xiShen[0];  // 首选喜神五行方向
    }
    if (yongJi && yongJi.jiShen && yongJi.jiShen.length > 0) {
        badWX = yongJi.jiShen[0];   // 首选忌神五行方向
    }
    const goodDirInfo = wxDirMap[goodWX] || wxDirMap['土'];
    const badDirInfo = wxDirMap[badWX] || wxDirMap['金'];`;

if(!c.includes(oldDir)){console.log('oldDir NOT FOUND');process.exit(1);}
c=c.replace(oldDir,newDir);

// Fix 3: wealth summary - mention 喜用 direction
c=c.replace(
  "summaryParts.push(goodDirInfo.dir + '方位是财库方向')",
  "summaryParts.push(goodDirInfo.dir + '（' + goodWX + '·喜神方位）是你更适合发展的方向')"
);

fs.writeFileSync('js/bazi.js',c,'utf-8');
console.log('✅ bazi.js analyzeWealth 已修复');

// Now fix result.js — pass yongJi
let r=fs.readFileSync('js/result.js','utf-8');
r=r.replace(
  "var wl = window.BaZiCalculator.analyzeWealth(bazi, gender);",
  "var yongJi = window.BaZiCalculator.getYongJi(bazi);\n    var wl = window.BaZiCalculator.analyzeWealth(bazi, gender, yongJi);"
);
fs.writeFileSync('js/result.js',r,'utf-8');
console.log('✅ result.js renderWealth 已传喜用忌');

fs.unlinkSync(__filename);
