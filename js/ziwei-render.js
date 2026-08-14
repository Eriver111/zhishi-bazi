function pad(n) {
  return (n < 10 ? "0" : "") + n;
}
var DZ = [
  "子",
  "丑",
  "寅",
  "卯",
  "辰",
  "巳",
  "午",
  "未",
  "申",
  "酉",
  "戌",
  "亥",
];
var TG = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
var sc = {
  紫微: "#e8d5a3",
  天府: "#e8d5a3",
  太阳: "#e07050",
  武曲: "#e8d5a3",
  天相: "#5b9fd4",
  天梁: "#6db86d",
  七杀: "#e07050",
  破军: "#e07050",
  贪狼: "#e8a040",
  巨门: "#5b9fd4",
  廉贞: "#e07050",
  天同: "#6db86d",
  太阴: "#5b9fd4",
  天机: "#6db86d",
};
var tg = { 0: [0, 4, 8], 1: [1, 5, 9], 2: [2, 6, 10], 3: [3, 7, 11] };
var currentZwCalendar = "solar";

function switchZwCalendar(mode) {
  if (mode !== "solar" && mode !== "lunar") return;
  currentZwCalendar = mode;
  document.querySelectorAll("[data-zw-calendar]").forEach(function (tab) {
    tab.classList.toggle("active", tab.getAttribute("data-zw-calendar") === mode);
  });
  var solarPanel = document.getElementById("zwSolarPanel");
  var lunarPanel = document.getElementById("zwLunarPanel");
  if (solarPanel) solarPanel.classList.toggle("active", mode === "solar");
  if (lunarPanel) lunarPanel.classList.toggle("active", mode === "lunar");
}

(function () {
  var bj = new Date(Date.now() + 8 * 60 * 60 * 1000);
  function fill(id, from, to, cur) {
    var s = document.getElementById(id);
    for (var i = from; i <= to; i++) {
      var o = document.createElement("option");
      o.value = i;
      o.textContent = i;
      if (i === cur) o.selected = true;
      s.appendChild(o);
    }
  }
  fill("zwY", 1900, bj.getUTCFullYear(), 2000);
  fill("zwM", 1, 12, bj.getUTCMonth() + 1);
  fill("zwD", 1, 31, bj.getUTCDate());
  fill("zwMin", 0, 59, 0);
  fill("zwLY", 1900, bj.getUTCFullYear(), 2000);

  var lunarYear = document.getElementById("zwLY");
  var lunarMonth = document.getElementById("zwLM");
  var lunarDay = document.getElementById("zwLD");
  function updateLunarMonths() {
    var year = parseInt(lunarYear.value, 10);
    lunarMonth.innerHTML = "";
    var leap = LunarCalendar.leapMonth(year);
    for (var month = 1; month <= 12; month++) {
      var option = document.createElement("option");
      option.value = month;
      option.textContent = LunarCalendar.LUNAR_MONTH[month - 1];
      lunarMonth.appendChild(option);
      if (month === leap) {
        var leapOption = document.createElement("option");
        leapOption.value = "r" + month;
        leapOption.textContent = "闰" + LunarCalendar.LUNAR_MONTH[month - 1];
        lunarMonth.appendChild(leapOption);
      }
    }
    updateLunarDays();
  }
  function updateLunarDays() {
    var year = parseInt(lunarYear.value, 10);
    var value = lunarMonth.value;
    var isLeap = value.charAt(0) === "r";
    var month = parseInt(isLeap ? value.slice(1) : value, 10);
    var days = LunarCalendar.lunarMonthDays(year, month, isLeap);
    lunarDay.innerHTML = "";
    for (var day = 1; day <= days; day++) {
      var option = document.createElement("option");
      option.value = day;
      option.textContent = LunarCalendar.LUNAR_DAY[day];
      lunarDay.appendChild(option);
    }
  }
  lunarYear.addEventListener("change", updateLunarMonths);
  lunarMonth.addEventListener("change", updateLunarDays);
  updateLunarMonths();
  var DZ_H = [
    "子",
    "丑",
    "寅",
    "卯",
    "辰",
    "巳",
    "午",
    "未",
    "申",
    "酉",
    "戌",
    "亥",
  ];
  var hs = document.getElementById("zwH");
  for (var i = 0; i < 24; i++) {
    var dzIdx = ZiweiInput.clockHourToBranchIndex(i);
    var o = document.createElement("option");
    o.value = i;
    o.textContent = i + "点 (" + DZ_H[dzIdx] + "时)";
    if (i === 2) o.selected = true;
    hs.appendChild(o);
  }
  var pSel = document.getElementById("zwProv"),
    cSel = document.getElementById("zwCity"),
    dSel = document.getElementById("zwDist");
  var ps = Object.keys(REGION_DATA);
  ps.forEach(function (p) {
    var o = document.createElement("option");
    o.value = p;
    o.textContent = p;
    pSel.appendChild(o);
  });
  function uc() {
    cSel.innerHTML = "";
    dSel.innerHTML = "";
    var cs = REGION_DATA[pSel.value];
    if (!cs) return;
    Object.keys(cs).forEach(function (c) {
      var o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      cSel.appendChild(o);
    });
    ud();
  }
  function ud() {
    dSel.innerHTML = "";
    var cs = REGION_DATA[pSel.value];
    if (!cs) return;
    var ds = cs[cSel.value];
    if (!ds) return;
    ds.forEach(function (d) {
      var o = document.createElement("option");
      o.value = d;
      o.textContent = d;
      dSel.appendChild(o);
    });
  }
  pSel.addEventListener("change", uc);
  cSel.addEventListener("change", ud);
  uc();
})();
function doPaipan() {
  var y, m, d;
  if (currentZwCalendar === "lunar") {
    var lunarYear = parseInt(document.getElementById("zwLY").value, 10);
    var lunarMonthValue = document.getElementById("zwLM").value;
    var lunarDay = parseInt(document.getElementById("zwLD").value, 10);
    var isLeapMonth = lunarMonthValue.charAt(0) === "r";
    var lunarMonth = parseInt(isLeapMonth ? lunarMonthValue.slice(1) : lunarMonthValue, 10);
    try {
      var solarDate = LunarCalendar.lunarToSolar(lunarYear, lunarMonth, lunarDay, isLeapMonth);
      y = solarDate.year;
      m = solarDate.month;
      d = solarDate.day;
    } catch (error) {
      alert(error.message || "农历日期转换失败");
      return;
    }
  } else {
    y = parseInt(document.getElementById("zwY").value, 10);
    m = parseInt(document.getElementById("zwM").value, 10);
    d = parseInt(document.getElementById("zwD").value, 10);
  }
  var h = parseInt(document.getElementById("zwH").value),
    min = parseInt(document.getElementById("zwMin").value) || 0;
  var prov = document.getElementById("zwProv").value || "北京市",
    city = document.getElementById("zwCity").value,
    dist = document.getElementById("zwDist").value;
  var gEls = document.getElementsByName("zwGender"),
    isMale = true;
  for (var i = 0; i < gEls.length; i++) {
    if (gEls[i].checked) isMale = gEls[i].value === "male";
  }
  if (
    isNaN(y) ||
    isNaN(m) ||
    isNaN(d) ||
    isNaN(h) ||
    !ZiweiInput.validateSolarDate(y, m, d) ||
    h < 0 ||
    h > 23
  ) {
    alert("出生日期或时间无效");
    return;
  }
  var normalized;
  try {
    normalized = ZiweiInput.normalizeBirth({
      year: y,
      month: m,
      day: d,
      hour: h,
      minute: min,
      gender: isMale ? "male" : "female",
      prov: prov,
      city: city,
      dist: dist,
      calculator: window.BaZiCalculator,
      useTrueSolarTime: document.getElementById("zwSolarEnabled").checked,
      ziHourNextDay: document.getElementById("zwZishiHuanri").checked,
    });
  } catch (err) {
    alert(err.message || "出生时间校正失败");
    return;
  }
  var th = normalized.trueHour,
    tm2 = normalized.trueMinute,
    ti = normalized.timeIndex;
  document.getElementById("infoBar").innerHTML =
    "<div class=loading><div class=spinner></div><p>排盘中...</p></div>";
  document.getElementById("zwGrid").innerHTML = "";
  document.getElementById("svgLines").innerHTML = "";
  document.getElementById("triads").innerHTML = "";
  window._zwBirth = {
    y: y,
    m: m,
    d: d,
    h: h,
    min: min,
    isMale: isMale,
    prov: prov,
    city: city,
    dist: dist,
    calendar: currentZwCalendar,
    useTrueSolarTime: document.getElementById("zwSolarEnabled").checked,
    ziHourNextDay: document.getElementById("zwZishiHuanri").checked,
  };
  setTimeout(function () {
    try {
      var iz = window.iztro || iztro;
      var zi = iz.astro.bySolar(
        normalized.solarDate,
        ti,
        isMale ? "male" : "female",
        true,
        "zh-CN",
      );
      renderChart(zi, y, m, d, h, min, ti, isMale, th, tm2, normalized);
    } catch (err) {
      document.getElementById("infoBar").textContent =
        "排盘失败：" + (err.message || "请检查出生信息");
    }
  }, 50);
}
function renderChart(zi, y, m, d, h, min, ti, isMale, th, tm2, normalized) {
  var b2p = {};
  zi.palaces.forEach(function (p) {
    b2p[p.earthlyBranch] = p;
  });
  var sb = ZiweiInput.getSoulBodyBranches(zi),
    mingZhi = sb.soul,
    shenZhi = sb.body;
  var mingPal = mingZhi ? mingZhi + "宫" : "",
    shenPalName = b2p[shenZhi] ? ZiweiProfessional.normalizePalaceName(b2p[shenZhi].name) : "",
    shenPal = shenZhi ? shenZhi + "宫" + (shenPalName ? "（" + shenPalName + "宫）" : "") : "";
  var genderName = ZiweiInput.getGenderDesignation(
    zi.chineseDate,
    isMale ? "male" : "female",
  );
  document.getElementById("infoBar").innerHTML =
    "命宫：<b>" +
    mingPal +
    "</b> | " +
    zi.fiveElementsClass +
    " | 身宫：<b>" +
    shenPal +
    "</b> | 命主：<b>" +
    zi.soul +
    "</b> | 身主：<b>" +
    zi.body +
    "</b> | " +
    genderName;
  var yearGz = (zi.chineseDate || "").split(/\s+/)[0] || "";
  var currentHoroscope = ZiweiProfessional.getCurrentHoroscope(zi, new Date());
  var yearly = currentHoroscope && currentHoroscope.yearly;
  var order = [
    "巳",
    "午",
    "未",
    "申",
    "辰",
    "酉",
    "卯",
    "戌",
    "寅",
    "丑",
    "子",
    "亥",
  ];
  var rc = {
    巳: "1/1",
    午: "1/2",
    未: "1/3",
    申: "1/4",
    辰: "2/1",
    酉: "2/4",
    卯: "3/1",
    戌: "3/4",
    寅: "4/1",
    丑: "4/2",
    子: "4/3",
    亥: "4/4",
  };
  var grid = document.getElementById("zwGrid");
  var sihuaCol = [];
  order.forEach(function (zhi) {
    var p = b2p[zhi];
    if (!p) return;
    var isMing = zhi === mingZhi,
      isShen = zhi === shenZhi;
    var cell = document.createElement("div");
    cell.className =
      "palace" + (isMing ? " ming" : "") + (isShen ? " shen" : "");
    var parts = rc[zhi].split("/");
    cell.style.gridRow = parts[0];
    cell.style.gridColumn = parts[1];
    cell.setAttribute("data-zhi", zhi);
    var sh = "",
      hc = { 禄: "#4CAF50", 权: "#FF9800", 科: "#2196F3", 忌: "#F44336" };
    (p.majorStars || []).forEach(function (s, i) {
      var c = sc[s.name] || "#d0c8b0",
        bl = s.brightness || "";
      var bt = bl
        ? "<sup class=b style=color:" +
          (["庙", "旺"].indexOf(bl) >= 0
            ? "#e04040"
            : bl === "得"
              ? "#e8a040"
              : "#888") +
          ">" +
          bl +
          "</sup>"
        : "";
      sh +=
        "<span class=s" +
        (i === 0 ? " major" : "") +
        " style=color:" +
        c +
        ">" +
        s.name +
        bt +
        (s.mutagen && hc[s.mutagen]
          ? " <span style=color:" +
            hc[s.mutagen] +
            ";font-weight:bold>" +
            s.mutagen +
            "</span>"
          : "") +
        "</span>";
      if (s.mutagen && hc[s.mutagen])
        sihuaCol.push({
          star: s.name,
          hua: s.mutagen,
          palace: p.name,
          zhi: zhi,
          color: hc[s.mutagen],
        });
    });
    (p.minorStars || []).forEach(function (s) {
      var bl = s.brightness || "",
        bt = bl ? "<sup class=b style=color:#888>" + bl + "</sup>" : "";
      sh +=
        "<span class=s style=color:#9098a0;font-size:11px>" +
        s.name +
        bt +
        (s.mutagen && hc[s.mutagen]
          ? " <span style=color:" +
            hc[s.mutagen] +
            ";font-weight:bold>" +
            s.mutagen +
            "</span>"
          : "") +
        "</span>";
    });
    (p.adjectiveStars || []).forEach(function (s) {
      var bl = s.brightness || "";
      sh +=
        '<span class="s za" data-star="' +
        s.name +
        '" style=color:#6a6570;font-size:11px>' +
        s.name +
        (bl ? "<sup class=b style=color:#888>" + bl + "</sup>" : "") +
        "</span>";
    });
    if (!sh) sh = "<span class=s style=color:#555>—</span>";
    var bl = [p.boshi12 || "", p.jiangqian12 || "", p.suiqian12 || ""].filter(
      Boolean,
    );
    var dx =
      p.decadal && p.decadal.range
        ? p.decadal.range[0] + "~" + p.decadal.range[1]
        : "";
    var xx = (p.ages || [])
      .slice(0, 8)
      .filter(function (a) {
        return a <= 60;
      })
      .join(",");
    var ln =
      yearly && yearly.palaceNames ? yearly.palaceNames[p.index] || "" : "";
    var gz = p.heavenlyStem + p.earthlyBranch;
    cell.innerHTML =
      "<div class=stars>" +
      sh +
      "</div><div class=mid><div class=row1><span class=ln-label>流年</span>" +
      ln
        .split(",")
        .map(function (n) {
          return "<span>" + n + "</span>";
        })
        .join("") +
      "</div><div class=row2><span class=xx-label>小限</span>" +
      xx
        .split(",")
        .map(function (n) {
          return "<span>" + n + "</span>";
        })
        .join("") +
      "</div><div class=daxian>" +
      dx +
      "</div></div><div class=bot-l>" +
      bl
        .map(function (x) {
          return "<span>" + x + "</span>";
        })
        .join("") +
      "</div><div class=bot-r><span class=zs>" +
      (p.changsheng12 || "") +
      "</span><span class=gz>" +
      gz.charAt(0) +
      "</span><span class=gz>" +
      gz.charAt(1) +
      "</span></div><div class=pname>" +
      p.name +
      "</div>";
    cell.addEventListener("click", function () {
      showTriLinks(zhi, p.name);
    });
    grid.appendChild(cell);
  });
  sihuaCol = ZiweiProfessional.collectMutagens(zi);
  var sihuaLine = sihuaCol.length
    ? "<div class=c-info style=margin-top:6px>四化：" +
      sihuaCol
        .map(function (sh) {
          return (
            "<span style=color:" +
            sh.color +
            ";font-weight:bold>" +
            sh.star +
            sh.hua +
            "</span>"
          );
        })
        .join(" ") +
      "</div>"
    : "";
  var center = document.createElement("div");
  center.className = "center-cell";
  center.style.gridRow = "2/4";
  center.style.gridColumn = "2/4";
  center.innerHTML =
    "<div class=c-title>" +
    zi.fiveElementsClass.replace("局", "") +
    "<br>局</div><div class=c-info style=font-size:9px>" +
    ZiweiInput.formatChartBirth(normalized) +
    "</div><div class=c-info style=font-size:9px>农历 " +
    yearGz +
    "年</div><div class=c-info style=font-size:9px>" +
    (normalized && normalized.summary ? normalized.summary : "排盘时间 " + pad(th) + ":" + pad(tm2)) +
    " · 钟表 " + h + ":" + pad(min) + "</div>" +
    sihuaLine +
    "<div class=c-info>命主 " +
    zi.soul +
    "</div><div class=c-info>身主 " +
    zi.body +
    "</div><div class=c-info style=color:var(--gold-l);font-size:10px;margin-top:2px>身宫 " +
    shenPal +
    "</div>";
  grid.appendChild(center);
  var td = document.getElementById("triads");
  ZiweiProfessional.getPalaceTriadGroups().forEach(function (t) {
    var card = document.createElement("div");
    card.className = "triad-card";
    card.innerHTML =
      "<div class=t-name>" +
      t.name +
      "</div><div class=t-palaces>" +
      t.palaces.join(" · ") +
      "</div><div class=t-summary>" +
      t.summary +
      "</div>";
    td.appendChild(card);
  });
  window._sihuaCol = sihuaCol;
  document.getElementById("zwModeBar").style.display = "flex";
  setTimeout(function () {
    renderZwAnalysis(zi);
    saveZwData(zi, normalized, currentHoroscope);
  }, 100);
}
function saveZwData(zi, normalized, currentHoroscope) {
  var bd = window._zwBirth || {};
  var rp =
    "y=" +
    bd.y +
    "&m=" +
    bd.m +
    "&d=" +
    bd.d +
    "&h=" +
    bd.h +
    "&min=" +
    (bd.min || 0) +
    "&g=" +
    (bd.isMale ? "male" : "female") +
    "&prov=" +
    encodeURIComponent(bd.prov || "") +
    "&city=" +
    encodeURIComponent(bd.city || "") +
    "&dist=" +
    encodeURIComponent(bd.dist || "") +
    "&cal=" +
    encodeURIComponent(bd.calendar || "solar") +
    "&solar=" +
    (bd.useTrueSolarTime === false ? "0" : "1") +
    "&zishi=" +
    (bd.ziHourNextDay ? "1" : "0");
  var lb =
    (bd.isMale ? "男命" : "女命") +
    " · " +
    bd.y +
    "年" +
    bd.m +
    "月" +
    bd.d +
    "日";
  var zd = ZiweiProfessional.buildChatData(zi, bd, normalized, currentHoroscope);
  localStorage.setItem("ai_ziwei_data", JSON.stringify(zd));
  localStorage.setItem("last_ziwei_params", rp);
  if (typeof Auth !== "undefined" && typeof Auth.syncData === "function") {
    Auth.getData("saved_ziwei_charts")
      .then(function (v) {
        var c = [];
        try {
          c = JSON.parse(v || "[]");
        } catch (e) {}
        var ex = c.findIndex(function (x) {
          return x.params === rp;
        });
        if (ex >= 0) c.splice(ex, 1);
        c.unshift({
          label: lb,
          params: rp,
          mingGong: zd.mingGong,
          saved_at: new Date().toISOString(),
        });
        if (c.length > 20) c = c.slice(0, 20);
        Auth.syncData("saved_ziwei_charts", JSON.stringify(c));
      })
      ["catch"](function () {});
  }
}
window.showTriLinks = function (zhi) {
  var all = document.querySelectorAll(".palace");
  all.forEach(function (el) {
    el.classList.remove("hl", "hl2");
  });
  var zi = DZ.indexOf(zhi),
    opp = (zi + 6) % 12,
    tr = tg[zi % 4];
  all.forEach(function (el) {
    var cz = el.getAttribute("data-zhi");
    if (!cz) return;
    var ci = DZ.indexOf(cz);
    if (ci === zi) el.classList.add("hl");
    else if (tr.indexOf(ci) >= 0) el.classList.add("hl");
    else if (ci === opp) el.classList.add("hl2");
  });
  drawLines(zi, tr, opp);
};
function drawLines(ci, tr, opp) {
  var svg = document.getElementById("svgLines"),
    gr = document.getElementById("zwGrid").getBoundingClientRect();
  function cp(z) {
    var el = document.querySelector('.palace[data-zhi="' + DZ[z] + '"]');
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - gr.left,
      y: r.top + r.height / 2 - gr.top,
    };
  }
  svg.setAttribute("viewBox", "0 0 " + gr.width + " " + gr.height);
  svg.style.width = gr.width + "px";
  svg.style.height = gr.height + "px";
  var h = "",
    cpp = cp(ci);
  if (!cpp) return;
  tr.forEach(function (t) {
    if (t === ci) return;
    var tp = cp(t);
    if (tp)
      h +=
        '<line x1="' +
        cpp.x +
        '" y1="' +
        cpp.y +
        '" x2="' +
        tp.x +
        '" y2="' +
        tp.y +
        '"/>';
  });
  var op = cp(opp);
  if (op)
    h +=
      '<line class=opp x1="' +
      cpp.x +
      '" y1="' +
      cpp.y +
      '" x2="' +
      op.x +
      '" y2="' +
      op.y +
      '"/>';
  svg.innerHTML = h;
}
window.switchZwMode = function (m) {
  window._zwMode = m;
  document.querySelectorAll(".zw-mode-btn").forEach(function (b) {
    b.classList.remove("active");
  });
  var ab = document.querySelector(".zw-mode-btn[onclick*='" + m + "']");
  if (ab) ab.classList.add("active");
  var ps = document.querySelectorAll(".palace");
  ps.forEach(function (p) {
    p.classList.remove("hua-lu", "hua-quan", "hua-ke", "hua-ji", "hl", "hl2");
  });
  document.getElementById("svgLines").innerHTML = "";
  var zaHide = [
    "天厨",
    "天德",
    "月德",
    "台辅",
    "封诰",
    "恩光",
    "天月",
    "天官",
    "天福",
    "蜚廉",
    "天贵",
    "龙德",
    "大耗",
    "劫煞",
    "截空",
    "副截",
    "空亡",
  ];
  document.querySelectorAll(".za").forEach(function (z) {
    var sn = z.getAttribute("data-star") || "";
    z.style.display = m === "sanhe" || zaHide.indexOf(sn) < 0 ? "" : "none";
  });
  if (m === "sihua" && window._sihuaCol) {
    var hc = { 禄: "hua-lu", 权: "hua-quan", 科: "hua-ke", 忌: "hua-ji" };
    window._sihuaCol.forEach(function (sh) {
      ps.forEach(function (el) {
        var pn = el.querySelector(".pname");
        if (pn && pn.textContent === sh.palace) el.classList.add(hc[sh.hua]);
      });
    });
    drawSiHuaLines();
  } else if (m === "feixing") {
    drawFeiXingLines();
  }
};

function drawSiHuaLines() {
  if (!window._sihuaCol || !window._sihuaCol.length) return;
  var svg = document.getElementById("svgLines"),
    gr = document.getElementById("zwGrid").getBoundingClientRect();
  var sm = {};
  window._sihuaCol.forEach(function (sh) {
    sm[sh.hua] = sh.zhi;
  });
  function cpp(z) {
    var el = document.querySelector('.palace[data-zhi="' + z + '"]');
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - gr.left,
      y: r.top + r.height / 2 - gr.top,
    };
  }
  svg.setAttribute("viewBox", "0 0 " + gr.width + " " + gr.height);
  svg.style.width = gr.width + "px";
  svg.style.height = gr.height + "px";
  var hc = { 禄: "#4CAF50", 权: "#FF9800", 科: "#2196F3", 忌: "#F44336" };
  var ord = ["禄", "权", "科", "忌"];
  var html = "";
  for (var i = 0; i < ord.length; i++) {
    var fz = sm[ord[i]],
      tz = sm[ord[(i + 1) % 4]],
      c = hc[ord[i]];
    if (fz && tz) {
      var fp = cpp(fz),
        tp = cpp(tz);
      if (fp && tp)
        html +=
          '<line x1="' +
          fp.x +
          '" y1="' +
          fp.y +
          '" x2="' +
          tp.x +
          '" y2="' +
          tp.y +
          '" style="stroke:' +
          c +
          ';stroke-width:2;stroke-dasharray:6 3"/>';
    }
  }
  svg.innerHTML = html;
}

function drawFeiXingLines() {
  var svg = document.getElementById("svgLines"),
    gr = document.getElementById("zwGrid").getBoundingClientRect();
  var DZ2 = [
    "子",
    "丑",
    "寅",
    "卯",
    "辰",
    "巳",
    "午",
    "未",
    "申",
    "酉",
    "戌",
    "亥",
  ];
  var tr = { 0: [0, 4, 8], 1: [1, 5, 9], 2: [2, 6, 10], 3: [3, 7, 11] };
  function cpp(z) {
    var el = document.querySelector('.palace[data-zhi="' + z + '"]');
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - gr.left,
      y: r.top + r.height / 2 - gr.top,
    };
  }
  svg.setAttribute("viewBox", "0 0 " + gr.width + " " + gr.height);
  svg.style.width = gr.width + "px";
  svg.style.height = gr.height + "px";
  var html = "";
  for (var i = 0; i < 12; i++) {
    var zhi = DZ2[i];
    var fp = cpp(zhi);
    if (!fp) continue;
    var tri = tr[i % 4];
    tri.forEach(function (t) {
      if (t === i) return;
      var tp = cpp(DZ2[t]);
      if (tp)
        html +=
          '<line x1="' +
          fp.x +
          '" y1="' +
          fp.y +
          '" x2="' +
          tp.x +
          '" y2="' +
          tp.y +
          '" style="stroke:rgba(201,168,76,.15);stroke-width:1"/>';
    });
    var opp = (i + 6) % 12;
    var op = cpp(DZ2[opp]);
    if (op)
      html +=
        '<line x1="' +
        fp.x +
        '" y1="' +
        fp.y +
        '" x2="' +
        op.x +
        '" y2="' +
        op.y +
        '" style="stroke:rgba(91,159,212,.12);stroke-width:1"/>';
  }
  svg.innerHTML = html;
}
