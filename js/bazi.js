/**
 * 知时 — 四柱推算核心逻辑
 * 实现四柱（年柱、月柱、日柱、时柱）的推算
 */

// 天干
const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

// 地支
const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 五行
const WU_XING = {
    '甲': '木', '乙': '木',
    '丙': '火', '丁': '火',
    '戊': '土', '己': '土',
    '庚': '金', '辛': '金',
    '壬': '水', '癸': '水'
};

// 地支五行
const DI_ZHI_WU_XING = {
    '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火',
    '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水'
};

// 十神
const SHI_SHEN = {
    '比肩': ['甲甲', '乙乙', '丙丙', '丁丁', '戊戊', '己己', '庚庚', '辛辛', '壬壬', '癸癸'],
    '劫财': ['甲乙', '乙甲', '丙丁', '丁丙', '戊己', '己戊', '庚辛', '辛庚', '壬癸', '癸壬'],
    '食神': ['甲丙', '乙丁', '丙戊', '丁己', '戊庚', '己辛', '庚壬', '辛癸', '壬甲', '癸乙'],
    '伤官': ['甲丁', '乙丙', '丙己', '丁戊', '戊辛', '己庚', '庚癸', '辛壬', '壬乙', '癸甲'],
    '偏财': ['甲戊', '乙己', '丙庚', '丁辛', '戊壬', '己癸', '庚甲', '辛乙', '壬丙', '癸丁'],
    '正财': ['甲己', '乙戊', '丙辛', '丁庚', '戊癸', '己壬', '庚丙', '辛丁', '壬戊', '癸己'],
    '七杀': ['甲庚', '乙辛', '丙壬', '丁癸', '戊甲', '己乙', '庚丙', '辛丁', '壬戊', '癸己'],
    '正官': ['甲辛', '乙庚', '丙癸', '丁壬', '戊乙', '己甲', '庚丁', '辛丙', '壬己', '癸戊'],
    '偏印': ['甲壬', '乙癸', '丙甲', '丁乙', '戊丙', '己丁', '庚戊', '辛己', '壬庚', '癸辛'],
    '正印': ['甲癸', '乙壬', '丙乙', '丁甲', '戊丁', '己丙', '庚己', '辛戊', '壬辛', '癸庚']
};

// 纳音
const NA_YIN = [
    '海中金', '海中金', '炉中火', '炉中火', '大林木', '大林木', '路旁土', '路旁土', '剑锋金', '剑锋金',
    '山头火', '山头火', '涧下水', '涧下水', '城墙土', '城墙土', '白蜡金', '白蜡金', '杨柳木', '杨柳木',
    '泉中水', '泉中水', '屋上土', '屋上土', '霹雳火', '霹雳火', '松柏木', '松柏木', '长流水', '长流水',
    '砂中金', '砂中金', '山下火', '山下火', '平地木', '平地木', '壁上土', '壁上土', '金箔金', '金箔金',
    '覆灯火', '覆灯火', '天河水', '天河水', '大驿土', '大驿土', '钗钏金', '钗钏金', '桑柘木', '桑柘木',
    '大溪水', '大溪水', '沙中土', '沙中土', '天上火', '天上火', '石榴木', '石榴木', '大海水', '大海水'
];

// 立春近似时刻（北京时间，小数部分=分钟/60，用于年柱/月柱的精确切换）
// 数据来源：天文年历近似值
var LICHUN_HOUR = {
    1980:19.75,1981:5.75,1982:11.5,1983:17.25,1984:23.5,1985:5.25,1986:11,1987:17,1988:23,1989:4.5,
    1990:10.25,1991:16,1992:22,1993:3.5,1994:9.25,1995:15,1996:21,1997:3.5,1998:8.5,1999:14.5,
    2000:20.5,2001:2.25,2002:8,2003:14,2004:19.93,2005:1.25,2006:7,2007:13,2008:19,2009:0.5,
    2010:6.25,2011:12,2012:18,2013:0.25,2014:6,2015:11.75,2016:17.5,2017:23.25,2018:5,2019:11.25,
    2020:17,2021:23,2022:4.5,2023:10.5,2024:16.25,2025:22,2026:4,2027:10,2028:16,2029:21,2030:3
};

// 小寒近似时刻（北京时间小时数）— 子/丑月分界
// 1月5-6日左右，通常在下午到晚间；默认16时
var XIAOHAN_HOUR = {
    2009:19,2010:0,2011:6,2012:12,2013:18,2014:0,2015:6,2016:12,2017:18,2018:23,
    2019:5,2020:11,2021:17,2022:23,2023:4,2024:10,2025:16,2026:22,2027:4,2028:10,2029:15,2030:21
};

/**
 * 获取指定年份的12个「节」（月柱分界点）日期
 * 节不同于气，是月份的实际分界：
 * 寅月:立春  卯月:惊蛰  辰月:清明  巳月:立夏  午月:芒种  未月:小暑
 * 申月:立秋  酉月:白露  戌月:寒露  亥月:立冬  子月:大雪  丑月:小寒
 *
 * 基于寿星万年历算法简化实现，误差在±1天内
 * 参考: https://github.com/6tail/lunar
 */
function getJieQiDates(year) {
    // 12个节的基础参考日期（近似值，以2000年为基准）
    // 每年偏移约0.2422天，4年累计约1天
    const baseJieQi = [
        { name: '立春', month: 2, day: 4 },
        { name: '惊蛰', month: 3, day: 6 },
        { name: '清明', month: 4, day: 5 },
        { name: '立夏', month: 5, day: 6 },
        { name: '芒种', month: 6, day: 6 },
        { name: '小暑', month: 7, day: 7 },
        { name: '立秋', month: 8, day: 8 },
        { name: '白露', month: 9, day: 8 },
        { name: '寒露', month: 10, day: 8 },
        { name: '立冬', month: 11, day: 8 },
        { name: '大雪', month: 12, day: 7 },
        { name: '小寒', month: 1, day: 6 }
    ];

    // 精确节气日期表（2000-2030年常见年份，确保准确性）
    // 格式: year -> [立春,惊蛰,清明,立夏,芒种,小暑,立秋,白露,寒露,立冬,大雪,小寒] 的day
    const preciseData = {
        1980: [5, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6],
        1981: [4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6],
        1982: [4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6],
        1983: [4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6],
        1984: [4, 5, 4, 5, 6, 7, 7, 8, 8, 7, 7, 6],
        1985: [4, 6, 5, 5, 6, 7, 7, 8, 8, 7, 7, 5],
        1986: [4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6],
        1987: [4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6],
        1988: [5, 5, 5, 5, 6, 7, 7, 7, 8, 7, 7, 6],
        1989: [4, 5, 5, 5, 6, 7, 7, 8, 8, 7, 7, 5],
        1990: [4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6],
        1991: [4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6],
        1992: [4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 6],
        1993: [4, 5, 5, 5, 6, 7, 7, 7, 8, 7, 7, 5],
        1994: [4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7, 6],
        1995: [4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6],
        1996: [4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 6],
        1997: [4, 5, 5, 5, 5, 7, 7, 7, 8, 7, 7, 5],
        1998: [4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7, 6],
        1999: [4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6],
        2000: [4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 6],
        2001: [4, 5, 5, 5, 5, 7, 7, 7, 8, 7, 7, 5],
        2002: [4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7, 6],
        2003: [4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6],
        2004: [4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 6],
        2005: [4, 5, 5, 5, 5, 7, 7, 7, 8, 7, 7, 5],
        2006: [4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7, 6],
        2007: [4, 6, 5, 6, 6, 7, 8, 8, 9, 8, 7, 6],
        2008: [4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 6],
        2009: [4, 5, 5, 5, 5, 7, 7, 7, 8, 7, 7, 5],
        2010: [4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7, 6],
        2011: [4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6],
        2012: [4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 6],
        2013: [4, 5, 5, 5, 5, 7, 7, 7, 8, 7, 7, 5],
        2014: [4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7, 6],
        2015: [4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6],
        2016: [4, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 6],
        2017: [3, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5],
        2018: [4, 5, 5, 5, 6, 7, 7, 8, 8, 7, 7, 5],
        2019: [4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6],
        2020: [4, 5, 4, 5, 5, 6, 7, 7, 8, 7, 7, 6],
        2021: [3, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5],
        2022: [4, 5, 5, 5, 6, 7, 7, 7, 8, 7, 7, 5],
        2023: [4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6],
        2024: [4, 5, 4, 5, 5, 6, 7, 7, 8, 7, 7, 5],
        2025: [3, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5],
        2026: [4, 5, 5, 5, 6, 7, 7, 7, 8, 7, 7, 5],
        2027: [4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6],
        2028: [4, 5, 4, 5, 5, 6, 7, 7, 8, 7, 7, 5],
        2029: [3, 5, 4, 5, 5, 7, 7, 7, 8, 7, 7, 5],
        2030: [4, 5, 5, 5, 6, 7, 7, 7, 8, 7, 7, 5]
    };

    if (preciseData[year]) {
        var days = preciseData[year];
        return baseJieQi.map(function(bq, i) {
            var m = bq.month;
            var d = days[i];
            var targetYear = (m === 1) ? year + 1 : year;
            // 立春和小寒返回带钟点（用于精确到时的月柱切换）
            // 立春支持小数（19.5=19:30），小寒整数小时
            var hVal = (i === 0) ? (LICHUN_HOUR[year] || 12) :
                       (i === 11) ? (XIAOHAN_HOUR[year] || 16) : 0;
            var hHour = Math.floor(hVal);
            var hMin = Math.round((hVal - hHour) * 60);
            return { name: bq.name, date: new Date(targetYear, m - 1, d, hHour, hMin, 0) };
        });
    }

    // 无精确数据时，使用基准日期微调（闰年偏移）
    const leapOffset = Math.floor((year - 2000) / 4);
    const baseOffset = year >= 2000 ? leapOffset : -Math.floor((2000 - year) / 4);

    return baseJieQi.map((bq, i) => {
        let d = bq.day;
        // 闰年≈-1天偏移（2月29日使后续日期提前）
        if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) {
            if (bq.month >= 3) d -= 1;
        }
        // 世纪年微调
        if (year < 2000 && year % 4 !== 0) d += (baseOffset % 2);
        const targetYear = (bq.month === 1) ? year + 1 : year;
        return { name: bq.name, date: new Date(targetYear, bq.month - 1, d) };
    });
}

/**
 * 计算年柱
 * 立春前属于上一年
 */
function getYearPillar(year, month, day, hour) {
    // 获取该年立春的精确时刻
    var jq = getJieQiDates(year);
    var liChun = jq[0].date;
    var liChunMonth = liChun.getMonth() + 1;
    var liChunDay = liChun.getDate();
    var liChunHour = liChun.getHours() + liChun.getMinutes() / 60;

    // 如果在立春时刻之前，年柱属于上一年
    var actualYear = year;
    if (month < liChunMonth || 
        (month === liChunMonth && day < liChunDay) ||
        (month === liChunMonth && day === liChunDay && (hour || 0) * 1 < liChunHour)) {
        actualYear = year - 1;
    }
    
    // 年干支计算
    // 以1984年甲子年为基准
    const baseYear = 1984;
    const offset = actualYear - baseYear;
    const ganIndex = ((offset % 10) + 10) % 10;
    const zhiIndex = ((offset % 12) + 12) % 12;
    
    return {
        gan: TIAN_GAN[ganIndex],
        zhi: DI_ZHI[zhiIndex],
        ganIndex: ganIndex,
        zhiIndex: zhiIndex
    };
}

/**
 * 计算月柱
 * 根据节气确定月份
 */
function getMonthPillar(year, month, day, hour, clock) {
    // 根据节气精确确定月支
    // 获取该年的节气日期
    var jieQi = getJieQiDates(year);
    
    // 前一年的节气（用于获取1月的正确小寒日期）
    var prevYearJieQi = getJieQiDates(year - 1);
    var xiaoHan = prevYearJieQi[11].date; // 前一年的小寒，即本年度1月的小寒
    
    var liChun = jieQi[0].date;
    var realLiChunMonth = liChun.getMonth() + 1;
    var realLiChunDay = liChun.getDate();
    var liChunHour = liChun.getHours() + liChun.getMinutes() / 60;
    
    // 确定当前日期对应的月支索引
    // 月支顺序: 寅(2)卯(3)辰(4)巳(5)午(6)未(7)申(8)酉(9)戌(10)亥(11)子(0)丑(1)
    // 对应节气: 立春 惊蛰 清明 立夏 芒种 小暑 立秋 白露 寒露 立冬 大雪 小寒
    var zhiIndex;
    var yearForMonthGan = year; // 用于月干计算的"年"
    
    // 先判断是否在立春时刻之前（属于上一年）
    if ((month < realLiChunMonth) || 
        (month === realLiChunMonth && day < realLiChunDay) ||
        (month === realLiChunMonth && day === realLiChunDay && (clock || 0) < liChunHour)) {
        // 在立春之前，属于上一年的丑月(1)或之前的月份
        yearForMonthGan = year - 1;
        
        if (month === 1 && day === xiaoHan.getDate()) {
            // 小寒当天：判断具体时刻
            if ((clock || 0) >= xiaoHan.getHours()) {
                zhiIndex = 1; // 丑月
            } else {
                zhiIndex = 0; // 子月
            }
        } else if ((month === 1 && day > xiaoHan.getDate()) || 
            (month === 2 && day < realLiChunDay)) {
            // 1月小寒后 ~ 2月立春前 = 丑月
            zhiIndex = 1;
        } else if (month === 1 && day < xiaoHan.getDate()) {
            // 1月1日 ~ 小寒前 = 子月
            zhiIndex = 0;
        } else {
            zhiIndex = 1; // fallback: 丑月
        }
    } else {
        // 立春之后，正常映射
        // 节气与月支的对应（索引0-11对应立春到小寒）
        // jieQi: 0=立春(寅2),1=惊蛰(卯3),2=清明(辰4),3=立夏(巳5),4=芒种(午6),5=小暑(未7)
        //        6=立秋(申8),7=白露(酉9),8=寒露(戌10),9=立冬(亥11),10=大雪(子0),11=小寒(丑1)
        var monthZhiMap = [2,3,4,5,6,7,8,9,10,11,0,1]; // 节气索引 → 地支索引
        
        // 找到当前日期属于哪个节气之后（遍历0-10，跳过小寒因为小寒在次年1月）
        for (var i = 10; i >= 0; i--) {
            var jq = jieQi[i].date;
            var jqM = jq.getMonth() + 1;
            var jqD = jq.getDate();
            if (month > jqM || (month === jqM && day >= jqD)) {
                zhiIndex = monthZhiMap[i];
                break;
            }
        }
        if (zhiIndex === undefined) zhiIndex = 2; // fallback: 寅月
    }
    
    // 月干计算口诀：年干确定月干起始
    // 直接用数学公式：对于年份Y（立春后），年干索引 = (Y-4) % 10
    // 如果是立春前的日期，用 yearForMonthGan（已减1）计算
    var yearGanIndexForMonth = ((yearForMonthGan - 4) % 10 + 10) % 10;
    var monthGanStart = {0:2,1:4,2:6,3:8,4:0,5:2,6:4,7:6,8:8,9:0};
    var startGan = monthGanStart[yearGanIndexForMonth];
    // 月干 = 年干首月天干 + (本月地支索引 - 寅月索引2)
    var ganIndex = ((startGan + (zhiIndex - 2 + 12) % 12) % 10 + 10) % 10;
    
    return {
        gan: TIAN_GAN[ganIndex],
        zhi: DI_ZHI[zhiIndex],
        ganIndex: ganIndex,
        zhiIndex: zhiIndex
    };
}

/**
 * 计算日柱
 * 使用公式法计算
 */
function getDayPillar(year, month, day) {
    // 日干支计算
    // 改用 Date.UTC 避免本地时区/夏令时导致的差 1 天 bug
    // 参考点：1900-01-31 = 甲辰日（广泛使用的基准）
    var ref = Date.UTC(1900, 0, 31, 12, 0, 0); // 1900-01-31 noon UTC
    var target = Date.UTC(year, month - 1, day, 12, 0, 0);
    var diffDays = Math.round((target - ref) / 86400000);

    // 1900-01-31 = 甲辰 = gan 0, zhi 4
    var ganIndex = ((diffDays % 10) + 10) % 10;
    var zhiIndex = (((diffDays + 4) % 12) + 12) % 12;

    return {
        gan: TIAN_GAN[ganIndex],
        zhi: DI_ZHI[zhiIndex],
        ganIndex: ganIndex,
        zhiIndex: zhiIndex
    };
}

/**
 * 计算时柱
 * 根据日干和时辰推算
 */
function getHourPillar(dayGanIndex, hour) {
    // 时支直接对应
    const zhiIndex = hour;
    
    // 时干计算口诀：甲己还加甲，乙庚丙作初
    // 丙辛从戊起，丁壬庚子居
    // 戊癸何方发，壬子是真途
    const hourGanStart = {
        0: 0,  // 甲日 -> 甲子
        1: 2,  // 乙日 -> 丙子
        2: 4,  // 丙日 -> 戊子
        3: 6,  // 丁日 -> 庚子
        4: 8,  // 戊日 -> 壬子
        5: 0,  // 己日 -> 甲子
        6: 2,  // 庚日 -> 丙子
        7: 4,  // 辛日 -> 戊子
        8: 6,  // 壬日 -> 庚子
        9: 8   // 癸日 -> 壬子
    };
    
    const startGan = hourGanStart[dayGanIndex];
    const ganIndex = (startGan + hour) % 10;
    
    return {
        gan: TIAN_GAN[ganIndex],
        zhi: DI_ZHI[zhiIndex],
        ganIndex: ganIndex,
        zhiIndex: zhiIndex
    };
}

/**
 * 获取十神关系
 */
function getShiShen(dayGan, targetGan) {
    const dayWuXing = WU_XING[dayGan];
    const targetWuXing = WU_XING[targetGan];
    const dayYinYang = TIAN_GAN.indexOf(dayGan) % 2; // 0阳1阴
    const targetYinYang = TIAN_GAN.indexOf(targetGan) % 2;
    
    // 五行生克关系
    const wuXingRelation = getWuXingRelation(dayWuXing, targetWuXing);
    const sameYinYang = dayYinYang === targetYinYang;
    
    // 根据五行关系和阴阳确定十神
    return calculateShiShen(wuXingRelation, sameYinYang, dayYinYang);
}

/**
 * 获取五行关系
 */
function getWuXingRelation(dayWuXing, targetWuXing) {
    const wuXingOrder = ['木', '火', '土', '金', '水'];
    const dayIndex = wuXingOrder.indexOf(dayWuXing);
    const targetIndex = wuXingOrder.indexOf(targetWuXing);
    
    // 同五行
    if (dayIndex === targetIndex) return 'same';
    // 我生（食伤）
    if ((dayIndex + 1) % 5 === targetIndex) return 'produce';
    // 我克（财）
    if ((dayIndex + 2) % 5 === targetIndex) return 'control';
    // 克我（官杀）
    if ((dayIndex + 3) % 5 === targetIndex) return 'controlled';
    // 生我（印）
    if ((dayIndex + 4) % 5 === targetIndex) return 'produced';
    
    return 'unknown';
}

/**
 * 计算十神
 */
function calculateShiShen(relation, sameYinYang, dayYinYang) {
    const shiShenMap = {
        'same': sameYinYang ? '比肩' : '劫财',
        'produce': sameYinYang ? '食神' : '伤官',
        'control': sameYinYang ? '偏财' : '正财',
        'controlled': sameYinYang ? '七杀' : '正官',
        'produced': sameYinYang ? '偏印' : '正印'
    };
    
    return shiShenMap[relation] || '未知';
}

/**
 * 计算纳音
 */
function getNaYin(yearGanIndex, yearZhiIndex) {
    const index = (yearGanIndex % 10) * 2;
    const naYinIndex = (yearZhiIndex + index) % 60;
    return NA_YIN[Math.floor(naYinIndex / 2)];
}

/**
 * 计算藏干
 */
function getCangGan(zhi) {
    const cangGanMap = {
        '子': ['癸'],
        '丑': ['己', '癸', '辛'],
        '寅': ['甲', '丙', '戊'],
        '卯': ['乙'],
        '辰': ['戊', '乙', '癸'],
        '巳': ['丙', '庚', '戊'],
        '午': ['丁', '己'],
        '未': ['己', '丁', '乙'],
        '申': ['庚', '壬', '戊'],
        '酉': ['辛'],
        '戌': ['戊', '辛', '丁'],
        '亥': ['壬', '甲']
    };
    return cangGanMap[zhi] || [];
}

/**
 * 主函数：计算八字
 */
function calculateBaZi(year, month, day, hour, gender, clock) {
    // 计算四柱
    const yearPillar = getYearPillar(year, month, day, clock || 0);
    const monthPillar = getMonthPillar(year, month, day, hour, clock || 0);
    
    const dayForPillar = getDayPillar(year, month, day);
    const dayPillar = dayForPillar;
    const hourPillar = getHourPillar(dayPillar.ganIndex, hour);
    
    // 日主（日干）
    const dayGan = dayPillar.gan;
    
    // 计算十神（地支十神用藏干本气计算）
    const yearCangGan = getCangGan(yearPillar.zhi);
    const monthCangGan = getCangGan(monthPillar.zhi);
    const dayCangGan = getCangGan(dayPillar.zhi);
    const hourCangGan = getCangGan(hourPillar.zhi);

    const yearShiShen = {
        gan: getShiShen(dayGan, yearPillar.gan),
        zhi: getShiShen(dayGan, yearCangGan[0])
    };
    const monthShiShen = {
        gan: getShiShen(dayGan, monthPillar.gan),
        zhi: getShiShen(dayGan, monthCangGan[0])
    };
    const dayShiShen = {
        gan: '日主',
        zhi: getShiShen(dayGan, dayCangGan[0])
    };
    const hourShiShen = {
        gan: getShiShen(dayGan, hourPillar.gan),
        zhi: getShiShen(dayGan, hourCangGan[0])
    };
    
    // 藏干（已在上面计算）
    // 纳音
    const naYin = getNaYin(yearPillar.ganIndex, yearPillar.zhiIndex);
    
    // 五行统计
    const wuXingCount = countWuXing(
        yearPillar, monthPillar, dayPillar, hourPillar
    );
    
    return {
        year: {
            ...yearPillar,
            shiShen: yearShiShen,
            cangGan: yearCangGan,
            wuXing: {
                gan: WU_XING[yearPillar.gan],
                zhi: DI_ZHI_WU_XING[yearPillar.zhi]
            }
        },
        month: {
            ...monthPillar,
            shiShen: monthShiShen,
            cangGan: monthCangGan,
            wuXing: {
                gan: WU_XING[monthPillar.gan],
                zhi: DI_ZHI_WU_XING[monthPillar.zhi]
            }
        },
        day: {
            ...dayPillar,
            shiShen: dayShiShen,
            cangGan: dayCangGan,
            wuXing: {
                gan: WU_XING[dayPillar.gan],
                zhi: DI_ZHI_WU_XING[dayPillar.zhi]
            }
        },
        hour: {
            ...hourPillar,
            shiShen: hourShiShen,
            cangGan: hourCangGan,
            wuXing: {
                gan: WU_XING[hourPillar.gan],
                zhi: DI_ZHI_WU_XING[hourPillar.zhi]
            }
        },
        naYin: naYin,
        wuXingCount: wuXingCount,
        gender: gender,
        birthDate: {
            year: year,
            month: month,
            day: day,
            hour: hour
        }
    };
}

/**
 * 统计五行数量
 */
function countWuXing(yearPillar, monthPillar, dayPillar, hourPillar) {
    const count = {
        '金': 0, '木': 0, '水': 0, '火': 0, '土': 0
    };
    
    // 统计天干
    count[WU_XING[yearPillar.gan]]++;
    count[WU_XING[monthPillar.gan]]++;
    count[WU_XING[dayPillar.gan]]++;
    count[WU_XING[hourPillar.gan]]++;
    
    // 统计地支
    count[DI_ZHI_WU_XING[yearPillar.zhi]]++;
    count[DI_ZHI_WU_XING[monthPillar.zhi]]++;
    count[DI_ZHI_WU_XING[dayPillar.zhi]]++;
    count[DI_ZHI_WU_XING[hourPillar.zhi]]++;
    
    return count;
}

/**
 * ============================
 * 大运流年计算（重写版）
 * ============================
 */

/**
 * 计算起运年龄
 *
 * 规则：
 * - 顺行：从出生日数到未来下一个「节」的天数 ÷ 3 = 起运岁数
 * - 逆行：从出生日逆数到上一个「节」的天数 ÷ 3 = 起运岁数
 *
 * 阳年：年干为甲丙戊庚壬
 * 阴年：年干为乙丁己辛癸
 * 阳年男 + 阴年女 → 顺行
 * 阴年男 + 阳年女 → 逆行
 */


/**
 * 计算大运
 *
 * @param {Object} monthPillar - 月柱 {gan, zhi, ganIndex, zhiIndex}
 * @param {Object} yearPillar  - 年柱（含ganIndex用于判断阴阳）
 * @param {string} gender      - 'male' | 'female'
 * @param {number} birthYear   - 出生公历年
 * @param {number} birthMonth  - 出生公历月
 * @param {number} birthDay    - 出生公历日
 * @returns {Object} { list, isForward, startAge }
 */
function calculateDaYun(monthPillar, yearPillar, gender, birthYear, birthMonth, birthDay, birthHour, preciseClock) {
    const yearGanIsYang = yearPillar.ganIndex % 2 === 0;
    const isMale = gender === 'male';
    const isForward = (yearGanIsYang && isMale) || (!yearGanIsYang && !isMale);

    // 出生日期时间：优先使用 preciseClock（精确钟点），否则用时辰中点
    var hourMap = [0,2,4,6,8,10,12,14,16,18,20,22];
    var birthClockHour;
    if (typeof preciseClock === 'number' && preciseClock > 0) {
        birthClockHour = preciseClock;
    } else {
        birthClockHour = hourMap[birthHour] !== undefined ? hourMap[birthHour] : 0;
    }
    var birthDateTime = birthDateToDecimal(birthYear, birthMonth, birthDay, birthClockHour);

    let targetJQ = null, diffDays = 0;

    if (isForward) {
        for (const yr of [birthYear, birthYear + 1]) {
            const jqList = getJieQiDates(yr);
            for (const jq of jqList) {
                const jqDT = birthDateToDecimal(jq.date.getFullYear(), jq.date.getMonth() + 1, jq.date.getDate(), jq.date.getHours());
                if (jqDT > birthDateTime) { targetJQ = jq; diffDays = jqDT - birthDateTime; break; }
            }
            if (targetJQ) break;
        }
    } else {
        // 逆排：从出生日往前找最近的节
        // 需要查当前年份和上一年份的节气
        for (const yr of [birthYear, birthYear - 1]) {
            const jqList = getJieQiDates(yr);
            for (let i = jqList.length - 1; i >= 0; i--) {
                const jqDT = birthDateToDecimal(jqList[i].date.getFullYear(), jqList[i].date.getMonth() + 1, jqList[i].date.getDate(), jqList[i].date.getHours());
                if (jqDT < birthDateTime) {
                    targetJQ = jqList[i];
                    diffDays = birthDateTime - jqDT;
                    break;
                }
            }
            if (targetJQ) break;
        }
    }

    if (!targetJQ) {
        diffDays = isForward ? 30 : 30;
    }

    // 起运年龄：3天折1岁
    const qiYunAge = Math.max(0.1, Math.round(diffDays / 3 * 10) / 10);

    // ===== 传统换算：整岁 + 余天×4=月 + 余时辰×10=天 =====
    // 将天数差拆分为整3天组(岁) + 余天 + 余时辰
    const totalHours = diffDays * 24;
    const threeDayHours = 3 * 24;
    const wholeYears = Math.floor(totalHours / threeDayHours);
    const remainHours = totalHours - wholeYears * threeDayHours;
    const remainDays = Math.floor(remainHours / 24);
    const remainHourRemainder = remainHours - remainDays * 24;
    const remainShiChen = Math.floor(remainHourRemainder / 2); // 1时辰=2小时

    const calcMonths = remainDays * 4;           // 1天 = 4个月
    const calcDays = remainShiChen * 10;         // 1时辰 = 10天

    const timingInfo = {
        years: wholeYears,
        months: calcMonths,
        days: calcDays,
        totalQiYunAge: qiYunAge
    };

    // 生成大运列表（8步）
    const daYunList = [];
    for (let i = 0; i < 8; i++) {
        let ganIdx, zhiIdx;
        if (isForward) {
            ganIdx = (monthPillar.ganIndex + (i + 1)) % 10;
            zhiIdx = (monthPillar.zhiIndex + (i + 1)) % 12;
        } else {
            ganIdx = (monthPillar.ganIndex - (i + 1) + 100) % 10;
            zhiIdx = (monthPillar.zhiIndex - (i + 1) + 120) % 12;
        }
        // 虚岁标签：出生即1岁，立春前出生（属上一年）需额外+1岁
        var preLiChun = (birthMonth < 2) || (birthMonth === 2 && birthDay < 5);
        var showAge = Math.floor(qiYunAge + 1) + (preLiChun ? 1 : 0) + i * 10;
        const startYearExact = birthYear + qiYunAge + i * 10;
        const startYear = Math.round(startYearExact);
        // 流年=10年，范围 startYear ~ startYear+9
        const endYear = startYear + 9;

        daYunList.push({
            gan: TIAN_GAN[ganIdx], zhi: DI_ZHI[zhiIdx],
            ganIndex: ganIdx, zhiIndex: zhiIdx,
            displayAge: String(showAge),
            startYear: startYear,
            endYear: endYear
        });
    }

    return {
        list: daYunList,
        isForward: isForward,
        qiYunAge: qiYunAge,
        timingInfo: timingInfo,
        targetJieQi: targetJQ ? targetJQ.name : null
    };
}

/** 将年月日时转为自 epoch 起的天数值（用于精确计算日差） */
function birthDateToDecimal(year, month, day, hour) {
    return new Date(year, month - 1, day, hour || 0, 0, 0).getTime() / (1000 * 60 * 60 * 24);
}

/**
 * 计算流年（给定大运下的10年流年）
 * 注意：流年干支应取该年的年柱（以立春为界）
 * 传入 month=6 确保获取到正确年份的干支
 */
function calculateLiuNian(daYunItem, dayGan) {
    const liuNianList = [];
    for (let i = 0; i < 10; i++) {
        const yearNum = daYunItem.startYear + i;
        // 用6月（年中）避免立春导致的年份偏移
        const yearPillar = getYearPillar(yearNum, 6, 15);

        liuNianList.push({
            year: yearNum,
            gan: yearPillar.gan,
            zhi: yearPillar.zhi,
            ganIndex: yearPillar.ganIndex,
            zhiIndex: yearPillar.zhiIndex,
            shiShen: getShiShen(dayGan, yearPillar.gan)
        });
    }
    return liuNianList;
}

/**
 * ============================
 * 神煞计算
 * ============================
 */

// 神煞定义：名称、类型（吉神/凶煞/中性）、查找规则、描述
// 神煞定义 — 精简实用，每柱独立查找
// 名称、类型（吉神/凶煞/中性）、查找规则、描述
const SHEN_SHA_DEFS = [
    // ====== 吉神（日干/月支/日支查） ======
    {
        name: '天乙贵人', type: 'ji-shen',
        desc: '命中最吉之神，主逢凶化吉，贵人相助',
        find: function(bazi) {
            // 甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，六辛逢马虎
            const map = { '甲':['丑','未'],'戊':['丑','未'],'庚':['丑','未'], '乙':['子','申'],'己':['子','申'],'丙':['亥','酉'],'丁':['亥','酉'],'壬':['卯','巳'],'癸':['卯','巳'],'辛':['午','寅'] };
            const t = map[bazi.day.gan] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '文昌贵人', type: 'ji-shen',
        desc: '主聪明才智，学业有成，利于文职',
        find: function(bazi) {
            // 甲巳 乙午 丙戊申 丁己酉 庚亥 辛子 壬寅 癸卯
            const map = { '甲':['巳'],'乙':['午'],'丙':['申'],'丁':['酉'],'戊':['申'],'己':['酉'],'庚':['亥'],'辛':['子'],'壬':['寅'],'癸':['卯'] };
            const t = map[bazi.day.gan] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '太极贵人', type: 'ji-shen',
        desc: '主好学深思，利于玄学、哲学研究',
        find: function(bazi) {
            // 甲乙寅卯 丙丁午亥 戊己辰戌丑未 庚辛申酉 壬癸子午
            const map = { '甲':['寅','卯'],'乙':['寅','卯'],'丙':['午','亥'],'丁':['午','亥'],'戊':['辰','戌','丑','未'],'己':['辰','戌','丑','未'],'庚':['申','酉'],'辛':['申','酉'],'壬':['子','午'],'癸':['子','午'] };
            const t = map[bazi.day.gan] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '天德贵人', type: 'ji-shen',
        desc: '主心地善良，逢凶化吉，一生少灾',
        find: function(bazi) {
            // 正月丁 二月申(支) 三月壬 四月辛 五月亥(支) 六月甲 七月癸 八月寅(支) 九月丙 十月乙 十一月巳(支) 十二月庚
            const mz = bazi.month.zhi;
            const gMap = { '寅':'丁','辰':'壬','巳':'辛','未':'甲','申':'癸','戌':'丙','亥':'乙','丑':'庚' };
            const zMap = { '卯':'申','午':'亥','酉':'寅','子':'巳' };
            const f = [];
            ['year','month','day','hour'].forEach(p => {
                if (gMap[mz] && bazi[p].gan === gMap[mz]) f.push(p);
                if (zMap[mz] && bazi[p].zhi === zMap[mz]) f.push(p);
            });
            return f;
        }
    },
    {
        name: '月德贵人', type: 'ji-shen',
        desc: '主性情温和，贵人多助，利于合作',
        find: function(bazi) {
            // 寅午戌月在丙 申子辰月在壬 亥卯未月在甲 巳酉丑月在庚
            const mz = bazi.month.zhi;
            const map = { '寅':'丙','午':'丙','戌':'丙','申':'壬','子':'壬','辰':'壬','亥':'甲','卯':'甲','未':'甲','巳':'庚','酉':'庚','丑':'庚' };
            const tg = map[mz]; if (!tg) return [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(bazi[p].gan === tg) f.push(p); });
            return f;
        }
    },
    {
        name: '福星贵人', type: 'ji-shen',
        desc: '主福禄双全，一生安稳，利于财运',
        find: function(bazi) {
            // 日支查天干匹配
            const dz = bazi.day.zhi;
            const map = { '子':['甲','丙','戊','庚','壬'],'丑':['乙','丁','己','辛','癸'],'寅':['甲','丙','丁','庚','癸'],'卯':['乙','丁','戊','辛','壬'],'辰':['甲','乙','戊','己','壬'],'巳':['甲','乙','丙','戊','辛'],'午':['甲','乙','丙','戊','辛'],'未':['乙','丁','己','辛','癸'],'申':['甲','丙','戊','庚','壬'],'酉':['乙','丁','己','辛','癸'],'戌':['甲','乙','戊','己','壬'],'亥':['甲','乙','丙','戊','辛'] };
            const t = map[dz] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].gan)) f.push(p); });
            return f;
        }
    },
    {
        name: '禄神', type: 'ji-shen',
        desc: '主福气财禄，一生衣食无忧',
        find: function(bazi) {
            // 甲禄寅 乙卯 丙戊巳 丁己午 庚申 辛酉 壬亥 癸子
            const map = { '甲':'寅','乙':'卯','丙':'巳','戊':'巳','丁':'午','己':'午','庚':'申','辛':'酉','壬':'亥','癸':'子' };
            const tz = map[bazi.day.gan]; if (!tz) return [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(bazi[p].zhi === tz) f.push(p); });
            return f;
        }
    },
    {
        name: '金舆', type: 'ji-shen',
        desc: '主有车马之福，出行顺利，富贵之象',
        find: function(bazi) {
            // 甲辰乙巳丙申丁未戊寅己卯庚戌辛亥壬丑癸午
            const map = { '甲':['辰'],'乙':['巳'],'丙':['申'],'丁':['未'],'戊':['寅'],'己':['卯'],'庚':['戌'],'辛':['亥'],'壬':['丑'],'癸':['午'] };
            const t = map[bazi.day.gan] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '学堂', type: 'ji-shen',
        desc: '主聪明好学，才艺出众，利于学业考试',
        find: function(bazi) {
            // 日干长生位 = 学堂
            const cs = { '甲':'亥','乙':'午','丙':'寅','丁':'酉','戊':'寅','己':'酉','庚':'巳','辛':'子','壬':'申','癸':'卯' };
            const tz = cs[bazi.day.gan]; if (!tz) return [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(bazi[p].zhi === tz) f.push(p); });
            return f;
        }
    },
    {
        name: '国印贵人', type: 'ji-shen',
        desc: '主掌权用印，利于从政、法律、文书方面',
        find: function(bazi) {
            // 禄前八位
            const lm = { '甲':'寅','乙':'卯','丙':'巳','丁':'午','戊':'巳','己':'午','庚':'申','辛':'酉','壬':'亥','癸':'子' };
            const lz = lm[bazi.day.gan]; if (!lz) return [];
            const dz = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
            const tz = dz[(dz.indexOf(lz) + 8) % 12];
            const f = []; ['year','month','day','hour'].forEach(p => { if(bazi[p].zhi === tz) f.push(p); });
            return f;
        }
    },
    {
        name: '天赦', type: 'ji-shen',
        desc: '主逢凶化吉，灾消祸散，一生多获天庇',
        find: function(bazi) {
            // 春戊寅 夏甲午 秋戊申 冬甲子（月支定季节+日支校验）
            const mz = bazi.month.zhi, dz = bazi.day.zhi;
            if ((['寅','卯','辰'].includes(mz) && dz === '寅') || (['巳','午','未'].includes(mz) && dz === '午') || (['申','酉','戌'].includes(mz) && dz === '申') || (['亥','子','丑'].includes(mz) && dz === '子')) return ['day'];
            return [];
        }
    },
    {
        name: '三奇贵人', type: 'ji-shen',
        desc: '主才华出众，机遇非凡，遇事多成',
        find: function(bazi) {
            // 天上三奇甲戊庚，地下三奇乙丙丁，人中三奇壬癸辛
            // 需三字全见，此作简化标记
            const allGan = [bazi.year.gan, bazi.month.gan, bazi.day.gan, bazi.hour.gan];
            const hasAll = (arr) => arr.every(g => allGan.includes(g));
            if (hasAll(['甲','戊','庚']) || hasAll(['乙','丙','丁']) || hasAll(['壬','癸','辛'])) return ['day'];
            return [];
        }
    },

    // ====== 中性（年支/日支/日柱查） ======
    {
        name: '驿马', type: 'zhong',
        desc: '主动荡奔波，主出行、迁移、变动',
        find: function(bazi) {
            // 申子辰马在寅 寅午戌马在申 巳酉丑马在亥 亥卯未马在巳
            const yz = bazi.year.zhi;
            const map = { '申':['寅'],'子':['寅'],'辰':['寅'],'寅':['申'],'午':['申'],'戌':['申'],'巳':['亥'],'酉':['亥'],'丑':['亥'],'亥':['巳'],'卯':['巳'],'未':['巳'] };
            const t = map[yz] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '桃花', type: 'zhong',
        desc: '主人缘好，异性缘旺，利于社交',
        find: function(bazi) {
            // 申子辰桃花酉 寅午戌桃花卯 巳酉丑桃花午 亥卯未桃花子（以年支查）
            const yz = bazi.year.zhi;
            const map = { '申':['酉'],'子':['酉'],'辰':['酉'],'寅':['卯'],'午':['卯'],'戌':['卯'],'巳':['午'],'酉':['午'],'丑':['午'],'亥':['子'],'卯':['子'],'未':['子'] };
            const t = map[yz] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '华盖', type: 'zhong',
        desc: '主聪敏好学，但性情孤高，利于宗教哲学',
        find: function(bazi) {
            // 申子辰华盖辰 寅午戌华盖戌 巳酉丑华盖丑 亥卯未华盖未
            const yz = bazi.year.zhi;
            const map = { '申':['辰'],'子':['辰'],'辰':['辰'],'寅':['戌'],'午':['戌'],'戌':['戌'],'巳':['丑'],'酉':['丑'],'丑':['丑'],'亥':['未'],'卯':['未'],'未':['未'] };
            const t = map[yz] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '将星', type: 'ji-shen',
        desc: '主掌权，有领导才能，利于仕途',
        find: function(bazi) {
            // 申子辰将星子 寅午戌将星午 巳酉丑将星酉 亥卯未将星卯
            const yz = bazi.year.zhi;
            const map = { '申':['子'],'子':['子'],'辰':['子'],'寅':['午'],'午':['午'],'戌':['午'],'巳':['酉'],'酉':['酉'],'丑':['酉'],'亥':['卯'],'卯':['卯'],'未':['卯'] };
            const t = map[yz] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '红鸾', type: 'ji-shen',
        desc: '主婚姻喜庆，恋爱顺利，人缘极佳',
        find: function(bazi) {
            // 子卯 丑寅 寅丑 卯子 辰亥 巳戌 午酉 未申 申未 酉午 戌巳 亥辰
            const yz = bazi.year.zhi;
            const map = { '子':'卯','丑':'寅','寅':'丑','卯':'子','辰':'亥','巳':'戌','午':'酉','未':'申','申':'未','酉':'午','戌':'巳','亥':'辰' };
            const tz = map[yz]; if (!tz) return [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(bazi[p].zhi === tz) f.push(p); });
            return f;
        }
    },
    {
        name: '天喜', type: 'ji-shen',
        desc: '主喜庆临门，婚姻美满，添丁之喜',
        find: function(bazi) {
            // 天喜与红鸾对冲
            const yz = bazi.year.zhi;
            const hlMap = { '子':'卯','丑':'寅','寅':'丑','卯':'子','辰':'亥','巳':'戌','午':'酉','未':'申','申':'未','酉':'午','戌':'巳','亥':'辰' };
            const hlZhi = hlMap[yz]; if (!hlZhi) return [];
            const dz = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
            const tz = dz[(dz.indexOf(hlZhi) + 6) % 12];
            const f = []; ['year','month','day','hour'].forEach(p => { if(bazi[p].zhi === tz) f.push(p); });
            return f;
        }
    },
    {
        name: '魁罡', type: 'zhong',
        desc: '主性格刚毅，果敢决断，亦易流于孤傲',
        find: function(bazi) {
            // 壬辰 庚戌 庚辰 戊戌
            if (['壬辰','庚戌','庚辰','戊戌'].includes(bazi.day.gan + bazi.day.zhi)) return ['day'];
            return [];
        }
    },
    {
        name: '金神', type: 'zhong',
        desc: '主刚强有志，但易受金器之伤',
        find: function(bazi) {
            // 乙丑 己巳 癸酉 — 日柱或时柱见之
            const f = [];
            if (['乙丑','己巳','癸酉'].includes(bazi.day.gan + bazi.day.zhi)) f.push('day');
            if (['乙丑','己巳','癸酉'].includes(bazi.hour.gan + bazi.hour.zhi)) f.push('hour');
            return f;
        }
    },

    // ====== 凶煞（年支/日干/日柱/月支查） ======
    {
        name: '羊刃', type: 'ji',
        desc: '主刚烈果断，但易有血光之灾或手术',
        find: function(bazi) {
            // 甲刃卯 乙辰 丙戊午 丁己未 庚酉 辛戌 壬子 癸丑
            const map = { '甲':'卯','乙':'辰','丙':'午','戊':'午','丁':'未','己':'未','庚':'酉','辛':'戌','壬':'子','癸':'丑' };
            const tz = map[bazi.day.gan]; if (!tz) return [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(bazi[p].zhi === tz) f.push(p); });
            return f;
        }
    },
    {
        name: '劫煞', type: 'ji',
        desc: '主破财灾祸，凡事多阻，需谨慎行事',
        find: function(bazi) {
            // 申子辰劫巳 寅午戌劫亥 巳酉丑劫寅 亥卯未劫申
            const yz = bazi.year.zhi;
            const map = { '申':['巳'],'子':['巳'],'辰':['巳'],'寅':['亥'],'午':['亥'],'戌':['亥'],'巳':['寅'],'酉':['寅'],'丑':['寅'],'亥':['申'],'卯':['申'],'未':['申'] };
            const t = map[yz] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '灾煞', type: 'ji',
        desc: '主灾祸频生，水火之厄，需防灾伤',
        find: function(bazi) {
            // 申子辰灾午 寅午戌灾子 巳酉丑灾卯 亥卯未灾酉
            const yz = bazi.year.zhi;
            const map = { '申':['午'],'子':['午'],'辰':['午'],'寅':['子'],'午':['子'],'戌':['子'],'巳':['卯'],'酉':['卯'],'丑':['卯'],'亥':['酉'],'卯':['酉'],'未':['酉'] };
            const t = map[yz] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '亡神', type: 'ji',
        desc: '主心思不宁，暗耗不利，需防意外',
        find: function(bazi) {
            // 申子辰亡亥 寅午戌亡巳 巳酉丑亡申 亥卯未亡寅
            const yz = bazi.year.zhi;
            const map = { '申':['亥'],'子':['亥'],'辰':['亥'],'寅':['巳'],'午':['巳'],'戌':['巳'],'巳':['申'],'酉':['申'],'丑':['申'],'亥':['寅'],'卯':['寅'],'未':['寅'] };
            const t = map[yz] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '空亡', type: 'ji',
        desc: '主凡事不顺，空虚不实，需看具体位置',
        find: function(bazi) {
            // 以日柱查旬空
            const dayNaYin = (bazi.day.ganIndex * 6 + bazi.day.zhiIndex) % 60;
            const xun = Math.floor(dayNaYin / 10);
            const kw = [['戌','亥'],['申','酉'],['午','未'],['辰','巳'],['寅','卯'],['子','丑']][xun] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(kw.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '孤辰', type: 'ji',
        desc: '主性格孤僻，六亲缘薄，独立性强',
        find: function(bazi) {
            // 亥子丑见寅 寅卯辰见巳 巳午未见申 申酉戌见亥
            const yz = bazi.year.zhi;
            const map = { '亥':['寅'],'子':['寅'],'丑':['寅'],'寅':['巳'],'卯':['巳'],'辰':['巳'],'巳':['申'],'午':['申'],'未':['申'],'申':['亥'],'酉':['亥'],'戌':['亥'] };
            const t = map[yz] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '寡宿', type: 'ji',
        desc: '主婚姻不顺，孤独寂寞，感情波折',
        find: function(bazi) {
            // 亥子丑见戌 寅卯辰见丑 巳午未见辰 申酉戌见未
            const yz = bazi.year.zhi;
            const map = { '亥':['戌'],'子':['戌'],'丑':['戌'],'寅':['丑'],'卯':['丑'],'辰':['丑'],'巳':['辰'],'午':['辰'],'未':['辰'],'申':['未'],'酉':['未'],'戌':['未'] };
            const t = map[yz] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '元辰', type: 'ji',
        desc: '主耗散破财，行事多阻，需防破败',
        find: function(bazi) {
            // 阳男阴女取冲后一位，阴男阳女取冲前一位
            const yz = bazi.year.zhi, g = bazi.gender;
            const ygyy = bazi.year.ganIndex % 2; // 0=阳
            const isYN = (ygyy === 0 && g === 'male') || (ygyy === 1 && g === 'female');
            const dz = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
            const cIdx = (dz.indexOf(yz) + 6) % 12;
            const tz = dz[isYN ? (cIdx + 1) % 12 : (cIdx - 1 + 12) % 12];
            const f = []; ['year','month','day','hour'].forEach(p => { if(bazi[p].zhi === tz) f.push(p); });
            return f;
        }
    },
    {
        name: '勾绞', type: 'ji',
        desc: '主口舌是非，易有纠纷诉讼，需防官非',
        find: function(bazi) {
            // 亥子丑见卯辰 寅卯辰见巳午 巳午未见申酉 申酉戌见亥子
            const yz = bazi.year.zhi;
            const map = { '亥':['卯','辰'],'子':['卯','辰'],'丑':['卯','辰'],'寅':['巳','午'],'卯':['巳','午'],'辰':['巳','午'],'巳':['申','酉'],'午':['申','酉'],'未':['申','酉'],'申':['亥','子'],'酉':['亥','子'],'戌':['亥','子'] };
            const t = map[yz] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '丧门', type: 'ji',
        desc: '主丧服之忧，不利六亲，需防孝服',
        find: function(bazi) {
            // 申子辰见寅 寅午戌见申 巳酉丑见亥 亥卯未见巳
            const yz = bazi.year.zhi;
            const map = { '申':['寅'],'子':['寅'],'辰':['寅'],'寅':['申'],'午':['申'],'戌':['申'],'巳':['亥'],'酉':['亥'],'丑':['亥'],'亥':['巳'],'卯':['巳'],'未':['巳'] };
            const t = map[yz] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '吊客', type: 'ji',
        desc: '主吊丧之事，不利亲人健康，需注意',
        find: function(bazi) {
            // 申子辰见巳 寅午戌见亥 巳酉丑见寅 亥卯未见申
            const yz = bazi.year.zhi;
            const map = { '申':['巳'],'子':['巳'],'辰':['巳'],'寅':['亥'],'午':['亥'],'戌':['亥'],'巳':['寅'],'酉':['寅'],'丑':['寅'],'亥':['申'],'卯':['申'],'未':['申'] };
            const t = map[yz] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '十恶大败', type: 'ji',
        desc: '主败财破耗，事业多蹇，需防破败之事',
        find: function(bazi) {
            // 甲辰 乙巳 丙申 丁亥 戊戌 己丑 庚辰 辛巳 壬申 癸亥
            if (['甲辰','乙巳','丙申','丁亥','戊戌','己丑','庚辰','辛巳','壬申','癸亥'].includes(bazi.day.gan + bazi.day.zhi)) return ['day'];
            return [];
        }
    },
    {
        name: '孤鸾煞', type: 'ji',
        desc: '主婚姻不顺，夫妻缘薄，感情多有波折',
        find: function(bazi) {
            // 乙巳 丁巳 辛亥 戊申 甲寅 壬子 丙午 戊午
            if (['乙巳','丁巳','辛亥','戊申','甲寅','壬子','丙午','戊午'].includes(bazi.day.gan + bazi.day.zhi)) return ['day'];
            return [];
        }
    },
    {
        name: '阴差阳错', type: 'ji',
        desc: '主婚姻波折，夫妻关系不和，家庭多矛盾',
        find: function(bazi) {
            // 丙子 丁丑 戊寅 辛卯 壬辰 癸巳 丙午 丁未 戊申 辛酉 壬戌 癸亥（月柱）
            if (['丙子','丁丑','戊寅','辛卯','壬辰','癸巳','丙午','丁未','戊申','辛酉','壬戌','癸亥'].includes(bazi.month.gan + bazi.month.zhi)) return ['month'];
            return [];
        }
    },
    {
        name: '血刃', type: 'ji',
        desc: '主血光之灾，易有手术刀伤，需注意安全',
        find: function(bazi) {
            // 正月(寅)起丑顺行
            const mz = bazi.month.zhi;
            const mdz = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
            const xrdz = ['丑','寅','卯','辰','巳','午','未','申','酉','戌','亥','子'];
            const idx = mdz.indexOf(mz); if (idx < 0) return [];
            const tz = xrdz[idx];
            const f = []; ['year','month','day','hour'].forEach(p => { if(bazi[p].zhi === tz) f.push(p); });
            return f;
        }
    },
    {
        name: '天罗地网', type: 'ji',
        desc: '主运势受阻，易犯官非，需防牢狱之灾',
        find: function(bazi) {
            // 辰见巳、戌见亥为天罗；巳见辰、亥见戌为地网
            const yz = bazi.year.zhi;
            const f = []; ['year','month','day','hour'].forEach(p => { if((['辰','戌'].includes(yz) && ['巳','亥'].includes(bazi[p].zhi)) || (['巳','亥'].includes(yz) && ['辰','戌'].includes(bazi[p].zhi))) f.push(p); });
            return [...new Set(f)];
        }
    },
    {
        name: '红艳煞', type: 'zhong',
        desc: '主风流多情，情感丰富，异性缘旺',
        find: function(bazi) {
            // 甲午 乙申 丙寅 丁未 戊辰 己辰 庚戌 辛酉 壬子 癸申
            const map = { '甲':['午'],'乙':['申'],'丙':['寅'],'丁':['未'],'戊':['辰'],'己':['辰'],'庚':['戌'],'辛':['酉'],'壬':['子'],'癸':['申'] };
            const t = map[bazi.day.gan] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '天德合', type: 'ji-shen',
        desc: '主贵人合力，遇事多得贵人襄助（天德合干）',
        find: function(bazi) {
            // 天德合 = 月天德所在的天干/地支，查其「合」位是否出现在四柱
            // 寅月天德丁→合壬  卯月天德申(支)→合巳  辰月天德壬→合丁
            // 巳月天德辛→合丙  午月天德亥(支)→合寅  未月天德甲→合己
            // 申月天德癸→合戊  酉月天德寅(支)→合亥  戌月天德丙→合辛
            // 亥月天德乙→合庚  子月天德巳(支)→合申  丑月天德庚→合乙
            const mz = bazi.month.zhi;
            const ganHeMap = { '甲':'己','己':'甲','乙':'庚','庚':'乙','丙':'辛','辛':'丙','丁':'壬','壬':'丁','戊':'癸','癸':'戊' };
            const zhiLiuHe = { '子':'丑','丑':'子','寅':'亥','亥':'寅','卯':'戌','戌':'卯','辰':'酉','酉':'辰','巳':'申','申':'巳','午':'未','未':'午' };
            // 天德(干)/天德(支)
            const tdGan = { '寅':'丁','辰':'壬','巳':'辛','未':'甲','申':'癸','戌':'丙','亥':'乙','丑':'庚' };
            const tdZhi = { '卯':'申','午':'亥','酉':'寅','子':'巳' };
            const f = [];
            if (tdGan[mz]) {
                const heGan = ganHeMap[tdGan[mz]];
                ['year','month','day','hour'].forEach(p => { if(bazi[p].gan === heGan) f.push(p); });
            }
            if (tdZhi[mz]) {
                const heZhi = zhiLiuHe[tdZhi[mz]];
                ['year','month','day','hour'].forEach(p => { if(bazi[p].zhi === heZhi) f.push(p); });
            }
            return f;
        }
    },
    {
        name: '月德合', type: 'ji-shen',
        desc: '主性情温厚，人际和谐，合作顺利（月德合干）',
        find: function(bazi) {
            // 月德：寅午戌丙→合辛  申子辰壬→合丁  亥卯未甲→合己  巳酉丑庚→合乙
            const mz = bazi.month.zhi;
            const yueDe = { '寅':'丙','午':'丙','戌':'丙','申':'壬','子':'壬','辰':'壬','亥':'甲','卯':'甲','未':'甲','巳':'庚','酉':'庚','丑':'庚' };
            const ganHeMap = { '甲':'己','己':'甲','乙':'庚','庚':'乙','丙':'辛','辛':'丙','丁':'壬','壬':'丁','戊':'癸','癸':'戊' };
            const yd = yueDe[mz]; if (!yd) return [];
            const heGan = ganHeMap[yd]; if (!heGan) return [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(bazi[p].gan === heGan) f.push(p); });
            return f;
        }
    },
    {
        name: '流霞', type: 'ji',
        desc: '主血光意外，易受外伤，需注意安全',
        find: function(bazi) {
            // 甲酉 乙戌 丙未 丁申 戊巳 己午 庚辰 辛卯 壬亥 癸寅
            const map = { '甲':['酉'],'乙':['戌'],'丙':['未'],'丁':['申'],'戊':['巳'],'己':['午'],'庚':['辰'],'辛':['卯'],'壬':['亥'],'癸':['寅'] };
            const t = map[bazi.day.gan] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '飞刃', type: 'ji',
        desc: '主意外伤害、血光手术，比羊刃更凶，需格外小心',
        find: function(bazi) {
            // 飞刃 = 羊刃对冲位：甲刃卯冲酉 乙刃辰冲戌 丙戊刃午冲子 丁己刃未冲丑 庚刃酉冲卯 辛刃戌冲辰 壬刃子冲午 癸刃丑冲未
            const yangRen = { '甲':'卯','乙':'辰','丙':'午','戊':'午','丁':'未','己':'未','庚':'酉','辛':'戌','壬':'子','癸':'丑' };
            const chong = { '卯':'酉','酉':'卯','辰':'戌','戌':'辰','午':'子','子':'午','未':'丑','丑':'未' };
            const yr = yangRen[bazi.day.gan]; if (!yr) return [];
            const fz = chong[yr]; if (!fz) return [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(bazi[p].zhi === fz) f.push(p); });
            return f;
        }
    },
    {
        name: '白虎', type: 'ji',
        desc: '主血光横祸、官非争斗，逢之宜谨慎行事',
        find: function(bazi) {
            // 年支查：申子辰白虎在卯，寅午戌白虎在酉，巳酉丑白虎在子，亥卯未白虎在午
            const yz = bazi.year.zhi;
            const map = { '申':['卯'],'子':['卯'],'辰':['卯'],'寅':['酉'],'午':['酉'],'戌':['酉'],'巳':['子'],'酉':['子'],'丑':['子'],'亥':['午'],'卯':['午'],'未':['午'] };
            const t = map[yz] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '六厄', type: 'ji',
        desc: '主困顿不顺，多方阻碍，行事宜保守',
        find: function(bazi) {
            // 申子辰六厄卯 寅午戌六厄子 巳酉丑六厄午 亥卯未六厄酉（以日支查）
            const dz = bazi.day.zhi;
            const map = { '申':['卯'],'子':['卯'],'辰':['卯'],'寅':['子'],'午':['子'],'戌':['子'],'巳':['午'],'酉':['午'],'丑':['午'],'亥':['酉'],'卯':['酉'],'未':['酉'] };
            const t = map[dz] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '披麻', type: 'ji',
        desc: '主孝服丧事，长辈健康需关注，六亲缘薄',
        find: function(bazi) {
            // 年支查：申子辰披麻酉 寅午戌披麻卯 巳酉丑披麻子 亥卯未披麻木
            const yz = bazi.year.zhi;
            const map = { '申':['酉'],'子':['酉'],'辰':['酉'],'寅':['卯'],'午':['卯'],'戌':['卯'],'巳':['子'],'酉':['子'],'丑':['子'],'亥':['午'],'卯':['午'],'未':['午'] };
            const t = map[yz] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '天哭', type: 'ji',
        desc: '主悲泣哀伤，情绪低落，易遇亲人病痛',
        find: function(bazi) {
            // 年支查：申子辰天哭午 寅午戌天哭子 巳酉丑天哭酉 亥卯未天哭卯
            const yz = bazi.year.zhi;
            const map = { '申':['午'],'子':['午'],'辰':['午'],'寅':['子'],'午':['子'],'戌':['子'],'巳':['酉'],'酉':['酉'],'丑':['酉'],'亥':['卯'],'卯':['卯'],'未':['卯'] };
            const t = map[yz] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '天虚', type: 'ji',
        desc: '主虚耗不实，财运空乏，精神恍惚',
        find: function(bazi) {
            // 年支查：申子辰天虚未 寅午戌天虚丑 巳酉丑天虚辰 亥卯未天虚戌
            const yz = bazi.year.zhi;
            const map = { '申':['未'],'子':['未'],'辰':['未'],'寅':['丑'],'午':['丑'],'戌':['丑'],'巳':['辰'],'酉':['辰'],'丑':['辰'],'亥':['戌'],'卯':['戌'],'未':['戌'] };
            const t = map[yz] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '戟锋', type: 'ji',
        desc: '主利器之伤、手术开刀，宜注意安全',
        find: function(bazi) {
            // 日干查：甲卯 乙辰 丙戊午 丁己未 庚酉 辛戌 壬亥 癸子
            const map = { '甲':['卯'],'乙':['辰'],'丙':['午'],'戊':['午'],'丁':['未'],'己':['未'],'庚':['酉'],'辛':['戌'],'壬':['亥'],'癸':['子'] };
            const t = map[bazi.day.gan] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    },
    {
        name: '指背', type: 'ji',
        desc: '主背后是非、小人暗算，名誉受损之忧',
        find: function(bazi) {
            // 年支查：申子辰指背未 寅午戌指背丑 巳酉丑指背辰 亥卯未指背戌
            const yz = bazi.year.zhi;
            const map = { '申':['未'],'子':['未'],'辰':['未'],'寅':['丑'],'午':['丑'],'戌':['丑'],'巳':['辰'],'酉':['辰'],'丑':['辰'],'亥':['戌'],'卯':['戌'],'未':['戌'] };
            const t = map[yz] || [];
            const f = []; ['year','month','day','hour'].forEach(p => { if(t.includes(bazi[p].zhi)) f.push(p); });
            return f;
        }
    }
];


/**
 * 计算所有神煞
 */
function calculateShenSha(bazi) {
    const results = [];
    const posNames = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };

    SHEN_SHA_DEFS.forEach(def => {
        const positions = def.find(bazi);
        if (positions.length > 0) {
            results.push({
                name: def.name,
                type: def.type,
                desc: def.desc,
                positions: positions,
                posText: positions.map(p => posNames[p]).join('、')
            });
        }
    });

    return results;
}

// 导出函数

// 袁天罡称骨算命数据

// 年干支对应的骨重（两/钱）
const CHENGGU_YEAR = {
    '甲子':[1,2],'乙丑':[0,9],'丙寅':[0,6],'丁卯':[0,7],'戊辰':[1,2],'己巳':[0,5],'庚午':[0,9],'辛未':[0,8],'壬申':[0,7],'癸酉':[0,8],
    '甲戌':[1,5],'乙亥':[0,9],'丙子':[1,6],'丁丑':[0,8],'戊寅':[0,8],'己卯':[1,9],'庚辰':[1,2],'辛巳':[0,6],'壬午':[0,8],'癸未':[0,7],
    '甲申':[0,5],'乙酉':[1,5],'丙戌':[0,6],'丁亥':[1,6],'戊子':[1,5],'己丑':[0,7],'庚寅':[0,9],'辛卯':[1,2],'壬辰':[1,0],'癸巳':[0,7],
    '甲午':[1,5],'乙未':[0,6],'丙申':[0,5],'丁酉':[1,4],'戊戌':[1,4],'己亥':[0,9],'庚子':[0,7],'辛丑':[0,7],'壬寅':[0,9],'癸卯':[1,2],
    '甲辰':[0,8],'乙巳':[0,7],'丙午':[1,3],'丁未':[0,5],'戊申':[1,4],'己酉':[0,5],'庚戌':[0,9],'辛亥':[1,7],'壬子':[0,5],'癸丑':[0,7],
    '甲寅':[1,2],'乙卯':[0,8],'丙辰':[0,8],'丁巳':[0,6],'戊午':[1,9],'己未':[0,6],'庚申':[0,8],'辛酉':[1,6],'壬戌':[1,0],'癸亥':[0,6]
};

// 农历月份骨重
const CHENGGU_MONTH = [
    [0,6],[0,7],[1,8],[0,9],[0,5],[1,6],  // 正~六月
    [0,9],[1,5],[1,8],[0,8],[0,9],[0,5]   // 七~十二月
];

// 农历日期骨重 (初一~三十)
const CHENGGU_DAY = [
    [0,5],[1,0],[0,8],[1,5],[1,6],[1,5],[0,8],[1,6],[0,8],[1,6],  // 初一~初十
    [0,9],[1,7],[0,8],[1,7],[1,0],[0,8],[0,9],[1,8],[0,5],[1,0],  // 十一~二十
    [1,0],[0,9],[0,8],[0,9],[1,5],[1,8],[0,7],[0,8],[1,6],[0,6]   // 廿一~三十
];

// 时辰骨重
const CHENGGU_HOUR = [
    [1,6],[0,6],[0,7],[1,0],[0,9],[1,6],  // 子~巳
    [1,0],[0,8],[0,8],[0,9],[0,6],[0,6]   // 午~亥
];

// 称骨歌诀 (男命版)
const CHENGGU_GE = {
    '2.1': { ming: '二两一', geju: '终身困苦之命', duan: '短命非业谓大空，平生灾难事重重；凶祸频临陷逆境，终世困苦事不成。' },
    '2.2': { ming: '二两二', geju: '终身困苦之命', duan: '身寒骨冷苦伶仃，此命推来生乞人。碌碌巴巴无度日，终年打拱过平年。' },
    '2.3': { ming: '二两三', geju: '终身困苦之命', duan: '此命推来骨自轻，求谋作事事难成。妻儿兄弟应难许，别作散人处他乡。' },
    '2.4': { ming: '二两四', geju: '终身困苦之命', duan: '此命推来福禄无，门庭困苦总难营。六亲骨肉皆无靠，流到他乡作老翁。' },
    '2.5': { ming: '二两五', geju: '终身勤劳之命', duan: '此命推来祖业微，门庭营度似稀奇。六亲骨肉如冰炭，一生勤劳自把持。' },
    '2.6': { ming: '二两六', geju: '平凡衣禄之命', duan: '平生衣禄苦中求，独自经营事不休。离祖出门宜早计，晚来衣禄自无忧。' },
    '2.7': { ming: '二两七', geju: '独立成家之命', duan: '一生作事少商量，难靠祖宗作主张。独马单枪空做去，早来晚岁部无长。' },
    '2.8': { ming: '二两八', geju: '漂泊不定之命', duan: '一生作事似飘蓬，祖宗产业在梦中。若不过房并改姓，也当移徙两三通。' },
    '2.9': { ming: '二两九', geju: '初年不顺之命', duan: '初年运限未曾享，纵有功名在后底。须过四旬绕可上，移居改姓始为良。' },
    '3.0': { ming: '三两', geju: '忙碌求财之命', duan: '劳劳碌碌苦中求，东走西奔何日休。若使终身勤与俭，老来稍可免忧愁。' },
    '3.1': { ming: '三两一', geju: '渐入佳境之命', duan: '忙忙碌碌苦中求，何日云开见日头。难得祖基家可立，中年衣食渐无忧。' },
    '3.2': { ming: '三两二', geju: '中年发迹之命', duan: '初年运蹇事难谋，渐有财源如水流。到得中年衣食旺，那时名利一齐来。' },
    '3.3': { ming: '三两三', geju: '先难后成之命', duan: '早年做事事难成，百计徒劳枉费心。半世自如流水去，后来运到得黄金。' },
    '3.4': { ming: '三两四', geju: '佛门衣禄之命', duan: '此命福气果如何，僧道门中衣禄多。离祖出家方得妙，终朝拜佛念彌陀。' },
    '3.5': { ming: '三两五', geju: '平稳福禄之命', duan: '平生福量不周全，祖业根基觉少传。营业生涯宜守旧，时来衣食胜从前。' },
    '3.6': { ming: '三两六', geju: '福气安稳之命', duan: '不须劳碌过平生，独自成家福不轻。早有福星常照命，任君行去百般成。' },
    '3.7': { ming: '三两七', geju: '独立自成之命', duan: '此命般般事不成，弟兄少力自孤成。虽然祖业须微有，来得明时去得明。' },
    '3.8': { ming: '三两八', geju: '清高显达之命', duan: '一生骨肉最清高，早入黄门姓名标。待看看将三十六，蓝袍脱去换红袍。' },
    '3.9': { ming: '三两九', geju: '平凡有余之命', duan: '此命终身运不穷，劳劳作事尽皆空。苦心竭力成家计，到得那时在梦中。' },
    '4.0': { ming: '四两', geju: '晚景享福之命', duan: '生平衣禄是绵长，件件心中自主张。前面风霜多受过，后来必定享安康。' },
    '4.1': { ming: '四两一', geju: '中年逍遥之命', duan: '此命推来事不同，为人能干略凡庸。中年还有逍遥福，不比前年运未通。' },
    '4.2': { ming: '四两二', geju: '名利双收之命', duan: '得宽怀处且宽怀，何用双眉皱不开。若使中年命运济，那时名利一齐来。' },
    '4.3': { ming: '四两三', geju: '聪明福禄之命', duan: '为人心性最聪明，作事轩昂近贵人。衣禄一生天数定，不须劳碌是丰享。' },
    '4.4': { ming: '四两四', geju: '晚景顺遂之命', duan: '来事由天莫苦求，须知福禄胜前途。当年财帛难如意，晚景欣然便不忧。' },
    '4.5': { ming: '四两五', geju: '奔波劳碌之命', duan: '名利推来竟若何，前途辛苦后奔波。命中难养男与女，骨肉扶持也不多。' },
    '4.6': { ming: '四两六', geju: '稳中有成之命', duan: '东西南北尽皆空，出姓移名更觉隆。衣禄无亏天数定，中年晚景一般同。' },
    '4.7': { ming: '四两七', geju: '妻荣子贵之命', duan: '此命推来旺末年，妻荣子贵自怡然。平生原有滔滔福，可有财源如水源。' },
    '4.8': { ming: '四两八', geju: '晚年成就之命', duan: '幼年运道未曾享，若是蹉跎再不兴。兄弟六亲皆无靠，一身事业晚年成。' },
    '4.9': { ming: '四两九', geju: '自立显贵之命', duan: '此命推来福不轻，自成自立耀门庭。从来富贵人亲近，使婢差奴过一生。' },
    '5.0': { ming: '五两', geju: '晚年发达之命', duan: '为名为利终日劳，中年福禄也多遭。老来是有财星照，不比前番日下高。' },
    '5.1': { ming: '五两一', geju: '一世荣华之命', duan: '一世荣华事事通，不须劳碌自享丰。弟兄叔侄皆如意，家业成时福禄宏。' },
    '5.2': { ming: '五两二', geju: '家业丰厚之命', duan: '一世享通事事能，不须劳思自然能。家族欣然心皆好，家业丰享自称心。' },
    '5.3': { ming: '五两三', geju: '富贵显达之命', duan: '此格推来气像真，兴家发达在其中。一生福禄安排家，欲是人间一富翁。' },
    '5.4': { ming: '五两四', geju: '福禄双全之命', duan: '此命推来厚且清，诗画满腹看功成。丰衣足食自然稳，正是人间有福人。' },
    '5.5': { ming: '五两五', geju: '名利双收之命', duan: '走马扬鞭争名利，少年做事费筹谋。一朝福禄源源至，富贵荣华耀六亲。' },
    '5.6': { ming: '五两六', geju: '财源滚滚之命', duan: '此格推来礼义通，一生福禄用无穷。甜酸苦辣皆尝过，财源滚滚稳且丰。' },
    '5.7': { ming: '五两七', geju: '威名显赫之命', duan: '福禄丰盈万事全，一生荣耀显双亲。名扬威振人钦敬，处世逍遥似遇春。' },
    '5.8': { ming: '五两八', geju: '金榜题名之命', duan: '平生福禄自然来，名利双全福禄偕。雁塔题名为贵客，紫袍玉带走金阶。' },
    '5.9': { ming: '五两九', geju: '财礼通达之命', duan: '细推此格妙且清，必定财高礼义通。甲第之中应有分，扬鞭走马显威荣。' },
    '6.0': { ming: '六两', geju: '显祖荣宗之命', duan: '一朝金榜快题名，显祖荣宗立大功。衣食定然原裕足，田园财帛更丰盛。' },
    '6.1': { ming: '六两一', geju: '富贵双全之命', duan: '不作朝中金榜客，定为世上一财翁。聪明天赋经书熟，名显高科自是荣。' },
    '6.2': { ming: '六两二', geju: '卿相之命', duan: '此命推来福不穷，读书必定显亲宗。紫衣金带为卿相，富贵荣华皆可同。' },
    '6.3': { ming: '六两三', geju: '高科显贵之命', duan: '命主为官福禄长，得来富贵定非常。名题雁塔传金榜，定中高科天下扬。' },
    '6.4': { ming: '六两四', geju: '威权富贵之命', duan: '此格威权不可挡，紫袍金带坐高望。荣华富贵虽能及，积玉堆金满储仓。' },
    '6.5': { ming: '六两五', geju: '极品贵人之命', duan: '细推此命福不轻，安国安邦极品人。文纷雕梁徽富贵，威声照耀四方闻。' },
    '6.6': { ming: '六两六', geju: '福寿双全之命', duan: '此格人间一福人，堆金积玉满堂春。从来富贵由天定，正勿垂绅谒圣君。' },
    '6.7': { ming: '六两七', geju: '富贵荣华之命', duan: '此命生来福自宏，田园家业最高隆。平生衣禄丰盈足，一世荣华万事通。' },
    '6.8': { ming: '六两八', geju: '祖业重振之命', duan: '富贵由大莫苦求，万金家计不须谋。十年不比前番事，祖业根基水上舟。' },
    '6.9': { ming: '六两九', geju: '安享富贵之命', duan: '君是人间前禄星，一生富贵众人钦。纵然福禄由天定，安享荣华过一生。' },
    '7.0': { ming: '七两', geju: '富贵极品之命', duan: '此命推来福不轻，不须愁虑苦劳心。一生天定衣与禄，富贵荣华主一生。' },
    '7.1': { ming: '七两一', geju: '公侯卿相之命', duan: '此命生来大不同，公侯卿相在其中。一生自有逍遥福，富贵荣华极品隆。' },
    '7.2': { ming: '七两二', geju: '天子之命', duan: '此命推来天下隆，必定人间一主公。富贵荣华数不尽，定为乾坤一蛟龙。' }
};


/**
 * 袁天罡称骨算命
 * @param {object} bazi - 八字对象
 * @param {number} birthMonth - 出生的阳历月份（用于估算农历月）
 * @param {number} birthDay - 出生的阳历日期（用于估算农历日）
 */
function calculateChengGu(bazi, birthMonth, birthDay) {
    const SHI_NAMES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
    const yearGZ = bazi.year.gan + bazi.year.zhi;
    const yearWt = CHENGGU_YEAR[yearGZ] || [0, 0];
    const monthWt = CHENGGU_MONTH[birthMonth - 1] || [0, 0];
    const dayIdx = Math.min(birthDay, 30) - 1;
    const dayWt = CHENGGU_DAY[dayIdx] || [0, 0];
    const hourWt = CHENGGU_HOUR[bazi.birthDate.hour] || [0, 0];

    const totalQian = yearWt[1] + monthWt[1] + dayWt[1] + hourWt[1];
    const totalLiang = yearWt[0] + monthWt[0] + dayWt[0] + hourWt[0] + Math.floor(totalQian / 10);
    const finalQian = totalQian % 10;

    const weightKey = totalLiang + '.' + finalQian;
    const geyao = CHENGGU_GE[weightKey] || null;

    return {
        yearWt: yearWt, monthWt: monthWt, dayWt: dayWt, hourWt: hourWt,
        totalLiang: totalLiang,
        totalQian: finalQian,
        weightStr: totalLiang + '两' + finalQian + '钱',
        weightKey: weightKey,
        geyao: geyao || { ming: weightKey + '两', geju: '未收录', duan: '暂无对应歌诀，可在网上查询更多资料。' },
        breakdown: {
            year: yearWt[0] + '两' + yearWt[1] + '钱（' + yearGZ + '年）',
            month: monthWt[0] + '两' + monthWt[1] + '钱（' + birthMonth + '月）',
            day: dayWt[0] + '两' + dayWt[1] + '钱（' + birthDay + '日）',
            hour: hourWt[0] + '两' + hourWt[1] + '钱（' + SHI_NAMES[bazi.birthDate.hour] + '时）'
        }
    };
}



// ==================== 滴天髓 · 十天干 ====================
const DITIANSUI = {
  '甲': {
    shi: '甲木参天，脱胎要火。春不容金，秋不容土。火炽乘龙，水宕骑虎。地润天和，植立千古。',
    yuanzhu: '甲木为纯阳之木，参天雄壮，如松柏栋梁。春生木旺不容金克，秋生金旺木衰，亦不容土来生金。火过旺时宜见辰土（湿土）收火归库；水泛滥时宜见寅木（东方）纳水。天地调润、寒暖中和，方能万古长青。',
    jiexi: [
      { ju: '甲木参天', yi: '甲木如参天大树，挺拔伟岸，主仁德正直、领袖气质。' },
      { ju: '脱胎要火', yi: '甲木须火（子女、才华）煅炼方成材——火为木之食伤，能泄秀发光。' },
      { ju: '春不容金', yi: '春季木旺，金（官杀）来克木反被木侮，不宜强金制约。' },
      { ju: '秋不容土', yi: '秋季金旺，木已衰败，不宜再增土来生金制木。' },
      { ju: '火炽乘龙', yi: '火过旺时赖辰土（龙）湿土晦火养木，取调候中和。' },
      { ju: '水宕骑虎', yi: '水泛滥时赖寅木（虎）纳水生木，化水为生机。' }
    ]
  },
  '乙': {
    shi: '乙木虽柔，刲羊解牛。怀丁抱丙，跨凤乘猴。虚湿之地，骑马亦忧。藤萝系甲，可春可秋。',
    yuanzhu: '乙木为花草藤萝之木，阴柔有韧。坐丑未（羊牛）能制柔土——如以刀割羊、解牛一般轻松。得丙丁火暖照，即使生申酉月（凤猴·秋金）也能从容。但生于子月水旺虚湿之地，即使坐午（马）火也堪忧。若多见甲木与寅支，如藤萝攀附乔木，春秋皆可不畏摧折。',
    jiexi: [
      { ju: '乙木虽柔', yi: '乙木如花草藤萝，柔韧灵动，善借势生长，主谋略与适应性。' },
      { ju: '刲羊解牛', yi: '乙木坐丑（牛）未（羊）能柔克燥土——如藤蔓渗透土石，以柔制刚。' },
      { ju: '怀丁抱丙', yi: '须丙丁火（食伤/才华）温暖照亮，方能开花结果、才华外显。' },
      { ju: '跨凤乘猴', yi: '有火则不畏秋金（申酉·凤猴），金反成修剪之力使木成器。' },
      { ju: '虚湿之地', yi: '子月水旺之地阴冷过甚，即使坐午火也难以挽回生机——湿木难燃。' },
      { ju: '藤萝系甲', yi: '喜得甲木为靠——如藤萝攀大树，不惧春秋更迭，能借势而上。' }
    ]
  },
  '丙': {
    shi: '丙火猛烈，欺霜侮雪。能煅庚金，逢辛反怯。土众成慈，水猖显节。虎马犬乡，甲木若来，必当焚灭。',
    yuanzhu: '丙火为太阳之火，阳之至也，猛烈无比。不畏秋霜冬雪，能以猛火煅炼顽金（庚），但遇辛金合化反失其刚。见戊己土多则慈爱宽厚（火生土为母慈子）。遇壬癸水旺不惧，反显忠节之风（水为君，火为臣）。若寅午戌（虎马犬）三合火局再加甲木，则木焚火灭——过犹不及。',
    jiexi: [
      { ju: '丙火猛烈', yi: '丙火为太阳之精，炽烈光明，主热情大方、感染力与权威。' },
      { ju: '能煅庚金', yi: '丙火能炼化顽金（庚），以威服人——领导力与改造力的体现。' },
      { ju: '逢辛反怯', yi: '遇辛金相合（丙辛化水），刚烈之气化柔，反失本色。' },
      { ju: '土众成慈', yi: '土多泄火土厚，转刚为柔，反生慈爱宽厚之德。' },
      { ju: '水猖显节', yi: '水（官杀）来制火，反激其忠烈——逆境中更显气节。' }
    ]
  },
  '丁': {
    shi: '丁火柔中，内性昭融。抱乙而孝，合壬而忠。旺而不烈，衰而不穷。如有嫡母，可秋可冬。',
    yuanzhu: '丁火为炉火、灯烛之火，阴柔中正。外表柔顺而内里光明。丁得乙木生养如母子相依，情深意切；合壬水化木，则外抚戊土使不欺壬，内化木助火，忠义两全。旺时不致灼烈，衰时不致熄灭。秋冬季只要得甲木（嫡母）扶持，便能长燃不灭。',
    jiexi: [
      { ju: '丁火柔中', yi: '丁火如灯烛炉火，柔而有光，主细心、智慧与内在温暖。' },
      { ju: '内性昭融', yi: '外表温和而内心明亮通融——善于洞察而不张扬。' },
      { ju: '抱乙而孝', yi: '得乙木生养，如母慈子孝——需木（印绶）来延续光明。' },
      { ju: '旺而不烈', yi: '旺时不会过于猛烈灼人，始终留有分寸——持中之德。' },
      { ju: '衰而不穷', yi: '衰时如有甲木相助（嫡母），秋冬亦不灭——韧性极强。' }
    ]
  },
  '戊': {
    shi: '戊土固重，既中且正。静翕动辟，万物司命。水润物生，火燥物病。若在艮坤，怕冲宜静。',
    yuanzhu: '戊土为城墙厚土、高岗之土，阳刚中正。春夏开辟生养万物，秋冬闭合成就万物，主宰生物之命。喜水润泽则万物生长，忌火过燥则物枯生病。坐寅（艮）怕申冲，坐申（坤）怕寅冲——冲则根基动摇，故宜静不宜冲。',
    jiexi: [
      { ju: '戊土固重', yi: '戊土如大地山峦，厚重诚信，主稳重、包容、执着。' },
      { ju: '静翕动辟', yi: '静时含蓄蓄势，动时开辟生养——厚德载物之象。' },
      { ju: '水润物生', yi: '喜水（财星）润泽方能生养万物——财能养命。' },
      { ju: '火燥物病', yi: '火过旺则焦土裂物——印过重反成负累，需水调候。' },
      { ju: '怕冲宜静', yi: '寅申相冲则根基动摇——忌地支冲击，宜守成稳定。' }
    ]
  },
  '己': {
    shi: '己土卑湿，中正蓄藏。不愁木盛，不畏水狂。火少火晦，金多金光。若要物旺，宜助宜帮。',
    yuanzhu: '己土为田园之土，卑软湿润，能蓄藏万物养分。柔土生木而非木所克，故不怕木旺；土厚纳水而非水所荡，故不惧水狂。无根之火不能生湿土，反被晦暗；但湿土能润金，使金光泽倍增。若要万物丰盛，须土势深固加火暖身。',
    jiexi: [
      { ju: '己土卑湿', yi: '己土如田园沃土，柔润滋养，主温和细腻、善于栽培。' },
      { ju: '中正蓄藏', yi: '居中正之位，善于蓄藏——内敛有内涵，不争锋芒。' },
      { ju: '不愁木盛', yi: '柔土生木为主而非被克——木旺反显栽培之功。' },
      { ju: '不畏水狂', yi: '土厚纳水而不泛滥——包容力强，能化险为夷。' },
      { ju: '宜助宜帮', yi: '须火暖土、土助土方能万物丰茂——贵在扶持与协作。' }
    ]
  },
  '庚': {
    shi: '庚金带煞，刚健为最。得水而清，得火而锐。土润则生，土干则脆。能赢甲兄，输于乙妹。',
    yuanzhu: '庚金为刀剑斧钺之金，阳刚带煞气，刚猛无匹。得水淘洗则更加清澈锋利；得火煅炼则更加锐不可当。湿土（辰丑）能生金，燥土（戌未）反脆金。能克甲木（兄）但遇乙木相合（乙庚合）反而失去刚锐。',
    jiexi: [
      { ju: '庚金带煞', yi: '庚金如刀剑利器，刚猛果断，主决断力与竞争心。' },
      { ju: '得水而清', yi: '得水（食伤）淘洗更加清澈——才华外显方显锋芒。' },
      { ju: '得火而锐', yi: '得火（官杀）煅炼更加锐利——经磨砺方能成器。' },
      { ju: '土润则生', yi: '湿土（辰丑）才能生金——贵人扶持需得滋养之助。' },
      { ju: '能赢甲兄', yi: '能克甲木（兄），以刚制刚——但遇乙相合则柔情化煞。' }
    ]
  },
  '辛': {
    shi: '辛金软弱，温润而清。畏土之叠，乐水之盈。能扶社稷，能救生灵。热则喜母，寒则喜丁。',
    yuanzhu: '辛金为首饰珠玉之金，温软清润。忌厚土（戊己多）埋金令其暗淡；喜水（壬癸）充盈则金愈光彩。合丙化水能扶社稷（匡扶君上），合丙也能救甲木免焚（生灵）。生于盛夏须己土晦火护金（母）；生于隆冬须丁火暖金（炉火温养）。',
    jiexi: [
      { ju: '辛金软弱', yi: '辛金如珠玉首饰，细腻灵敏，主精致、审美与修养。' },
      { ju: '畏土之叠', yi: '忌厚土埋金暮气沉沉——不宜过多束缚，需保持清透。' },
      { ju: '乐水之盈', yi: '喜水涓涓浸润，珠宝愈泽——才华舒展放光。' },
      { ju: '能扶社稷', yi: '合丙化水能成调解之力——柔中寓刚，协调左右。' },
      { ju: '寒则喜丁', yi: '寒冬须炉火（丁）温暖——低谷时需要知遇扶持之助。' }
    ]
  },
  '壬': {
    shi: '壬水通河，能泄金气。刚中之德，周流不滞。通根透癸，冲天奔地。化则有情，从则相济。',
    yuanzhu: '壬水为江河大海之水，发源于昆仑（申为天河之口，壬长生于此），得此泄西方金气，流动不息。申子辰全又透癸则势如滔天洪水不可遏止。合丁化木再助丁火则为有情；夏季从火土之旺势，熏蒸化雨露，反成相济之功。',
    jiexi: [
      { ju: '壬水通河', yi: '壬水如江河奔流，气势磅礴，主智慧圆通与变通力。' },
      { ju: '刚中之德', yi: '流动不息却内守中正——外表灵活而内心坚定。' },
      { ju: '周流不滞', yi: '喜流动不滞涩——宜主动求变，最忌死水一潭。' },
      { ju: '冲天奔地', yi: '水势过旺则泛滥——才力充沛也需引导，防过犹不及。' },
      { ju: '化则有情', yi: '合丁化木、从火成雨——善化能融，贵人缘佳。' }
    ]
  },
  '癸': {
    shi: '癸水至弱，达于天津。得龙而运，功化斯神。不愁火土，不论庚辛。合戊见火，化象斯真。',
    yuanzhu: '癸水为雨露之水、阴中之至柔。通于天河，随天运布雨。得辰（龙）托根能成云雨，润泽万物，变化无穷。不愁火土旺（有木运化则火土自调），不论庚辛（不赖金生也不忌金多）。合戊化火，得丙丁引化则格成真——至阴化至阳，变化之极。',
    jiexi: [
      { ju: '癸水至弱', yi: '癸水如雨露甘霖，至阴至柔，主细腻感知与深层智慧。' },
      { ju: '达于天津', yi: '通于天河——看似柔弱实通天地，潜力无限。' },
      { ju: '得龙而运', yi: '得辰（龙）托根方能行云布雨——需根基与机缘相助。' },
      { ju: '不愁火土', yi: '有木运化则火土不惧——善用转圜之法，化克为生。' },
      { ju: '合戊见火', yi: '合戊化火方显真象——至柔可变至刚，变化之道在其合。' }
    ]
  }
};



// ==================== 夫妻宫分析 ====================
function analyzePei(bazi) {
    const dayGan = bazi.day.gan;
    const dayZhi = bazi.day.zhi;
    const cangGan = getCangGan(dayZhi);
    // 取本气（第一个藏干）作为夫妻宫主要十神
    const mainCG = cangGan[0];
    const ss = getShiShen(dayGan, mainCG);
    const allSS = cangGan.map(cg => getShiShen(dayGan, cg));

    const traits = {
        '正官': '配偶品性端正、有责任感和正义感，可能从事公职或管理工作，行事有规矩，重视名誉和社会地位。',
        '七杀': '配偶性格强势、果敢有魄力，有领导才能但也可能有霸道倾向。若为喜用则得良夫/贤妻，为忌则有压力和争执。',
        '正财': '配偶勤俭持家、善于理财，对家庭物质生活重视，是比较传统务实型的伴侣。男命正财为妻，感情较为稳定。',
        '偏财': '配偶大方豪爽、社交能力强，在财务上有商业头脑，但也可能有冲动消费倾向，不拘小节。',
        '正印': '配偶温和包容、善良体贴，像长辈一样呵护和照顾你，有很强的情感包容度，家庭氛围温馨。',
        '偏印': '配偶聪明机敏、思想独特，有特殊的才华或技能，可能在专业领域有所建树，但有时也显得孤僻。',
        '食神': '配偶性情温厚、随和享受，有艺术气质或文学才华，喜欢安逸舒适的生活，不喜争斗和压力。',
        '伤官': '配偶才华出众、个性独立，有强烈的表现欲和创造力，但也可能情绪敏感、要求高。女命伤官需防克夫。',
        '比肩': '两人性格相似，如同知己和战友，有共同的兴趣和价值观，相处模式像朋友一般自由。但可能缺少激情。',
        '劫财': '两人性格相近但有竞争，相处更像合作伙伴，需要注意避免因个性冲突带来的争执，保持彼此空间。'
    };

    const trait = traits[ss] || '夫妻宫十神较为中和，配偶性格圆融，没有极端倾向。';

    // 配偶样貌
    const looks = {
        '正官': '配偶五官端正、气质沉稳，面相有正气，眉目清秀，身高体型匀称，举止端庄有分寸，给人可靠的安全感。',
        '七杀': '配偶面庞线条分明，眼神犀利有神，气质威严，身材精干或偏瘦，外表有英气和攻击性，走在人群中也比较引人注目。',
        '正财': '配偶面相敦厚朴实，五官圆润柔和，体型偏结实或微胖，打扮低调实际，整体给人踏实可靠的感觉。',
        '偏财': '配偶外表大方得体，面带福相，体型适中或偏丰满，穿着有品味，社交场合中显得游刃有余，有一股富贵气。',
        '正印': '配偶面容温和慈善，皮肤白净，气质文雅，举止从容，可能偏丰满或骨架较大，整体给人一种温暖包容的感觉。',
        '偏印': '配偶相貌清秀独特，眼神灵动，五官精致，可能偏瘦或身材纤细，气质文静中带着一丝灵气，有种书卷气或艺术范儿。',
        '食神': '配偶面相和善圆润，笑起来有亲和力，体型偏丰润或微胖，气质轻松自在，给人一种舒适悠闲的印象。',
        '伤官': '配偶相貌出众，五官立体分明，气质独特有锋芒，身材适中或偏瘦，打扮时尚有个性，容易让人眼前一亮。',
        '比肩': '配偶与你相貌气质相似，两人站在一起很有夫妻相，五官端正大方，体型匀称，整体给人一种势均力敌的感觉。',
        '劫财': '配偶五官分明，有独立个性，气质爽朗直率，身材偏精瘦或结实，不喜过分修饰，休闲打扮为主，看起来精力充沛。'
    };
    const spLooks = looks[ss] || '配偶相貌中等，没有突出的外形特征，属于耐看型。';

    return {
        dayZhi: dayZhi,
        cangGan: cangGan,
        mainSS: ss,
        trait: trait,
        looks: spLooks
    };
}

// ==================== 配偶年龄大小判断 ====================
function calculateSpouseAge(bazi, peiSS) {
    // 统计全局十神倾向
    const DAY = bazi.day.gan;
    const BIG = ['正官','七杀','正印','偏印'];
    const SMALL = ['食神','伤官','正财','偏财'];
    const SAME = ['比肩','劫财'];

    let bigCount = 0, smallCount = 0, sameCount = 0;
    const pillars = ['year','month','day','hour'];

    pillars.forEach(pos => {
        // 天干十神
        const ganSS = getShiShen(DAY, bazi[pos].gan);
        if (BIG.includes(ganSS)) bigCount++;
        if (SMALL.includes(ganSS)) smallCount++;
        if (SAME.includes(ganSS)) sameCount++;

        // 地支藏干本气十神
        const cg = getCangGan(bazi[pos].zhi);
        cg.forEach(g => {
            const ss = getShiShen(DAY, g);
            if (BIG.includes(ss)) bigCount++;
            if (SMALL.includes(ss)) smallCount++;
            if (SAME.includes(ss)) sameCount++;
        });
    });

    // 日支单独加分（夫妻宫权重加倍）
    const dayCG = getCangGan(bazi.day.zhi);
    dayCG.forEach(g => {
        const ss = getShiShen(DAY, g);
        if (BIG.includes(ss)) bigCount++;
        if (SMALL.includes(ss)) smallCount++;
        if (SAME.includes(ss)) sameCount++;
    });

    let result, desc, detail;
    if (bigCount > smallCount && bigCount > sameCount) {
        result = '年龄偏大';
        desc = '配偶很可能比命主年长';
        detail = '命局中「官杀·印星」占优势（大十神倾向），说明命主在择偶上容易被成熟稳重、有阅历的人吸引。对方可能在事业上给予引导，或性格如长辈般包容呵护。';
    } else if (smallCount > bigCount && smallCount > sameCount) {
        result = '年龄偏小';
        desc = '配偶很可能比命主年轻';
        detail = '命局中「食伤·财星」占优势（小十神倾向），说明命主天性活泼开放，喜欢年轻有活力的伴侣。对方可能更依赖命主，或相处方式中命主占据主导位置。';
    } else {
        result = '年龄相仿';
        desc = '配偶与命主年龄相仿（±5岁以内）';
        detail = '命局中「比劫」星占优势或十神分布均衡，说明命主倾向于找同龄人或年龄非常接近的伴侣。两人地位平等、志趣相投，更像知己和战友的关系。';
    }

    // 日支补充判断
    const dayPeiSS = getShiShen(DAY, getCangGan(bazi.day.zhi)[0]);
    let dayZhiNote = '';
    if (['正印','偏印'].includes(dayPeiSS)) {
        dayZhiNote = '另外，日坐印星也暗示配偶有长者之风，年龄偏大的概率更高。';
    } else if (['食神','伤官'].includes(dayPeiSS)) {
        dayZhiNote = '另外，日坐食伤也暗示配偶有孩童气，年龄偏小的概率更高。';
    } else if (['比肩','劫财'].includes(dayPeiSS)) {
        dayZhiNote = '另外，日坐比劫也暗示两人旗鼓相当，年龄接近的概率更大。';
    }

    // ========== 配偶远近分析 ==========
    let spousePos = [];      // 配偶星出现位置
    let spousePosDetail = '';
    let distanceText = '';
    let distanceLabel = '';
    const spouseStars = ['正官','七杀','正财','偏财'];

    ['year','month','day','hour'].forEach(pos => {
        const posCN = { year:'年柱', month:'月柱', day:'日柱', hour:'时柱' };
        const ganSS = getShiShen(DAY, bazi[pos].gan);
        if (spouseStars.includes(ganSS)) {
            spousePos.push(posCN[pos] + '干');
        }
        const cg = getCangGan(bazi[pos].zhi);
        cg.forEach(g => {
            const ss = getShiShen(DAY, g);
            if (spouseStars.includes(ss)) {
                spousePos.push(posCN[pos] + '支');
            }
        });
    });

    // 判断距离远近
    if (spousePos.some(p => p.startsWith('年'))) {
        distanceLabel = '远方';
        distanceText = '配偶星落在年柱，预示另一半很可能来自远方或外省——可能是异地求学、工作中结识，或者籍贯与你相距较远。姻缘颇有「千里相逢」的意味。';
    } else if (spousePos.some(p => p.startsWith('日'))) {
        distanceLabel = '身边';
        distanceText = '配偶星落在日柱，预示另一半很可能就在你身边——同学、同事、朋友或日常接触密切的人，在朝夕相处中自然而然地走到一起。';
    } else if (spousePos.some(p => p.startsWith('时'))) {
        distanceLabel = '远方';
        distanceText = '配偶星落在时柱，预示姻缘来得较晚，且另一半可能来自外地或年龄与你相差较大。晚婚之象，但缘分深厚。';
    } else if (spousePos.some(p => p.startsWith('月'))) {
        distanceLabel = '近处';
        distanceText = '配偶星落在月柱，预示另一半很可能来自同城或邻近地区——通过亲友介绍、相亲或在本地活动中认识的机率较大。';
    } else {
        distanceLabel = '中等';
        distanceText = '配偶星分布较为分散或未明显显现，远近没有明显倾向，顺其自然即可。';
    }

    // 冲合与驿马星补充
    const yearZhi = bazi.year.zhi;
    const monthZhi = bazi.month.zhi;
    const dayZhi = bazi.day.zhi;
    const CHONG = { '子午':true,'午子':true,'丑未':true,'未丑':true,'寅申':true,'申寅':true,'卯酉':true,'酉卯':true,'辰戌':true,'戌辰':true,'巳亥':true,'亥巳':true };
    const HE = { '子丑':true,'丑子':true,'寅亥':true,'亥寅':true,'卯戌':true,'戌卯':true,'辰酉':true,'酉辰':true,'巳申':true,'申巳':true,'午未':true,'未午':true };
    const YIMA = ['寅','申','巳','亥'];
    let hasYiMa = YIMA.includes(dayZhi);
    let chongNote = '';
    let heNote = '';

    if (CHONG[yearZhi + monthZhi]) { chongNote = '年月相冲加大了异地缘分，未来可能有奔波或两地分居的考验。'; }
    if (CHONG[dayZhi + monthZhi] || CHONG[dayZhi + yearZhi]) { chongNote = '夫妻宫受冲，婚姻中聚少离多的可能性较高。'; }
    if (HE[dayZhi + yearZhi]) { heNote = '日柱与年柱相合，异地缘也可拉近距离，婚后家庭趋于稳定。'; }
    if (HE[dayZhi + monthZhi]) { heNote = '日柱与月柱相合，近处姻缘更加稳固。'; }
    if (hasYiMa) { distanceText += ' 另外，日支带驿马星，配偶可能经常出差或流动性较强。'; }
    if (chongNote) { distanceText += ' ' + chongNote; }
    if (heNote) { distanceText += ' ' + heNote; }

    // ========== 认识方式分析 ==========
    const dayPeiSS2 = getShiShen(DAY, getCangGan(bazi.day.zhi)[0]);
    let meetingLabel = '', meetingText = '';
    const JIESHAO = ['正官','正印'];       // 正式渠道
    const ZIYOU = ['食神','伤官'];         // 自由恋爱
    const TONGXUE = ['比肩','劫财'];       // 同学朋友
    const GONGZUO = ['七杀','偏财','偏印']; // 工作/社交

    // 看全局十神倾向决定认识方式
    const allSSList = [];
    pillars.forEach(pos => {
        allSSList.push(getShiShen(DAY, bazi[pos].gan));
        getCangGan(bazi[pos].zhi).forEach(g => { allSSList.push(getShiShen(DAY, g)); });
    });

    let jieCount = 0, ziCount = 0, tongCount = 0, gongCount = 0;
    allSSList.forEach(ss => {
        if (JIESHAO.includes(ss)) jieCount++;
        if (ZIYOU.includes(ss)) ziCount++;
        if (TONGXUE.includes(ss)) tongCount++;
        if (GONGZUO.includes(ss)) gongCount++;
    });

    const maxMeet = Math.max(jieCount, ziCount, tongCount, gongCount);
    if (maxMeet === jieCount && jieCount > ziCount + 1) {
        meetingLabel = '亲友介绍';
        meetingText = '命局中官印气质突出，认识配偶的方式比较传统和正式——经亲友长辈介绍、相亲或团体活动中结识的概率较大。对方可能通过你的人脉圈进入你的生活。';
    } else if (maxMeet === ziCount && ziCount > jieCount + 1) {
        meetingLabel = '自由恋爱';
        meetingText = '命局中食伤气质突出，认识配偶的方式更偏向自由恋爱——在兴趣爱好场合、旅行、网上或偶然邂逅中认识，感情由你主动推进。';
    } else if (maxMeet === tongCount && tongCount > gongCount) {
        meetingLabel = '同学朋友';
        meetingText = '命局中比劫气质突出，配偶很可能是老同学、老友或通过共同圈子认识的人，你们有相似的成长背景和价值观，日久生情。';
    } else if (maxMeet === gongCount && gongCount >= jieCount && gongCount >= ziCount) {
        meetingLabel = '工作场合';
        meetingText = '命局中财官明显，另一半很可能来自工作场合、商务社交或事业合作伙伴圈子。你们因共同的奋斗目标走到一起。';
    } else {
        // 混合型 - 看日支十神
        if (JIESHAO.includes(dayPeiSS2)) {
            meetingLabel = '亲友介绍';
            meetingText = '夫妻宫官印的端庄气质，认识方式偏传统——通过亲友牵线、相亲或在正式社交场合结识的可能性较大。';
        } else if (ZIYOU.includes(dayPeiSS2)) {
            meetingLabel = '自由恋爱';
            meetingText = '夫妻宫食伤的灵动气质，认识方式偏自然浪漫——在日常生活中自己认识，或通过兴趣爱好结缘。';
        } else if (TONGXUE.includes(dayPeiSS2)) {
            meetingLabel = '同学朋友';
            meetingText = '夫妻宫比劫的亲缘气质，认识方式偏熟悉——来自同学、旧友或共同圈子，从朋友变为恋人。';
        } else {
            meetingLabel = '社交场合';
            meetingText = '夫妻宫财官气质交融，认识方式可能多样——工作、社交、或经人介绍均有概率。';
        }
    }

    return {
        bigCount: bigCount,
        smallCount: smallCount,
        sameCount: sameCount,
        result: result,
        desc: desc,
        detail: detail + (dayZhiNote ? ' ' + dayZhiNote : ''),
        dayZhiNote: dayZhiNote,
        distanceLabel: distanceLabel,
        distanceText: distanceText,
        meetingLabel: meetingLabel,
        meetingText: meetingText
    };
}

// ==================== 日主强弱判定（子平法标准：得令·得地·得势） ====================
/**
 * 子平法日主旺衰分析。
 * 三步判定：①得令（月令是否生扶）→ ②得地（地支通根）→ ③得势（天干比劫印星多寡）
 *
 * 五行流转: 木→火→土→金→水→木
 *   同我(比劫)  = index+0   我生(食伤/泄) = index+1
 *   我克(财/耗) = index+2   克我(官杀/克)   = index+3
 *   生我(印/助) = index+4  (等价于 index-1)
 *
 * @param {Object} bazi - { year:{gan,zhi}, month:{gan,zhi}, day:{gan,zhi}, hour:{gan,zhi} }
 * @returns {{ level:string, label:string, score:number }}
 */
function calcDayMasterStrength(bazi) {
  var dg = bazi.day.gan;
  var dgWx = WU_XING[dg];
  var WXL = ['木','火','土','金','水'];
  var di = WXL.indexOf(dgWx);

  // 五行关系映射: key = 日主五行, value = 目标五行
  // SHENGWO = "生我" (印), WOSHENG = "我生" (食伤), KEWO = "克我" (官杀), WOKE = "我克" (财)
  var SHENGWO = {}, WOSHENG = {}, KEWO = {}, WOKE = {};
  WXL.forEach(function(w, i) {
    SHENGWO[w] = WXL[(i + 4) % 5]; // 生我
    WOSHENG[w] = WXL[(i + 1) % 5]; // 我生
    KEWO[w]   = WXL[(i + 3) % 5]; // 克我
    WOKE[w]   = WXL[(i + 2) % 5]; // 我克
  });

  var score = 50; // 基准分

  // ---------- ① 得令：月令地支本气与日主关系 (权重最大) ----------
  var mwx = DI_ZHI_WU_XING[bazi.month.zhi];
  if (mwx === dgWx)            score += 30; // 得令 — 月令与日主同五行
  else if (SHENGWO[dgWx] === mwx) score += 20; // 相令 — 月令生我
  else if (WOSHENG[dgWx] === mwx) score -= 15; // 休令 — 我生月令（泄气）
  else if (WOKE[dgWx] === mwx)   score -= 10; // 囚令 — 我克月令（耗力）
  else if (KEWO[dgWx] === mwx)   score -= 25; // 死令 — 月令克我（最不利）

  // ---------- ② 得地：日支是否通根 ----------
  var dayZhiWx = DI_ZHI_WU_XING[bazi.day.zhi];
  if (dayZhiWx === dgWx)          score += 12; // 日支同五行（自坐强根）
  else if (SHENGWO[dgWx] === dayZhiWx) score += 8;  // 日支生日主
  else if (KEWO[dgWx] === dayZhiWx)   score -= 10; // 日支克日主

  // ---------- ③ 得势：各柱天干比劫/印星 vs 克泄耗 ----------
  ['year','month','day','hour'].forEach(function(pos) {
    var gwx = WU_XING[bazi[pos].gan];
    if (gwx === dgWx)            score += 6;  // 比肩劫财
    else if (SHENGWO[dgWx] === gwx) score += 4;  // 印星
    else if (KEWO[dgWx] === gwx)   score -= 4;  // 官杀
    else if (WOSHENG[dgWx] === gwx) score -= 3;  // 食伤（泄）
    else if (WOKE[dgWx] === gwx)   score -= 5;  // 财星（耗）
  });

  // ---------- ④ 地支藏干辅助 ----------
  ['year','month','day','hour'].forEach(function(pos) {
    var cg = getCangGan(bazi[pos].zhi);
    cg.forEach(function(g) {
      var gwx = WU_XING[g];
      if (gwx === dgWx)            score += 3; // 藏干比肩
      else if (SHENGWO[dgWx] === gwx) score += 2; // 藏干印星
    });
  });

  // ---------- ⑤ 分级输出 ----------
  var level, label;
  if (score >= 85)      { level = '极强'; label = '元气充沛'; }
  else if (score >= 65) { level = '偏强'; label = '元气较足'; }
  else if (score >= 45) { level = '中和'; label = '元气均衡'; }
  else if (score >= 35) { level = '偏弱'; label = '元气偏柔'; }
  else                  { level = '极弱'; label = '元气清秀'; }

  return { level: level, label: label, score: score };
}

// ==================== 父母关系分析（强化版） ====================
function analyzeParents(bazi, gender) {
    const DAY = bazi.day.gan;
    const DAY_WX = WU_XING[DAY];
    const isMale = gender === 'male';

    // === 0. 基础映射（内联，不依赖 hepan-core） ===
    const ZHI_CHONG = { '子':'午','午':'子','丑':'未','未':'丑','寅':'申','申':'寅','卯':'酉','酉':'卯','辰':'戌','戌':'辰','巳':'亥','亥':'巳' };
    const ZHI_HAI = { '子':'未','未':'子','丑':'午','午':'丑','寅':'巳','巳':'寅','卯':'辰','辰':'卯','申':'亥','亥':'申','酉':'戌','戌':'酉' };
    const ZHI_HE = { '子丑':1,'寅亥':1,'卯戌':1,'辰酉':1,'巳申':1,'午未':1,'子丑':1,'丑子':1,'亥寅':1,'戌卯':1,'酉辰':1,'申巳':1,'未午':1 };
    const YANG_REN_SET = { '丙午':1,'壬子':1,'丁巳':1,'癸亥':1 };
    const WX_LIST = ['木','火','土','金','水'];
    var WX_SI = {}, WX_SK = {};
    WX_LIST.forEach(function(w,i){ WX_SI[w]=WX_LIST[(i+4)%5]; WX_SK[w]=WX_LIST[(i+2)%5]; });

    // 十神→五行 辅助（根据十神名 + 日干五行推断该十神对应什么五行）
    function ssToWx(ssName) {
        if (!ssName) return null;
        // 比肩/劫财 = 同日干五行
        if (ssName === '比肩' || ssName === '劫财') return DAY_WX;
        // 食神/伤官 = 我生者
        if (ssName === '食神' || ssName === '伤官') return WX_LIST[(WX_LIST.indexOf(DAY_WX)+1)%5];
        // 正财/偏财 = 我克者
        if (ssName === '正财' || ssName === '偏财') return WX_LIST[(WX_LIST.indexOf(DAY_WX)+2)%5];
        // 正官/七杀 = 克我者
        if (ssName === '正官' || ssName === '七杀') return WX_LIST[(WX_LIST.indexOf(DAY_WX)+3)%5];
        // 正印/偏印 = 生我者
        if (ssName === '正印' || ssName === '偏印') return WX_LIST[(WX_LIST.indexOf(DAY_WX)+4)%5];
        return null;
    }

    // 父亲星 / 母亲星
    const fatherStar = isMale ? '偏财' : '正财';
    const motherStar = isMale ? '正印' : '偏印';

    // === 1. 日主强弱判定（子平法：得令·得地·得势） ===
    var dmResult = calcDayMasterStrength(bazi);
    var dmLabel = dmResult.level;
    var dmScore = dmResult.score;

    // 判断某十神对日主来说是否"喜用"
    function isXiShen(ssName) {
        var wax = ssToWx(ssName);
        if (!wax) return false;
        if (dmLabel === '偏强' || dmLabel === '极强') {
            return ssName === '正官' || ssName === '七杀' || ssName === '食神' || ssName === '伤官' || ssName === '正财' || ssName === '偏财';
        } else if (dmLabel === '偏弱' || dmLabel === '极弱') {
            return ssName === '正印' || ssName === '偏印' || ssName === '比肩' || ssName === '劫财';
        }
        // 中和：无明显喜忌
        return false;
    }

    // === 2. 查找父母星位置 ===
    var fatherPos = [], motherPos = [];
    var fatherGan = null, motherGan = null, fatherShiShenOnGan = null, motherShiShenOnGan = null;
    var fatherInYear = false, motherInYear = false;
    var posNameMap = { year: '年', month: '月' };

    ['year','month'].forEach(function(pos) {
        var ganSS = getShiShen(DAY, bazi[pos].gan);
        if (ganSS === fatherStar) { fatherPos.push(posNameMap[pos] + '干'); fatherGan = bazi[pos].gan; fatherShiShenOnGan = ganSS; if (pos==='year') fatherInYear = true; }
        if (ganSS === motherStar) { motherPos.push(posNameMap[pos] + '干'); motherGan = bazi[pos].gan; motherShiShenOnGan = ganSS; if (pos==='year') motherInYear = true; }

        var cg = getCangGan(bazi[pos].zhi);
        cg.forEach(function(g) {
            var ss = getShiShen(DAY, g);
            if (ss === fatherStar) { fatherPos.push(posNameMap[pos] + '支'); if (pos==='year') fatherInYear = true; }
            if (ss === motherStar) { motherPos.push(posNameMap[pos] + '支'); if (pos==='year') motherInYear = true; }
        });
    });

    // === 3. 父母星是否有根（同五行在其他柱出现） ===
    function hasWuxingRoot(wx) {
        var count = 0;
        ['year','month','day','hour'].forEach(function(pos){
            if (WU_XING[bazi[pos].gan] === wx) count++;
            if (DI_ZHI_WU_XING[bazi[pos].zhi] === wx) count++;
            getCangGan(bazi[pos].zhi).forEach(function(g){ if (WU_XING[g] === wx) count++; });
        });
        return count >= 2; // 至少出现 2 次才算有根
    }
    var fatherWx = ssToWx(fatherStar);
    var motherWx = ssToWx(motherStar);
    var fatherHasRoot = fatherWx ? hasWuxingRoot(fatherWx) : false;
    var motherHasRoot = motherWx ? hasWuxingRoot(motherWx) : false;

    // === 4. 年柱是否被冲/害/刑（父母宫受损） ===
    var yearZhi = bazi.year.zhi;
    var yearGan = bazi.year.gan;
    var yearClash = [], yearHarm = [], yearPenalty = [];
    var yearSS = getShiShen(DAY, yearGan);

    ['month','day','hour'].forEach(function(pos){
        var pz = bazi[pos].zhi;
        if (ZHI_CHONG[yearZhi] === pz) yearClash.push(pos);
        if (ZHI_HAI[yearZhi] === pz) yearHarm.push(pos);
    });
    // 刑
    var xingMap = { '子':['卯'], '卯':['子'], '寅':['巳','申'], '巳':['寅','申'], '申':['寅','巳'], '丑':['戌','未'], '戌':['丑','未'], '未':['丑','戌'], '辰':['辰'], '午':['午'], '酉':['酉'], '亥':['亥'] };
    ['month','day','hour'].forEach(function(pos){
        var pz = bazi[pos].zhi;
        if (xingMap[yearZhi] && xingMap[yearZhi].indexOf(pz) > -1) yearPenalty.push(pos);
    });

    var yearDamaged = yearClash.length + yearHarm.length + yearPenalty.length;
    var yearZhiIsYangRen = YANG_REN_SET[yearGan + yearZhi];

    // === 5. 生成文本 ===
    var fatherText = '', motherText = '', summaryText = '', yearNote = '';
    var posName = { year: '年柱', month: '月柱' };

    // ---- 父亲 ----
    var fIsXi = isXiShen(fatherStar);
    if (fatherPos.length > 0) {
        var fPositions = fatherPos.join('、');
        fatherText = '父亲星（' + fatherStar + '）出现在' + fPositions;
        if (fatherInYear) fatherText += '，得位年柱父母宫';

        // 有根
        if (!fatherHasRoot) {
            fatherText += '。但父星根基较浅——在全局中只有孤星没有同五行支撑，意味着父亲可能在你的成长中很用心，但能给的实质资源或助力有限';
        } else {
            fatherText += '。父星根基扎实，意味着父亲自身能力或资源较充足，对你的人生有实质性帮助';
        }

        // 喜用还是压力
        if (fIsXi) {
            fatherText += '。从命局看，父亲特质恰好是你所需要的，他对你的教导和要求大多对你有益，属于「严是爱」的类型';
        } else {
            fatherText += '。不过要注意，你命局日主' + dmLabel + '，父星对你的要求有时候会超出你的承受范围，需要学会把父亲的期望转化成动力而不是压力';
        }

        // 父星是否被克
        if (fatherGan) {
            var keMap = {};
            ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].forEach(function(g,i){
                keMap[g] = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'][(i+7)%10]; // 间隔7位为克
            });
            var keGan = keMap[fatherGan];
            if (bazi.month.gan === keGan) {
                fatherText += '。特别提醒：父星在年干被月干' + keGan + '克制，需多留意父亲的身体健康，尤其在父亲年长之后';
            }
        }
    } else {
        if (fatherWx && hasWuxingRoot(fatherWx)) {
            fatherText = '父亲星（' + fatherStar + '）虽未直接显现在年、月柱的天干地支上，但命局中' + fatherWx + '元素较旺，父缘并不浅——父亲对你的影响可能是间接的、潜移默化的方式存在，或者通过家中的其他长辈传递给你。';
        } else {
            fatherText = '父亲星（' + fatherStar + '）未显于命局，且相关五行也较弱，与父亲的缘分相对较浅。这并不代表关系不好，而是父亲在你性格形成期可能不在身边，或者有祖辈、师长在你人生中扮演了部分「父亲」角色。';
        }
    }

    // ---- 母亲 ----
    var mIsXi = isXiShen(motherStar);
    if (motherPos.length > 0) {
        var mPositions = motherPos.join('、');
        motherText = '母亲星（' + motherStar + '）出现在' + mPositions;
        if (motherInYear) motherText += '，得位年柱父母宫';

        if (!motherHasRoot) {
            motherText += '。母星根基较浅，母亲在自己的生活中可能有自己的难处或局限，能给你的资源不是最充裕的，但她在情感上的付出是真诚的';
        } else {
            motherText += '。母星根基扎实，母亲是很坚实的后盾，在你需要的时候总能提供情感和实际上的支持';
        }

        if (mIsXi) {
            motherText += '。从命局看，母亲的包容和支持正是你最需要的东西，你们之间有一种天然的互相理解，这对你的性格形成很关键';
        } else {
            motherText += '。但需留意——你命局日主' + dmLabel + '，母亲的过度保护和关注有时候反而会让你觉得「喘不过气」来。学会对母亲说「我可以自己来」也是长大的一部分';
        }

        if (motherGan) {
            var keMap2 = {};
            ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].forEach(function(g,i){
                keMap2[g] = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'][(i+7)%10];
            });
            if (bazi.month.gan === keMap2[motherGan]) {
                motherText += '。母星在年干受月干克制，平时应多关心母亲的身体和情绪';
            }
        }
    } else {
        if (motherWx && hasWuxingRoot(motherWx)) {
            motherText = '母亲星（' + motherStar + '）在年、月柱的天干地支上不直接显现，但命局中' + motherWx + '元素不算弱，说明母亲的能量是通过生活细节渗透给你的——可能她没有用你期待的方式关爱你，但她一直以自己的方式在。';
        } else {
            motherText = '母亲星（' + motherStar + '）不显于命局，与母亲的缘分偏淡。每个人的成长环境不同，有些人是从长辈或朋友那里学到温柔和关怀的，这不一定是遗憾';
        }
    }

    // ---- 年柱综合 ----
    yearNote = '年柱' + yearGan + yearZhi + '代表父母宫和祖上根基。';
    if (yearClash.length > 0) {
        var cpNames = yearClash.map(function(p){return posName[p];});
        yearNote += '父母宫被' + cpNames.join('、') + '冲克，意味着家庭根基在某个阶段经历过动荡——可能是搬家、父母工作变动、或祖辈健康问题。但这反而培养了你更强的适应能力。';
    } else if (yearHarm.length > 0) {
        yearNote += '父母宫有暗害，家庭中可能有一些不为人道的矛盾或摩擦，这些事不会大爆发但会在你心里留下印记。';
    } else if (yearPenalty.length > 0) {
        yearNote += '父母宫有相刑，家庭关系中可能有一些微妙的张力需要时间去消化。';
    } else {
        var yearHe = false;
        ['month','day','hour'].forEach(function(pos){
            var pair1 = yearZhi + bazi[pos].zhi, pair2 = bazi[pos].zhi + yearZhi;
            if (ZHI_HE[pair1] || ZHI_HE[pair2]) yearHe = true;
        });
        if (yearHe) yearNote += '父母宫与其他柱相合，家庭关系比较融洽，长辈之间能相互支持。';
        else yearNote += '父母宫整体比较平稳，家庭给你的基础是好的。';
    }

    if (yearZhiIsYangRen) {
        yearNote += ' 不过年柱为羊刃日柱，暗示父母中有一方性格比较刚烈或有主见，家里可能有一个「说了算」的人。';
    }

    // 判断生我者是否在地支有根（印星=母亲类象）
    var yinWx = WX_LIST[(WX_LIST.indexOf(DAY_WX)+4)%5];
    var yinInYr = DI_ZHI_WU_XING[yearZhi] === yinWx;
    if (yinInYr && !motherInYear) {
        yearNote += ' 年支为' + yearZhi + '（属' + yinWx + '），是印星之根，母亲虽然不直接显现在天干上，但她的影响力在家庭根基中是实实在在的。';
    }

    // ---- 综合 ----
    if (fatherPos.length > 0 && motherPos.length > 0) {
        if (yearDamaged === 0 && fatherHasRoot && motherHasRoot) {
            summaryText = '命局中父母双星俱现且根基牢固，父母宫也没什么损伤。幼年家庭结构完整，父母双方对你的成长都给予了足够的关注和支持。日主' + dmLabel + '，总体上家庭环境是你性格形成中比较正面的力量。';
        } else if (yearDamaged > 0) {
            summaryText = '父母双星均在命局中出现，但父母宫存在' + (yearClash.length?'冲':'') + (yearHarm.length?'害':'') + (yearPenalty.length?'刑':'') + '的干扰。这意味着虽然父母都在身边，但家庭中并非一帆风顺——可能经历过一些波折或分歧。这些经历反而让你更早地学会了独立思考和适应变化。';
        } else {
            summaryText = '父母双星俱在，但一方根基偏弱。总体而言家庭给你的支持是中上的，你从父母那里学到的东西会在成年后慢慢体现出来。';
        }
    } else if (fatherPos.length > 0 || motherPos.length > 0) {
        summaryText = '命局中一方亲星显现、另一方不显，暗示父母对你影响的权重不同。日主' + dmLabel + '的格局下，显性的那一方在你成长中起了更大的作用，而另一方可能因为性格、工作等原因互动较少。这不是关系好不好的问题，只是亲疏深浅的差别。';
    } else {
        summaryText = '父母双星均不直接显现在年月柱上，命局日主' + dmLabel + '。这意味着你性格形成期受外界（祖辈、师长、朋友）的影响可能超过父母。这种格局的人往往独立得比较早，成年后回头看，父母虽然没有时时刻刻在你身边，但给了你独自面对世界的底气和韧性。';
    }

    return {
        fatherText: fatherText,
        motherText: motherText,
        summaryText: summaryText,
        yearNote: yearNote,
        fatherStar: fatherStar,
        motherStar: motherStar,
        fatherPresent: fatherPos.length > 0,
        motherPresent: motherPos.length > 0
    };
}



// ==================== 日主性格分析 ====================
function analyzeCharacter(bazi) {
  var ganChars = {
    '甲':'甲木为参天大树，栋梁之材。\n\n你正直刚毅，有领导力，目标明确不轻易妥协。像一棵挺拔的松柏，给人可靠和安全感。内心有强烈的向上生长的驱动力。\n\n但有时过于直率和固执，需学会柔和变通，听取他人意见。',
    '乙':'乙木为花草藤萝，柔韧灵活。\n\n你心思细腻，适应力极强，善于在复杂环境中找到出路。像春天的藤蔓，看似柔弱却有顽强的生命力。审美力强，对美有独到见解。\n\n但有时容易纠结犹豫，需要学会果断决策。',
    '丙':'丙火为太阳之光，热情奔放。\n\n你开朗大方，充满感染力，走到哪里都是焦点。像正午的太阳，温暖照亮身边的人。天生具有领导气质和影响力。\n\n但有时过于张扬外放，需注意收敛锋芒，照顾他人感受。',
    '丁':'丁火为灯烛之光，内敛而持久。\n\n你细心专注，善于在暗处默默发光。像一盏长明灯，不喧哗但有温度，适合深耕某个领域，厚积薄发。\n\n但有时过于敏感内耗，需要学会释放情绪。',
    '戊':'戊土为城墙之土，厚重诚信。\n\n你稳重可靠，是朋友眼中的靠山。像厚实的大地，承载万物而不言。做事踏实，一步一个脚印，值得信赖。\n\n但有时过于固执保守，需要学会灵活变通。',
    '己':'己土为田园之土，包容细腻。\n\n你温和友善，善于照顾他人，像肥沃的土壤滋养身边的一切。做事有条理，注重细节。\n\n但有时缺乏决断力，需要培养自信和主见。',
    '庚':'庚金为斧钺之金，刚强果断。\n\n你执行力强，不畏困难，敢于披荆斩棘。像一把利剑，快刀斩乱麻。适合竞争激烈的领域，越战越勇。\n\n但有时过于刚硬，需学会以柔克刚。',
    '辛':'辛金为珠宝之金，精致敏感。\n\n你追求完美，品味高雅。像精雕细琢的首饰，小而精美。对人对事有高标准，审美力出众。\n\n但有时过于挑剔苛求，需要学会包容不完美。',
    '壬':'壬水为江河之水，智慧奔放。\n\n你思维活跃，心胸开阔，不拘小节。像大江大河，奔腾不息，善于融会贯通。适合创意和开拓性工作。\n\n但有时过于随性散漫，需要增强专注力。',
    '癸':'癸水为雨露之水，细腻深沉。\n\n你直觉敏锐，内心世界丰富。像清晨的露珠，看似平静却蕴含深度。善于观察思考，第六感强。\n\n但有时过于内敛敏感，需要学会表达和释放。'
  };
  return ganChars[bazi.day.gan] || '日主性格独特，需结合整体命局深入分析。';
}

function analyzeWealth(bazi, gender) {
    const DAY = bazi.day.gan;
    const WX = WU_XING[DAY];
    const isMale = gender === 'male';

    // 财星定义：日主所克者
    const WX_KE = { '木':'土','火':'金','土':'水','金':'木','水':'火' };
    const caiWX = WX_KE[WX]; // 财星五行
    const caiGans = [];
    // 找出天干中属于财星五行的
    const TIAN_GAN_WX = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' };
    Object.keys(TIAN_GAN_WX).forEach(gan => {
        if (TIAN_GAN_WX[gan] === caiWX && gan !== DAY) caiGans.push(gan);
    });

    // 在各柱中查找财星
    const pillars = ['year','month','day','hour'];
    const posCN = { year:'年柱', month:'月柱', day:'日柱', hour:'时柱' };
    let caiPositions = [];
    let caiCount = 0;

    pillars.forEach(pos => {
        const gWx = TIAN_GAN_WX[bazi[pos].gan];
        if (gWx === caiWX) {
            caiPositions.push(posCN[pos] + '干（' + bazi[pos].gan + '）');
            caiCount++;
        }
        getCangGan(bazi[pos].zhi).forEach(g => {
            if (TIAN_GAN_WX[g] === caiWX) {
                caiPositions.push(posCN[pos] + '支藏（' + g + '）');
                caiCount++;
            }
        });
    });

    // --- 简化日主旺衰判断 ---
    let wangScore = 0;
    // 得月令
    const monthZhi = bazi.month.zhi;
    const DI_ZHI_WX_MAP = { '寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水','子':'水','丑':'土' };
    const monthWX = DI_ZHI_WX_MAP[monthZhi];
    if (monthWX === WX) wangScore += 3;
    else {
        const wxSheng = { '木':'水','火':'木','土':'火','金':'土','水':'金' };
        if (wxSheng[WX] === monthWX) wangScore += 2; // 月令生扶
    }

    // 天干同类比劫 + 印星
    pillars.forEach(pos => {
        const gWx = TIAN_GAN_WX[bazi[pos].gan];
        if (gWx === WX) wangScore += 1; // 比劫
        const wxSheng2 = { '木':'水','火':'木','土':'火','金':'土','水':'金' };
        if (gWx === wxSheng2[WX]) wangScore += 0.5; // 印星
    });

    // 地支藏干加分
    pillars.forEach(pos => {
        getCangGan(bazi[pos].zhi).forEach(g => {
            const gWx = TIAN_GAN_WX[g];
            if (gWx === WX) wangScore += 0.5;
            const ws = { '木':'水','火':'木','土':'火','金':'土','水':'金' };
            if (gWx === ws[WX]) wangScore += 0.25;
        });
    });

    const wangStatus = wangScore >= 4 ? '身强' : (wangScore >= 2 ? '中和偏强' : (wangScore >= 0.5 ? '中和偏弱' : '身弱'));

    // --- 财运解读 ---
    let caiText = '', caiWanxi = '', caiAdvice = '';

    const caiPositionNotes = {
        '年柱': '财在年柱，祖上或早年即有不错的物质基础，或家族中有经商传统。青壮年时期财运逐步显现。',
        '月柱': '财在月柱，青年时期就能展现赚钱能力，事业起步较早，适合在职场上稳步积累财富。',
        '日柱': '财在日柱，中年财运最佳，配偶在财务上也可能是得力帮手，夫妻共同经营财富。',
        '时柱': '财在时柱，财运来得较晚，属于「先苦后甜」型，晚年财富积累可观，也利于子女运势。'
    };

    // 财星位置描述
    if (caiCount >= 3) {
        caiText = '命局财星旺盛（共出现' + caiCount + '次），分布于' + [...new Set(caiPositions.map(p => p.slice(0,2)))].join('、') + '。';
    } else if (caiCount >= 1) {
        caiText = '命局有财星显现（共' + caiCount + '次），主要在';
        const mainPos = caiPositions[0].slice(0, 2);
        caiText += mainPos + '位置。';
        const posNote = caiPositionNotes[mainPos];
        if (posNote) caiText += ' ' + posNote;
    } else {
        caiText = '命局财星不显，但这不代表财运不好——食伤生财、以技艺谋财的路径也同样宽广，需要通过自身努力和才华创造财富。';
    }

    // 身强身弱与财的关系
    if (wangStatus === '身强' || wangStatus === '中和偏强') {
        if (caiCount >= 2) {
            caiWanxi = '日主' + wangStatus + '可以担财，命局财星有力，属于「能赚钱也能守财」的类型。';
        } else {
            caiWanxi = '日主' + wangStatus + '足以担财，虽然命局财星不算多，但自身能量足够，可通过努力一步步积累财富。';
        }
    } else {
        if (caiCount >= 2) {
            caiWanxi = '日主' + wangStatus + '而财星偏旺，有「财多身弱」之象——赚钱的机会多但自己精力有限，建议借助团队或合作伙伴分担压力，避免独自扛太多。';
        } else {
            caiWanxi = '日主' + wangStatus + '，财星也不旺，目前宜以求稳为主，先积累能力和资源，等待大运带动财运。';
        }
    }

    // 建议
    if (wangStatus === '身强' || wangStatus === '中和偏强') {
        caiAdvice = '财运整体向好，适合主动出击。求财方向：' + caiWX + '五行为财，对应的行业或方位能旺财运。理财上建议稳健投资，不宜过度冒险，稳扎稳打方能长盛。';
    } else {
        const wxSheng3 = { '木':'水','火':'木','土':'火','金':'土','水':'金' };
        const helpWX = wxSheng3[WX]; // 印星五行（生我）
        caiAdvice = '当前阶段求稳为主，不宜冒进。建议先借力发展——与' + helpWX + '五行属性的人合作，或从' + helpWX + '相关行业切入，能让财运更加顺畅。待大运走强时再大规模投入也不迟。';
    }

    // --- 财富方位与城市 ---
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
    const goodDirInfo = wxDirMap[caiWX] || wxDirMap['土'];

    // 适合发展的城市（取前5个）
    const goodCities = goodDirInfo.cities.slice(0, 5);
    const badCities = badDirInfo.cities.slice(0, 3);

    // --- 财富量级估算（基于身强+财星数量） ---
    const wealthLevels = [];
    if (wangStatus === '身强' && caiCount >= 3) {
        wealthLevels.push('你有很强的赚钱能力和财运基础，只要方向对，**千万级别**的财富完全在你的射程之内。关键是找准赛道、持续深耕十年以上。');
    } else if (wangStatus === '身强' && caiCount >= 1) {
        wealthLevels.push('你的命格底子扎实，加上财星有根，**三五百万**这个量级对你来说只是时间问题。做好规划、保持专注，财富会自然积累。');
    } else if (wangStatus === '身强' || (wangStatus === '中和偏强' && caiCount >= 2)) {
        wealthLevels.push('你的底子不错，财气也够用——**百万级别**的财富是完全可以期待的。抓住大运走强的年份，三五年就能看到明显变化。');
    } else if (wangStatus === '中和偏强' || (wangStatus === '中和偏弱' && caiCount >= 2)) {
        wealthLevels.push('你的财运需要一点时间酝酿，但只要坚持走对方向，**几十万到百万**的积累是完全现实的。稳扎稳打比什么都重要。');
    } else if (caiCount >= 1) {
        wealthLevels.push('你的财运偏稳，不太适合冒险——但好在有财星在命，**几十万**的稳定积累不成问题。建议把重心放在主业深耕上，别频繁换赛道。');
    } else {
        wealthLevels.push('你的命局财星不显，但这不代表没有财运——很多人都是靠食伤生财（用才华赚钱）后来居上的。关键在于找到你真正热爱且擅长的事，**一步一步积累，一样能达到让别人羡慕的财富水平**。');
    }

    // 第二段补充建议
    if (wangStatus === '身强') {
        wealthLevels.push('你的抗压能力强，适合做一些需要长期投入、厚积薄发的事情。别太在意短期盈亏，把眼光放长，十年后的你会感谢现在沉得住气的自己。');
    } else if (wangStatus === '中和偏弱' || wangStatus === '身弱') {
        wealthLevels.push('你的优势不在于一个人硬扛——找到靠谱的搭档、好的平台，借力发展会让你走得更快。团队作战比单打独斗更适合你。');
    }

    // --- 大白话财运总结 ---
    const summaryParts = [];
    if (caiCount >= 2) {
        summaryParts.push('你命局中财星出现了' + caiCount + '次');
    } else if (caiCount === 1) {
        summaryParts.push('你命里有财星在' + (caiPositions[0] ? caiPositions[0].slice(0, 2) : '命') + '位');
    } else {
        summaryParts.push('命局财星不显，但你有生财的能力');
    }

    if (wangStatus === '身强' || wangStatus === '中和偏强') {
        summaryParts.push('自身能量足，赚钱有底气');
    } else {
        summaryParts.push('适合与人合作，借力发展');
    }
    summaryParts.push(goodDirInfo.dir + '方位是财库方向')

    const wealthSummary = summaryParts.join('，') + '。总之一句话——你的财运是有根的，别着急，好事在后头。';

    return {
        caiWX: caiWX,
        caiCount: caiCount,
        caiPositions: caiPositions,
        caiText: caiText,
        wangScore: wangScore,
        wangStatus: wangStatus,
        caiWanxi: caiWanxi,
        caiAdvice: caiAdvice,
        goodDirection: goodDirInfo.dir,
        goodCities: goodCities,
        badDirection: badDirInfo.dir,
        badCities: badCities,
        wealthLevels: wealthLevels,
        wealthSummary: wealthSummary,
        goodDirShort: goodDirInfo.d,
        badDirShort: badDirInfo.d
    };
}



// ==================== 大运流年运势分析 ====================
function analyzeFortune(bazi, gender) {
    const DAY = bazi.day.gan;
    const DAY_WX = WU_XING[DAY];
    const currentYear = new Date().getFullYear();

    // 计算大运
    const daYun = calculateDaYun(bazi.month, bazi.year, gender,
        bazi.birthDate.year, bazi.birthDate.month, bazi.birthDate.day, bazi.birthDate.hour);

    // 找出当前大运
    let currentDY = null;
    for (const dy of daYun.list) {
        if (currentYear >= dy.startYear && currentYear <= dy.endYear) {
            currentDY = dy;
            break;
        }
    }
    if (!currentDY) {
        currentDY = daYun.list[0];
        for (const dy of daYun.list) {
            if (dy.startYear >= currentYear) { currentDY = dy; break; }
        }
    }

    // 计算今后5年流年
    const years = [];
    for (let y = currentYear; y <= currentYear + 4; y++) {
        const yp = getYearPillar(y, 6, 15);
        years.push({
            year: y,
            gan: yp.gan,
            zhi: yp.zhi,
            ganWX: WU_XING[yp.gan],
            zhiWX: DI_ZHI_WU_XING[yp.zhi],
            shiShen: getShiShen(DAY, yp.gan),
            cangGan: getCangGan(yp.zhi)
        });
    }

    // 日主旺衰简化判断
    const wxSheng = { '木':'水','火':'木','土':'火','金':'土','水':'金' };
    const guanWX = { '木':'金','火':'水','土':'木','金':'火','水':'土' };
    const woKe = { '木':'土','火':'金','土':'水','金':'木','水':'火' };
    const helpWX = wxSheng[DAY_WX];
    const sameWX = DAY_WX;
    const caiWX = woKe[DAY_WX];
    const wxSHENG = { '木':'火','火':'土','土':'金','金':'水','水':'木' };
    const shiShangWX2 = wxSHENG[DAY_WX];

    let wangScore = 0;
    ['year','month','day','hour'].forEach(pos => {
        const gWx = WU_XING[bazi[pos].gan];
        if (gWx === sameWX) wangScore += 1;
        if (gWx === helpWX) wangScore += 0.5;
        getCangGan(bazi[pos].zhi).forEach(g => {
            const gw = WU_XING[g];
            if (gw === sameWX) wangScore += 0.5;
            if (gw === helpWX) wangScore += 0.25;
        });
    });
    const isStrong = wangScore >= 3;

    // 身强喜克泄耗（财/官杀/食伤）为好运；身弱喜生扶（印/比劫）为好运
    const favorableSet = isStrong
        ? new Set([caiWX, shiShangWX2, guanWX[DAY_WX]])
        : new Set([helpWX, sameWX]);

    // ========== 每一年分析 ==========
    const CHONG_MAP = { '子午':true,'午子':true,'丑未':true,'未丑':true,'寅申':true,'申寅':true,'卯酉':true,'酉卯':true,'辰戌':true,'戌辰':true,'巳亥':true,'亥巳':true };
    const HE_MAP = { '子丑':true,'丑子':true,'寅亥':true,'亥寅':true,'卯戌':true,'戌卯':true,'辰酉':true,'酉辰':true,'巳申':true,'申巳':true,'午未':true,'未午':true };

    const yearResults = years.map(yr => {
        const yrWX = yr.ganWX;
        const isFavorable = favorableSet.has(yrWX);
        const ss = yr.shiShen;

        // 冲克检测
        let riskText = '', oppText = '';
        let riskLevel = 0;

        ['year','month','day','hour'].forEach(pos => {
            const posCN = { year:'年柱', month:'月柱', day:'日柱', hour:'时柱' };
            const pillarZhi = bazi[pos].zhi;
            if (CHONG_MAP[yr.zhi + pillarZhi]) {
                if (pos === 'day') {
                    riskText = '! 流年与日柱（夫妻宫）相冲——感情、家庭或居住环境可能有变动，建议多沟通、少冲动决策。';
                    riskLevel += 3;
                } else if (pos === 'month') {
                    riskText = '! 流年与月柱相冲——事业、工作环境可能出现调整，宜沉着应对，不宜贸然变动。';
                    riskLevel += 2;
                } else if (pos === 'year') {
                    riskText = '! 流年与年柱相冲——长辈健康或家庭根基之事需多加关注。';
                    riskLevel += 2;
                }
            }
            if (HE_MAP[yr.zhi + pillarZhi]) {
                if (pos === 'day') {
                    oppText = '-- 流年与日柱（夫妻宫）相合——人缘运佳，感情顺利或遇贵人相助，适合建立深度关系。';
                    riskLevel -= 1;
                } else if (pos === 'month') {
                    oppText = '-- 流年与月柱相合——事业上得助力，合作顺利，容易遇到志同道合的伙伴。';
                    riskLevel -= 1;
                }
            }
        });

        // 流年天干十神解读
        const ssNotes = {
            '正官': '事业上责任加重，压力与机遇并存——利于求职、晋升、考试。也是适合结婚的好年份。需注意职场竞争，保持低调谦逊。',
            '七杀': '挑战和压力扑面而来，但也最能激发你的潜力——创业者反而可能迎来突破。注意身体健康，避免冲动决策，防小人暗算。',
            '正财': '财运平稳上升，正职收入有望增加，理财计划容易落实。感情上男命利于发展恋情。建议踏实工作积累，不宜投机冒险。',
            '偏财': '容易遇到投资机会或意外之财，社交开销也会增加。适合拓展人脉和副业，但要控制冲动消费。对商业嗅觉敏感，适合谈合作。',
            '正印': '贵人运旺盛，容易得到长辈、上级或前辈的帮助。适合学习深造、考取证照、规划长远事业。心情较为安逸从容。',
            '偏印': '思维活跃、灵感丰富，适合从事研究、创作或独立项目。可能对玄学哲学产生兴趣。注意不要过于离群或钻牛角尖。',
            '食神': '轻松自在的一年，压力较小，心情愉悦。适合发展兴趣爱好、健身养生、陪伴家人。创作灵感好，表达欲强。',
            '伤官': '才华外露、表达欲旺盛，适合创作、演讲、展示自己。但需注意言行，避免在不经意间得罪他人。也是一个适合跳出框框尝试新事物的年份。',
            '比肩': '社交圈子扩大，朋友往来增多，但也意味著开销上升。独立意识增强，适合单打独斗的项目。注意不要轻易借钱给别人。',
            '劫财': '竞争激烈的一年——职场上可能有对手、财务上可能有意外支出。但也可能通过合伙或团队协作获得收益。注意防骗、防小人。'
        };

        let ssNote = ssNotes[ss] || '运势总体平稳，日常工作生活按部就班即可，没有大起大落。';

        let overallLabel, overallColor;
        if (isFavorable && riskLevel <= 0) {
            overallLabel = '利好';
            overallColor = '#81C784';
        } else if (riskLevel >= 3) {
            overallLabel = '注意';
            overallColor = '#F44336';
        } else if (isFavorable) {
            overallLabel = '较好';
            overallColor = '#feca57';
        } else {
            overallLabel = '平稳';
            overallColor = '#a29bfe';
        }

        // --- 注意事项 + 凶煞提醒 ---
        var cautions = [];
        if (ss === '七杀') {
            cautions.push('流年七杀当值，压力与挑战并存。注意身体健康，避免过度劳累——这一年适合稳扎稳打，不宜与人正面冲突。');
            cautions.push('财运上不宜做重大投资决策，容易判断失误。把重心放在守成而非扩张上。');
        } else if (ss === '劫财') {
            cautions.push('劫财年容易有意外破财，借钱出去要格外谨慎——可能收不回来。尽量控制社交应酬开销。');
            cautions.push('职场竞争激烈，注意同事或同行之间的小动作，守住自己的利益边界。');
        } else if (ss === '伤官') {
            cautions.push('伤官年表达欲旺盛，但容易说错话得罪人——开口前三思，尤其在公开场合注意分寸。');
            cautions.push('适合创新和突破，但不适合盲目辞职或与上级对抗。把想法用在创作改良上比用在抱怨上更有价值。');
        } else if (ss === '偏财') {
            cautions.push('偏财运带来机会的同时也带来诱惑——警惕高回报承诺的投资项目，大概率是陷阱。落袋为安比什么都重要。');
            cautions.push('花销增大，社交和人情开支压力上升，建议提前做好预算规划。');
        } else if (ss === '比肩') {
            cautions.push('同辈竞争增加，容易在团队中被比较或被分走资源。与其计较，不如借力合作。');
            cautions.push('社交圈扩大是好，但要擦亮眼睛——不熟的人提出的合作邀约要仔细辨别。');
        }

        // 冲克风险补充
        if (riskText && riskText.length > 0) {
            if (riskText.indexOf('日柱') >= 0) {
                cautions.push('日柱逢冲，感情和家庭方面容易有波动——多沟通少冲动，重要决定别在情绪激动时做。');
            }
            if (riskText.indexOf('月柱') >= 0) {
                cautions.push('月柱逢冲，事业和工作环境可能生变——宜静不宜动，观察清楚形势再出手。');
            }
        }

        // 凶煞补充
        if (!isFavorable && riskLevel >= 2) {
            cautions.push('这一年整体运势偏紧，遇事多给自己留余地为好。出行注意安全，证件票据妥善保管。');
        }

        return {
            year: yr.year,
            gan: yr.gan,
            zhi: yr.zhi,
            shiShen: ss,
            isFavorable: isFavorable,
            riskText: riskText,
            oppText: oppText,
            ssNote: ssNote,
            overallLabel: overallLabel,
            overallColor: overallColor,
            cautions: cautions
        };
    });

    // 当前大运信息
    let dyInfo = '';
    if (currentDY) {
        const dySS = getShiShen(DAY, currentDY.gan);
        dyInfo = '当前正行「' + currentDY.gan + currentDY.zhi + '」大运（' + currentDY.startYear + '-' + currentDY.endYear + '年），运干十神为「' + dySS + '」。';
    }

    return { years: yearResults, dayGan: DAY, dyInfo: dyInfo };
}

// ==================== 今年运势详细分析 ====================
function analyzeThisYear(bazi, gender) {
    var DAY = bazi.day.gan, DAY_WX = WU_XING[DAY];
    var currentYear = new Date().getFullYear();
    var yp = getYearPillar(currentYear, 6, 15);
    var ss = getShiShen(DAY, yp.gan);
    var isMale = gender === 'male';

    // 日主旺衰
    var wxSheng = { '木':'水','火':'木','土':'火','金':'土','水':'金' };
    var woKe = { '木':'土','火':'金','土':'水','金':'木','水':'火' };
    var guanWX = { '木':'金','火':'水','土':'木','金':'火','水':'土' };
    var wxSHENG = { '木':'火','火':'土','土':'金','金':'水','水':'木' };
    var helpWX = wxSheng[DAY_WX], sameWX = DAY_WX;
    var caiWX = woKe[DAY_WX], shiShangWX = wxSHENG[DAY_WX];

    var wangScore = 0;
    ['year','month','day','hour'].forEach(function(pos) {
        var gWx = WU_XING[bazi[pos].gan];
        if (gWx === sameWX) wangScore += 1;
        if (gWx === helpWX) wangScore += 0.5;
        getCangGan(bazi[pos].zhi).forEach(function(g) {
            var gw = WU_XING[g];
            if (gw === sameWX) wangScore += 0.5;
            if (gw === helpWX) wangScore += 0.25;
        });
    });
    var isStrong = wangScore >= 3;
    var favorableSet = isStrong
        ? [caiWX, shiShangWX, guanWX[DAY_WX]]
        : [helpWX, sameWX];

    var yrWX = WU_XING[yp.gan];
    var isFavorable = favorableSet.indexOf(yrWX) >= 0;

    // 冲合检测
    var CHONG_MAP = { '子午':true,'午子':true,'丑未':true,'未丑':true,'寅申':true,'申寅':true,'卯酉':true,'酉卯':true,'辰戌':true,'戌辰':true,'巳亥':true,'亥巳':true };
    var HE_MAP = { '子丑':true,'丑子':true,'寅亥':true,'亥寅':true,'卯戌':true,'戌卯':true,'辰酉':true,'酉辰':true,'巳申':true,'申巳':true,'午未':true,'未午':true };

    var chongPillars = [], hePillars = [];
    ['year','month','day','hour'].forEach(function(pos) {
        var pz = bazi[pos].zhi;
        if (CHONG_MAP[yp.zhi + pz]) chongPillars.push(pos);
        if (HE_MAP[yp.zhi + pz]) hePillars.push(pos);
    });

    // 十神大白话
    var ssStories = {
        '正官': { good:'今年是正官年，事业上容易得到认可，适合争取升职、考证、面试。做事有章法，容易获得上级信任。感情方面也是适合谈婚论嫁的一年。', bad:'但责任也会加重，压力山大。可能有人对你期望很高，自己别把自己逼得太紧。工作中注意不要越权或跟领导对着干。', health:'思虑过度容易失眠头痛，颈椎腰椎需要注意。建议每天给自己留半小时放空的时间。' },
        '七杀': { good:'今年七杀当值，挑战和机遇并存。创业者、自由职业者反而可能迎来突破。你的韧性会在这一年被逼出来，熬过去了就是质的飞跃。', bad:'压力是实实在在的——工作上的突发状况可能一个接一个。要注意小人暗算，重要文件合同多留个心眼。这一年不太适合做重大决定，能稳则稳。', health:'精神压力大是主要问题，容易出现焦虑、心悸。运动是很好的解压方式，哪怕每天走路半小时都比躺着强。注意肝胆和眼睛。' },
        '正财': { good:'今年正财运不错，正职工资有上涨空间，理财计划容易落实。适合踏踏实实攒钱，别想着一口吃个胖子。感情上容易遇到合适的对象。', bad:'但如果太保守也可能错过一些好机会，该花的钱还是要花——比如提升自己的课程、重要的社交应酬，别省过头了。', health:'整体平稳，但久坐工作的人注意颈椎和腰椎。肠胃保养也要上心，规律饮食很重要。' },
        '偏财': { good:'今年偏财运在线，容易遇到投资机会或者意外进账。社交圈扩大，人脉带来的机会比工资收入更可观。适合多出去走动、多跟人聊聊。', bad:'但花销也大得吓人——社交、人情、冲动消费控制不住的话，赚的可能还没花的多。投资理财上警惕高回报承诺，十有八九是坑。落袋为安。', health:'应酬多了以后，肝和胃是两大重灾区。少喝酒，饮食清淡一点，定期体检别拖着。' },
        '正印': { good:'今年贵人运很旺，容易遇到愿意帮你的人——可能是长辈、上级或专业前辈。适合学习进修、考证书、做长远规划。内心比平时更平静从容。', bad:'但如果太安逸，容易失去紧迫感。别把太多希望寄托在别人身上，自己动起来才是真的。有时候想得太多做得太少也是个毛病。', health:'整体不错，但容易因为太舒服而疏于锻炼。注意体重管理，适量的有氧运动最好。' },
        '偏印': { good:'今年脑子特别活跃，灵感多、创意足。适合搞研究、创作、学一门新技术。可能对玄学、哲学这类东西突然产生兴趣。独立项目的成功率比团队项目高。', bad:'但容易钻牛角尖，想得太多太深，有时候会把简单的问题复杂化。跟人沟通时少讲道理多讲感受，别让人觉得你太疏离。', health:'思虑过度伤脾，可能吃不下饭或者暴饮暴食两头极端。睡眠质量需要留意，别熬夜想事情。' },
        '食神': { good:'今年整体比较轻松自在，压力小、心情好。适合发展兴趣爱好、锻炼身体、多陪家人。如果你从事创作类工作，今年的灵感会非常充沛。', bad:'唯一的风险就是太安逸了导致行动力下降。舒服是福，但别躺平——该做的事还是要做，别拖到年底才后悔。', health:'整体很好，适合把运动习惯在今年固定下来。消化系统顺畅，胃口好但注意别吃太多。' },
        '伤官': { good:'今年你的才华会藏不住，表达欲爆棚——如果你做的是创作、演讲、教学类工作，今年是出作品的好时机。思维比平时更跳脱，更适合创新突破。', bad:'但说话容易不过脑子——不是恶意的，但确实可能得罪人而不自知。职场中注意不要跟上级正面冲突，有话好好说。不太适合裸辞，除非下一家已经谈妥。', health:'用脑过度会头疼，嗓子也要注意保护。情绪波动比平时大，建议找到适合自己的发泄渠道。' },
        '比肩': { good:'今年社交圈子在扩大，认识的人比往年多。独立性增强，适合一个人扛的项目。在朋友堆里比较活跃，可能会有小圈子里的领导机会。', bad:'开销也会同步上升——朋友往来、聚餐聚会，钱不知不觉就出去了。借钱给别人要格外慎重，今年尤其容易收不回来。同辈之间竞争也加剧了，心态放平。', health:'体力消耗大，容易疲惫。注意别透支身体去社交，该休息就休息。骨骼关节需要留意。' },
        '劫财': { good:'今年适合团队合作——虽然是竞争年，但找到对的合伙人反而能共赢。精力旺盛，行动力比平时强，能做不少事。', bad:'但是破财风险很高，不是丢东西就是被借走不还，或者冲动消费买一堆用不上的。职场里注意防小人，有人可能会抢你的功劳。合作签字之前仔细看清楚每个条款。', health:'精力旺盛但容易用力过猛，肌肉拉伤、扭伤这类意外比较常见。运动前做好热身。' }
    };
    var story = ssStories[ss] || { good:'今年运势总体平稳，没有大风大浪。', bad:'平平淡淡就是福，别焦虑。', health:'身体无大碍，保持平时习惯就好。' };

    // 冲合影响
    var chongWarnings = [];
    var heGoods = [];
    var chongHealth = [];
    ['year','month','day','hour'].forEach(function(pos) {
        var posName = { year:'祖上/家庭根基', month:'事业/工作', day:'感情/婚姻', hour:'子女/内心' };
        if (CHONG_MAP[yp.zhi + bazi[pos].zhi]) {
            if (pos === 'day') {
                chongWarnings.push('今年流年跟你的夫妻宫相冲，感情上可能会有波动——不是一定会出问题，但需要多沟通、多包容。已婚的别在气头上说重话，单身的别急着做决定。居住环境也可能有变动，比如搬家或装修。');
                chongHealth.push('感情波动会影响睡眠和情绪，注意别把心里的气往身体上撒。');
            } else if (pos === 'month') {
                chongWarnings.push('今年流年跟事业宫相冲，工作环境可能会有调整——部门调动、换领导、甚至跳槽。不是坏事，但过程会有点颠簸。宜静不宜动，看清楚了再出手。');
            } else if (pos === 'year') {
                chongWarnings.push('今年流年跟年柱相冲，家里可能有些事需要你操心——长辈身体、家庭关系、房产相关的事都值得多留意。');
            }
        }
        if (HE_MAP[yp.zhi + bazi[pos].zhi]) {
            if (pos === 'day') {
                heGoods.push('今年流年跟你的夫妻宫相合，人际关系运很好——感情顺利，容易遇到聊得来的人，已有伴侣的也会更亲密。也是一个适合合作、合伙的年份。');
            } else if (pos === 'month') {
                heGoods.push('今年流年跟事业宫相合，工作上容易遇到帮手和贵人，合作项目特别顺利。');
            }
        }
    });

    // 健康状况详细
    var wxHealth = {
        '木': { strong:'肝胆功能偏旺，注意少喝酒、少熬夜，春天容易上火。', weak:'肝气不足，容易疲劳犯困，早上起床困难。多吃绿色蔬菜补一补。', organ:'肝胆、筋腱、眼睛' },
        '火': { strong:'心火偏旺，容易心烦气躁、口腔溃疡。夏天注意防暑，少喝咖啡浓茶。', weak:'心力不足，容易心慌气短，体检查一下心脏相关指标。', organ:'心脏、小肠、血管' },
        '土': { strong:'脾胃消化功能旺盛但容易积食，饮食规律比什么都重要。夏天注意湿热。', weak:'脾胃虚弱，容易腹胀消化不良，冷的少吃。面食比米饭好消化。', organ:'脾胃、肌肉、口腔' },
        '水': { strong:'肾气足但容易水肿，冬天注意保暖别冻着。喝水适量就好别猛灌。', weak:'肾气不足，容易腰酸背痛、怕冷、精力不济。早睡比吃补药管用。', organ:'肾脏、膀胱、骨骼' },
        '金': { strong:'肺气偏旺但容易干燥——喉咙干、皮肤干，秋天注意润肺。', weak:'肺气不足，容易感冒咳嗽，换季时候多注意保暖防寒。', organ:'肺、大肠、皮肤' }
    };
    var hInfo = wxHealth[DAY_WX] || wxHealth['木'];
    var healthMain = isStrong ? hInfo.strong : hInfo.weak;
    var healthSummary = '今年重点养护部位：' + hInfo.organ + '。' + healthMain;

    // 额外健康提醒
    var healthExtra = [];
    if (ss === '七杀' || ss === '正官') healthExtra.push('官杀年精神长期紧绷，容易偏头痛、失眠，建议每天做几分钟深呼吸放松。');
    if (ss === '偏财' || ss === '劫财') healthExtra.push('应酬和奔波多，肠胃和肝脏负担加重——吃饭尽量规律，酒后多喝温水。');
    if (ss === '伤官' || ss === '偏印') healthExtra.push('用脑过度容易头晕、注意力不集中，每隔一小时站起来走走能缓解很多。');
    if (chongPillars.length > 0) healthExtra.push('冲太岁的一年身体容易出现小意外——开车慢一点，运动前热身要充分，别太拼。');

    // 机会
    var opportunities = [];
    if (isFavorable || ss === '正财' || ss === '正官' || ss === '正印' || ss === '食神') {
        opportunities.push('事业上今年是稳步前进的一年——该争取的要争取，别太谦虚。上半年适合定计划，下半年适合执行。');
    }
    if (ss === '偏财' || ss === '伤官' || ss === '食神') {
        opportunities.push('今年适合拓展副业或者学一门新技能——你的创造力在这一年会被激活，学到的东西未来能变现。');
    }
    if (hePillars.length > 0) {
        opportunities.push('今年你的人缘运不错，容易遇到贵人——多出去走动、参加行业交流，你需要的帮助会从这些人里出现。');
    }
    if (ss === '七杀' || ss === '劫财') {
        opportunities.push('虽然今年压力不小，但危机也是转机——很多人在这种年份反而被逼出了潜力。创业者、自由职业者尤其有机会弯道超车。');
    }
    if (isFavorable) {
        opportunities.push('今年整体是利好年，流年五行跟你比较合——做什么比别人顺手一些。趁势而为，别浪费好运气。');
    } else {
        opportunities.push('今年运势偏紧，适合修炼内功——把基础打牢、把手里已有的资源用好，别急着扩张。积蓄力量比盲目冲刺更重要。');
    }
    if (opportunities.length === 0) opportunities.push('今年稳扎稳打就是最好的策略。日常工作生活按节奏来，别给自己太大压力。');

    return {
        year: currentYear,
        gan: yp.gan, zhi: yp.zhi,
        shiShen: ss,
        isFavorable: isFavorable,
        story: story,
        chongWarnings: chongWarnings,
        heGoods: heGoods,
        healthSummary: healthSummary,
        healthExtra: healthExtra,
        opportunities: opportunities,
        dyInfo: ''
    };
}

// ==================== 学业分析 ====================
function analyzeStudy(bazi) {
    const DAY = bazi.day.gan;
    const DAY_WX = WU_XING[DAY];
    const wxSheng = { '木':'水','火':'木','土':'火','金':'土','水':'金' };
    const wxSHENG = { '木':'火','火':'土','土':'金','金':'水','水':'木' };
    const helpWX = wxSheng[DAY_WX];
    const shiShangWX = wxSHENG[DAY_WX];
    const posCN = { year:'年柱', month:'月柱', day:'日柱', hour:'时柱' };

    // 1. 印星力量统计
    let yinScore = 0, yinCount = 0;
    let hasYearYin = false, hasMonthYin = false, hasDayYin = false, hasHourYin = false;

    ['year','month','day','hour'].forEach(pos => {
        const gWx = WU_XING[bazi[pos].gan];
        if (gWx === helpWX) {
            yinScore += 1.5; yinCount++;
            if (pos === 'year') hasYearYin = true;
            if (pos === 'month') hasMonthYin = true;
            if (pos === 'day') hasDayYin = true;
            if (pos === 'hour') hasHourYin = true;
        }
        getCangGan(bazi[pos].zhi).forEach(g => {
            if (WU_XING[g] === helpWX) { yinScore += 0.5; yinCount++; }
        });
    });

    // 2. 食伤力量
    let shiShangScore = 0;
    ['year','month','day','hour'].forEach(pos => {
        const gWx = WU_XING[bazi[pos].gan];
        if (gWx === shiShangWX) shiShangScore += 1;
        getCangGan(bazi[pos].zhi).forEach(g => {
            if (WU_XING[g] === shiShangWX) shiShangScore += 0.5;
        });
    });

    // 3. 文昌贵人
    const wenChangMap = { '甲':['巳'],'乙':['午'],'丙':['申'],'丁':['酉'],'戊':['申'],'己':['酉'],'庚':['亥'],'辛':['子'],'壬':['寅'],'癸':['卯'] };
    const wenChangZhi = wenChangMap[DAY] || [];
    let hasWenChang = false, wenChangPos = '';
    ['year','month','day','hour'].forEach(pos => {
        if (wenChangZhi.includes(bazi[pos].zhi)) { hasWenChang = true; wenChangPos = posCN[pos]; }
    });

    // 4. 学堂（长生之地）
    const changShengMap = { '甲':'亥','乙':'午','丙':'寅','丁':'酉','戊':'寅','己':'酉','庚':'巳','辛':'子','壬':'申','癸':'卯' };
    const xueTangZhi = changShengMap[DAY];
    let hasXueTang = false;
    ['year','month','day','hour'].forEach(pos => {
        if (bazi[pos].zhi === xueTangZhi) hasXueTang = true;
    });

    // 5. 官星（代表自律和考运）
    const wxKe = { '木':'金','火':'水','土':'木','金':'火','水':'土' };
    const guanWX = wxKe[DAY_WX];
    let guanScore = 0;
    ['year','month','day','hour'].forEach(pos => {
        if (WU_XING[bazi[pos].gan] === guanWX) guanScore += 1;
    });

    // 6. 综合判断
    let levelLabel, levelText;
    const totalStudy = yinScore + guanScore * 0.5;

    if (totalStudy >= 4) {
        levelLabel = '学业优秀';
        levelText = '命局中印星得力、官星有制，天生适合读书考试。对新知识的吸收速度快、理解力强，在升学考公考证方面有先天优势。学习对你而言不是负担，而是乐趣。';
    } else if (totalStudy >= 2.5) {
        levelLabel = '学业良好';
        levelText = '具备正常的学习能力和读书兴趣，能够按部就班完成学业。如果大运流年再走印运或官运，有进一步提升的空间，关键时刻也能考出不错的成绩。';
    } else if (totalStudy >= 1) {
        levelLabel = '学业中等';
        levelText = '传统书本学习可能不是你的最强天赋，但这不代表不聪明——你可能更擅长实践操作、人际交往或创意表达，适合技能型或应用型的学习方式。';
    } else {
        levelLabel = '学业需努力';
        levelText = '命局中学业星不显，读书考试确实需要比别人多下功夫。但这往往意味着你的天赋在别处——实践、艺术、社交或运动方面可能有突出表现。找到适合自己的赛道很重要。';
    }

    // 印星位置描述
    let yinPosText = '';
    if (hasYearYin) yinPosText += '· 年柱有印：家庭书香氛围较浓，或祖辈重视教育。';
    if (hasMonthYin) yinPosText += '· 月柱有印：青少年时期学习环境好，易遇良师益友。';
    if (hasDayYin) yinPosText += '· 日柱有印：自学能力强，会主动钻研感兴趣的领域。';
    if (hasHourYin) yinPosText += '· 时柱有印：晚年仍有学习热情，或下一代学业运佳。';
    if (!yinPosText) yinPosText = '· 印星不显于四柱，学习上需要更多外部督促和环境支持。';

    // 综合建议
    let adviceText = '';
    if (yinScore >= 2 && shiShangScore >= 1) {
        adviceText = '印星与食伤兼具，属于「学以致用」的聪明类型——既有扎实的学习能力，又有灵活的表达和创造力。适合教育、写作、科研、设计等需要深度思考与输出的领域。';
    } else if (yinScore >= 2 && shiShangScore < 1) {
        adviceText = '学习吸收能力强，但表达输出稍显不足。建议多写、多说、多动手，把学到的知识转化为实际能力，而非只停留在理解层面。';
    } else if (yinScore < 2 && shiShangScore >= 1) {
        adviceText = '属于「实践出真知」的类型——你可能不太喜欢死记硬背，但动手能力、创意和社交天赋突出。建议选择技能型、艺术型或应用型专业方向，让才华有用武之地。';
    } else if (guanScore >= 1) {
        adviceText = '官星有根，自律性较强，能够按计划坚持学习。适合需要毅力和纪律的学习路径，比如考公考研或长周期的专业深造。';
    } else {
        adviceText = '学习之路需要更多自律和环境支持，找到自己真正感兴趣的方向会事半功倍。优势可能在非学术领域，选择适合的赛道比强行补短板更重要。';
    }

    if (hasWenChang) adviceText += ' 另外，命带「文昌贵人」（位于' + wenChangPos + '），在考试和写作方面有加分——关键时刻容易超常发挥。';
    if (hasXueTang) adviceText += ' 命带「学堂」，天生对知识有好奇心，适合需要持续学习的环境和职业。';

    return {
        dayGan: DAY, wuXing: DAY_WX,
        yinScore: yinScore, yinCount: yinCount,
        shiShangScore: shiShangScore,
        guanScore: guanScore,
        hasWenChang: hasWenChang, hasXueTang: hasXueTang,
        levelLabel: levelLabel, levelText: levelText,
        yinPosText: yinPosText, adviceText: adviceText
    };
}

// ==================== 真太阳时（省份经度校正） ====================
// 中国各省/地区近似经度（省会城市经度，精确到度）
var PROVINCE_LNG = {
    '北京':116,'天津':117,'上海':121,'重庆':106,
    '河北':114,'山西':112,'内蒙古':111,
    '辽宁':123,'吉林':125,'黑龙江':126,
    '江苏':118,'浙江':120,'安徽':117,'福建':119,'江西':115,'山东':117,
    '河南':113,'湖北':114,'湖南':112,'广东':113,'广西':108,'海南':110,
    '四川':104,'贵州':106,'云南':102,'西藏':91,
    '陕西':108,'甘肃':103,'青海':101,'宁夏':106,'新疆':87,
    '香港':114,'澳门':113,'台湾':121
};

// 北京时区的标准经度
var BEIJING_LNG = 120;

/**
 * 根据出生地省份计算真太阳时调整后的时辰索引
 * @param {number} hour - 原始时辰索引 (0=子时, 1=丑时, ...)
 * @param {string} province - 省份名称
 * @param {number} year, month, day - 出生日期（用于均时差）
 * @returns {object} { hourIndex, solarMinutes, lng, lngOffsetMin, eotMin, method }
 */
function getTrueSolarHour(hour, province, year, month, day, minute, clock) {
    var lng = PROVINCE_LNG[province] || BEIJING_LNG;

    // 1. 经度差：每差1度 = 4分钟
    var lngOffsetMin = (lng - BEIJING_LNG) * 4;

    // 2. 均时差（Equation of Time）
    var monthDays = [0,31,59,90,120,151,181,212,243,273,304,334];
    var dayOfYear = monthDays[Math.max(0, month - 1)] + day;
    var B = (dayOfYear - 1) * (360 / 365) * (Math.PI / 180);
    var eotMin = 229.18 * (
        0.000075 +
        0.001868 * Math.cos(B) -
        0.032077 * Math.sin(B) -
        0.014615 * Math.cos(2 * B) -
        0.040849 * Math.sin(2 * B)
    );

    // 3. 总偏移量（分钟）
    var totalOffsetMin = lngOffsetMin + eotMin;

    // 4. 精确时间 → 真太阳时
    // 如果有 clock 参数（data-clock），使用精确钟点；否则用时辰中点
    var clockHour, clockMinute;
    if (clock > 0) {
        clockHour = clock;
        clockMinute = minute || 0;
    } else if (minute > 0) {
        // 只有分钟没有钟点，仍用中点
        var hourMap = [0,2,4,6,8,10,12,14,16,18,20,22];
        clockHour = hourMap[hour] !== undefined ? hourMap[hour] : hour;
        clockMinute = minute;
    } else {
        var hourMap = [0,2,4,6,8,10,12,14,16,18,20,22];
        clockHour = hourMap[hour] !== undefined ? hourMap[hour] : hour;
        clockMinute = 0;
    }

    var trueMinutes = clockHour * 60 + clockMinute + totalOffsetMin;
    trueMinutes = ((trueMinutes % 1440) + 1440) % 1440;

    // 5. 真太阳时 → 时辰索引
    var trueHour = Math.floor(trueMinutes / 60);
    var trueMin = Math.round(trueMinutes % 60);
    if (trueMin >= 60) { trueHour++; trueMin = 0; }
    if (trueHour >= 24) trueHour -= 24;

    var hourIndex;
    if (trueHour >= 23 || trueHour < 1) hourIndex = 0;       // 子时 23:00-01:00
    else if (trueHour >= 1 && trueHour < 3) hourIndex = 1;    // 丑时
    else if (trueHour >= 3 && trueHour < 5) hourIndex = 2;    // 寅时
    else if (trueHour >= 5 && trueHour < 7) hourIndex = 3;    // 卯时
    else if (trueHour >= 7 && trueHour < 9) hourIndex = 4;    // 辰时
    else if (trueHour >= 9 && trueHour < 11) hourIndex = 5;   // 巳时
    else if (trueHour >= 11 && trueHour < 13) hourIndex = 6;  // 午时
    else if (trueHour >= 13 && trueHour < 15) hourIndex = 7;  // 未时
    else if (trueHour >= 15 && trueHour < 17) hourIndex = 8;  // 申时
    else if (trueHour >= 17 && trueHour < 19) hourIndex = 9;  // 酉时
    else if (trueHour >= 19 && trueHour < 21) hourIndex = 10; // 戌时
    else hourIndex = 11;                                       // 亥时

    var method = totalOffsetMin >= 0 ? '+' : '';
    method += Math.round(totalOffsetMin);

    return {
        hourIndex: hourIndex,           // 真太阳时时辰索引
        trueHour: trueHour,             // 真太阳时钟点（用于节气比较）
        trueMinute: trueMin,            // 真太阳时分钟
        solarMinutes: trueMinutes,      // 真太阳时分钟数
        lng: lng,
        lngOffsetMin: Math.round(lngOffsetMin),
        eotMin: Math.round(eotMin),
        method: method
    };
}

window.BaZiCalculator = {
    calculate: calculateBaZi,
    calculateDaYun: calculateDaYun,
    calculateLiuNian: calculateLiuNian,
    calculateShenSha: calculateShenSha,
    getShiShen: getShiShen,
    getCangGan: getCangGan,
    WU_XING: WU_XING,
    DI_ZHI_WU_XING: DI_ZHI_WU_XING,
    TIAN_GAN: TIAN_GAN,
    DI_ZHI: DI_ZHI,
    CHENGGU_GE: CHENGGU_GE,
    calculateChengGu: calculateChengGu,
    DITIANSUI: DITIANSUI,
    analyzePei: analyzePei,
    calculateSpouseAge: calculateSpouseAge,
    analyzeParents: analyzeParents,
    calcDayMasterStrength: calcDayMasterStrength,
    analyzeCharacter: analyzeCharacter,
    analyzeWealth: analyzeWealth,
    analyzeFortune: analyzeFortune,
    analyzeThisYear: analyzeThisYear,
    analyzeStudy: analyzeStudy,
    getTrueSolarHour: getTrueSolarHour,
    PROVINCE_LNG: PROVINCE_LNG
};