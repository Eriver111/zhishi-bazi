'use strict';

/*
 * Freeze the selector-path county longitude dataset.  The normal build is
 * intentionally networked: each response is checked byte-for-byte against
 * county-longitude-source-manifest.json before it can affect the snapshot.
 * `--freeze-sources` is an explicit maintainer operation for refreshing the
 * pinned inputs and reviewed Taiwan records.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const REGION_FILE = path.join(ROOT, 'js', 'region.js');
const MANIFEST_FILE = path.join(__dirname, 'county-longitude-source-manifest.json');
const OVERRIDES_FILE = path.join(__dirname, 'county-longitude-overrides.json');
const OUTPUT_FILE = path.join(ROOT, 'js', 'county-longitudes.js');
const VERSION = 'county-centroid-v1';
const DATAV_TEMPLATE = 'https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json';
const USER_AGENT = 'county-longitude-freezer/1.0 (+https://www.openstreetmap.org/)';

function loadRegionData() {
  const context = {};
  const source = fs.readFileSync(REGION_FILE, 'utf8');
  vm.runInNewContext(`${source}\nthis.__regionData = REGION_DATA;`, context, { filename: REGION_FILE });
  return context.__regionData;
}

function flattenRegionData(regionData) {
  const paths = [];
  for (const [province, cities] of Object.entries(regionData)) {
    for (const [city, districts] of Object.entries(cities)) {
      for (const district of districts) paths.push(`${province}|${city}|${district}`);
    }
  }
  return paths;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function dataVUrl(adcode) {
  return DATAV_TEMPLATE.replace('{adcode}', String(adcode));
}

function responseFeatures(body, url) {
  const json = JSON.parse(body.toString('utf8'));
  if (!json || !Array.isArray(json.features)) {
    throw new Error(`DataV response has no feature array: ${url}`);
  }
  return json.features;
}

function nameStem(value) {
  return String(value || '')
    .trim()
    .replace(/特别行政区$/u, '')
    .replace(/自治区$/u, '')
    .replace(/自治州$/u, '')
    .replace(/自治县$/u, '')
    .replace(/省$/u, '')
    .replace(/市$/u, '')
    .replace(/州$/u, '')
    .replace(/地区$/u, '')
    .replace(/盟$/u, '')
    .replace(/区$/u, '')
    .replace(/县$/u, '')
    .replace(/旗$/u, '');
}

function nameMatches(selectorName, sourceName) {
  const selector = String(selectorName || '').trim();
  const source = String(sourceName || '').trim();
  if (selector === source) return true;
  if (!selector || !source) return false;
  if (nameStem(selector) === nameStem(source)) return true;
  const explicitNames = {
    '广西': '广西壮族自治区',
    '宁夏': '宁夏回族自治区',
    '新疆': '新疆维吾尔自治区'
  };
  if (explicitNames[selector] === source || explicitNames[source] === selector) return true;
  const selectorStem = nameStem(selector);
  if (selector.endsWith('州') && source.startsWith(selectorStem) && source.endsWith('自治州')) return true;
  if (selector.endsWith('县') && source.startsWith(selectorStem) && source.endsWith('自治县')) return true;
  if (selector.endsWith('区') && source.startsWith(selectorStem) && source.endsWith('族区')) return true;
  return false;
}

function comparableChinese(value) {
  const traditional = {
    '万': '萬', '与': '與', '东': '東', '临': '臨', '丰': '豐', '丽': '麗', '义': '義',
    '乌': '烏', '乡': '鄉', '书': '書', '买': '買', '亚': '亞', '产': '產', '仅': '僅',
    '从': '從', '仓': '倉', '仪': '儀', '众': '眾', '优': '優', '会': '會', '伟': '偉',
    '传': '傳', '伤': '傷', '伦': '倫', '体': '體', '余': '餘', '佛': '佛', '作': '作', '内': '內',
    '你': '你', '侨': '僑', '俭': '儉', '储': '儲', '儿': '兒', '兑': '兌', '兰': '蘭',
    '关': '關', '兴': '興', '养': '養', '兽': '獸', '冈': '岡', '凤': '鳳', '划': '劃', '区': '區',
    '创': '創', '删': '刪', '别': '別', '华': '華', '协': '協', '县': '縣', '历': '歷',
    '厉': '厲', '压': '壓', '厌': '厭', '厅': '廳', '历': '歷', '厕': '廁', '发': '發',
    '台': '臺', '叶': '葉', '号': '號', '合': '合', '后': '後', '吗': '嗎', '听': '聽',
    '启': '啟', '员': '員', '呜': '嗚', '咏': '詠', '响': '響', '哪': '哪', '园': '園',
    '围': '圍', '图': '圖', '场': '場', '坏': '壞', '块': '塊', '坚': '堅', '坛': '壇',
    '坝': '壩', '坞': '塢', '垦': '墾', '垫': '墊', '城': '城', '处': '處', '备': '備',
    '复': '復', '够': '夠', '头': '頭', '夺': '奪', '奋': '奮', '奖': '獎', '妇': '婦',
    '妈': '媽', '姊': '姊', '娘': '娘', '宁': '寧', '宝': '寶', '实': '實', '审': '審',
    '宫': '宮', '宽': '寬', '对': '對', '导': '導', '寿': '壽', '将': '將', '尔': '爾',
    '尧': '堯', '层': '層', '岛': '島', '岭': '嶺', '岳': '嶽', '峡': '峽', '崭': '嶄',
    '巢': '巢', '币': '幣', '帅': '帥', '师': '師', '帐': '帳', '带': '帶', '帮': '幫',
    '广': '廣', '庄': '莊', '庆': '慶', '库': '庫', '应': '應', '庐': '廬', '庙': '廟',
    '开': '開', '异': '異', '弃': '棄', '张': '張', '强': '強', '归': '歸', '当': '當',
    '录': '錄', '彻': '徹', '忆': '憶', '忧': '憂', '怀': '懷', '态': '態', '总': '總',
    '恳': '懇', '惊': '驚', '惧': '懼', '惩': '懲', '惯': '慣', '憾': '憾', '戏': '戲',
    '执': '執', '扩': '擴', '扫': '掃', '扬': '揚', '护': '護', '报': '報', '拟': '擬',
    '担': '擔', '择': '擇', '挂': '掛', '挥': '揮', '损': '損', '换': '換', '据': '據',
    '摄': '攝', '摆': '擺', '摇': '搖', '攀': '攀', '敌': '敵', '数': '數', '斋': '齋',
    '断': '斷', '旧': '舊', '时': '時', '显': '顯', '晋': '晉', '晓': '曉', '暂': '暫',
    '术': '術', '杂': '雜', '权': '權', '条': '條', '来': '來', '杨': '楊', '极': '極',
    '构': '構', '栏': '欄', '树': '樹', '桥': '橋', '检': '檢', '楼': '樓', '欢': '歡',
    '气': '氣', '汉': '漢', '汤': '湯', '沟': '溝', '泪': '淚', '洁': '潔', '济': '濟',
    '浑': '渾', '浓': '濃', '涛': '濤', '涌': '湧', '湾': '灣', '湿': '濕', '滩': '灘',
    '滨': '濱', '满': '滿', '滤': '濾', '灵': '靈', '灾': '災', '炉': '爐', '点': '點',
    '炼': '煉', '热': '熱', '爱': '愛', '爷': '爺', '牵': '牽', '状': '狀', '独': '獨',
    '猎': '獵', '环': '環', '现': '現', '珑': '瓏', '电': '電', '画': '畫', '畅': '暢',
    '疗': '療', '疯': '瘋', '发': '發', '皱': '皺', '盐': '鹽', '监': '監', '盖': '蓋',
    '盘': '盤', '眨': '眨', '着': '著', '矾': '礬', '码': '碼', '矿': '礦', '研': '研',
    '确': '確', '礼': '禮', '祯': '禎', '禄': '祿', '秋': '秋', '种': '種', '税': '稅',
    '稳': '穩', '穷': '窮', '竞': '競', '笔': '筆', '简': '簡', '签': '簽', '粱': '粱',
    '红': '紅', '纤': '纖', '绍': '紹', '经': '經', '统': '統', '绝': '絕', '绣': '繡',
    '继': '繼', '绩': '績', '绪': '緒', '绵': '綿', '绿': '綠', '缆': '纜', '网': '網',
    '罗': '羅', '罚': '罰', '翘': '翹', '联': '聯', '胜': '勝', '脏': '髒', '脑': '腦',
    '脸': '臉', '脱': '脫', '舰': '艦', '艺': '藝', '节': '節', '芜': '蕪', '苏': '蘇',
    '苹': '蘋', '范': '範', '茂': '茂', '荆': '荊', '荣': '榮', '药': '藥', '莲': '蓮',
    '获': '獲', '莒': '莒', '营': '營', '萧': '蕭', '萝': '蘿', '蓝': '藍', '蓬': '蓬',
    '蔚': '蔚', '蔡': '蔡', '虾': '蝦', '蚀': '蝕', '蛮': '蠻', '补': '補', '装': '裝',
    '见': '見', '观': '觀', '规': '規', '觉': '覺', '览': '覽', '订': '訂', '计': '計',
    '认': '認', '让': '讓', '议': '議', '讯': '訊', '记': '記', '讲': '講', '设': '設',
    '访': '訪', '证': '證', '评': '評', '词': '詞', '译': '譯', '试': '試', '话': '話',
    '该': '該', '详': '詳', '语': '語', '说': '說', '请': '請', '读': '讀', '调': '調',
    '谈': '談', '谋': '謀', '谭': '譚', '贝': '貝', '负': '負', '贡': '貢', '财': '財',
    '责': '責', '贤': '賢', '败': '敗', '货': '貨', '质': '質', '贪': '貪', '贵': '貴',
    '费': '費', '资': '資', '赏': '賞', '赔': '賠', '赖': '賴', '赶': '趕', '趋': '趨',
    '车': '車', '轨': '軌', '转': '轉', '轮': '輪', '软': '軟', '轰': '轟', '轻': '輕',
    '较': '較', '边': '邊', '辽': '遼', '达': '達', '迁': '遷', '选': '選', '逊': '遜',
    '递': '遞', '郁': '鬱', '邮': '郵', '邻': '鄰', '郑': '鄭', '邻': '鄰', '鉴': '鑑',
    '长': '長', '门': '門', '闪': '閃', '闭': '閉', '问': '問', '闻': '聞', '阁': '閣',
    '队': '隊', '阳': '陽', '阴': '陰', '际': '際', '陆': '陸', '陈': '陳', '隐': '隱',
    '难': '難', '雄': '雄', '雅': '雅', '韦': '韋', '韩': '韓', '顺': '順', '须': '須',
    '顾': '顧', '顿': '頓', '领': '領', '频': '頻', '风': '風', '飞': '飛', '饭': '飯',
    '饮': '飲', '饰': '飾', '馆': '館', '马': '馬', '驳': '駁', '驶': '駛', '骆': '駱',
    '高': '高', '鱼': '魚', '鸟': '鳥', '鸡': '雞', '麦': '麥', '黄': '黃', '齐': '齊',
    '龙': '龍', '龟': '龜'
  };
  return String(value || '').split('').map((char) => traditional[char] || char).join('');
}

function findUnique(features, selectorName, level, context) {
  const exact = features.filter((feature) => String(feature.properties?.name || '') === selectorName);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) throw new Error(`ambiguous ${level} ${context}|${selectorName}: exact=${exact.length}`);
  const matches = features.filter((feature) => nameMatches(selectorName, feature.properties?.name));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const names = matches.map((feature) => feature.properties?.name).join(',');
    throw new Error(`ambiguous ${level} ${context}|${selectorName}: ${names}`);
  }
  return null;
}

async function fetchBytes(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function fetchPinnedManifest(regionData) {
  const rootUrl = dataVUrl(100000);
  const rootBytes = await fetchBytes(rootUrl);
  const rootFeatures = responseFeatures(rootBytes, rootUrl);
  const urls = new Set([rootUrl]);

  const provinceFeatures = Object.keys(regionData).map((province) => {
    const feature = findUnique(rootFeatures, province, 'province', 'root');
    if (!feature) throw new Error(`missing province ${province} in ${rootUrl}`);
    return feature;
  });

  const provinceBodies = new Map([[rootUrl, rootBytes]]);
  for (const province of provinceFeatures) {
    // DataV exposes Taiwan in the national index but does not publish a
    // 710000_full hierarchy; all 40 selector rows are reviewed Nominatim
    // overrides and therefore need no DataV child response.
    if (String(province.properties.adcode) === '710000') continue;
    const url = dataVUrl(province.properties.adcode);
    urls.add(url);
    provinceBodies.set(url, await fetchBytes(url));
  }

  for (const [url, bytes] of provinceBodies) {
    if (url === rootUrl) continue;
    for (const feature of responseFeatures(bytes, url)) {
      const level = String(feature.properties?.level || '');
      const childrenNum = Number(feature.properties?.childrenNum || 0);
      if ((level === 'city' || level === 'prefecture') && childrenNum > 0) {
        urls.add(dataVUrl(feature.properties.adcode));
      }
    }
  }

  const responses = {};
  for (const url of [...urls].sort()) {
    const bytes = url === rootUrl || provinceBodies.has(url)
      ? provinceBodies.get(url)
      : await fetchBytes(url);
    responses[url] = sha256(bytes);
  }
  return {
    version: VERSION,
    retrievedAt: new Date().toISOString(),
    dataV: {
      urlTemplate: DATAV_TEMPLATE,
      responses,
      licenseNotes: 'Aliyun DataV administrative boundary features; coordinates use properties.center as the administrative center.'
    },
    taiwan: {
      licenseNotes: 'Taiwan selector districts are reviewed OpenStreetMap Nominatim administrative-area results; coordinates are attributed under ODbL 1.0.',
      retrievalNotes: 'Each result records osm_type, osm_id, display_name, query, retrieval date, and ODbL attribution in county-longitude-overrides.json.'
    }
  };
}

function validateManifest(manifest) {
  if (manifest.version !== VERSION) throw new Error(`manifest version must be ${VERSION}`);
  if (!manifest.dataV || !manifest.dataV.responses || !Object.keys(manifest.dataV.responses).length) {
    throw new Error('manifest has no pinned DataV responses');
  }
  for (const [url, hash] of Object.entries(manifest.dataV.responses)) {
    if (!new RegExp(`^https://geo\\.datav\\.aliyun\\.com/areas_v3/bound/\\d+_full\\.json$`).test(url)) {
      throw new Error(`unexpected DataV URL ${url}`);
    }
    if (!/^[a-f0-9]{64}$/u.test(hash)) throw new Error(`invalid SHA-256 for ${url}`);
  }
}

async function fetchPinnedResponses(manifest) {
  validateManifest(manifest);
  const entries = Object.entries(manifest.dataV.responses).sort(([a], [b]) => a.localeCompare(b));
  const responses = new Map();
  for (const [url, expectedHash] of entries) {
    const bytes = await fetchBytes(url);
    const actualHash = sha256(bytes);
    if (actualHash !== expectedHash) {
      throw new Error(`source hash mismatch for ${url}: expected ${expectedHash}, got ${actualHash}`);
    }
    responses.set(url, bytes);
  }
  return responses;
}

function indexFeatures(responses) {
  const byAdcode = new Map();
  for (const [url, bytes] of responses) {
    for (const feature of responseFeatures(bytes, url)) {
      const props = feature.properties || {};
      if (props.adcode == null || !Array.isArray(props.center) || !Number.isFinite(Number(props.center[0]))) {
        throw new Error(`feature lacks numeric properties.center/adcode in ${url}`);
      }
      byAdcode.set(String(props.adcode), { props, url });
    }
  }
  return byAdcode;
}

function featureChildren(responses, adcode) {
  const url = dataVUrl(adcode);
  const bytes = responses.get(url);
  if (!bytes) throw new Error(`missing pinned hierarchy response ${url}`);
  return responseFeatures(bytes, url);
}

async function queryTaiwan(paths, overrides) {
  const taiwanPaths = paths.filter((key) => key.startsWith('台湾省|'));
  const coordinates = {};
  for (let i = 0; i < taiwanPaths.length; i += 1) {
    const key = taiwanPaths[i];
    const [, city, district] = key.split('|');
    const query = `${district}, ${city}, 台湾`;
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.7' }
    });
    if (!response.ok) throw new Error(`Nominatim HTTP ${response.status} for ${key}`);
    const results = await response.json();
    const result = results.find((item) => item.osm_type && item.osm_id && Number.isFinite(Number(item.lon)));
    if (!result) throw new Error(`Nominatim returned no reviewed administrative area for ${key}`);
    const displayName = String(result.display_name || '');
    const displayComparable = comparableChinese(displayName);
    if (![district, city].every((part) => displayComparable.includes(comparableChinese(part)))) {
      throw new Error(`Nominatim name confirmation failed for ${key}: ${displayName}`);
    }
    coordinates[key] = {
      longitude: Number(result.lon),
      source: 'openstreetmap-nominatim-reviewed',
      sourceId: String(result.osm_id),
      osmType: String(result.osm_type),
      osmId: String(result.osm_id),
      displayName,
      query,
      retrievedAt: new Date().toISOString(),
      attribution: 'Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright'
    };
    // Nominatim's published public-service limit is one request per second.
    if (i + 1 < taiwanPaths.length) await new Promise((resolve) => setTimeout(resolve, 1100));
  }
  return { ...overrides, coordinates };
}

function buildRecords(regionData, responses, overrides) {
  const rootFeatures = responseFeatures(responses.get(dataVUrl(100000)), dataVUrl(100000));
  const records = {};
  const missing = [];
  const ambiguous = [];
  const paths = flattenRegionData(regionData);

  for (const key of paths) {
    if (overrides.coordinates[key]) {
      records[key] = { ...overrides.coordinates[key] };
      delete records[key].osmType;
      delete records[key].osmId;
      delete records[key].displayName;
      delete records[key].query;
      delete records[key].retrievedAt;
      delete records[key].attribution;
      continue;
    }
    const [province, city, district] = key.split('|');
    try {
      const provinceFeature = findUnique(rootFeatures, province, 'province', 'root');
      if (!provinceFeature) {
        missing.push(key);
        continue;
      }
      const provinceChildren = featureChildren(responses, provinceFeature.properties.adcode);
      const provinceCode = String(provinceFeature.properties.adcode);
      const municipality = ['110000', '120000', '310000', '500000'].includes(provinceCode)
        && nameMatches(city, provinceFeature.properties.name);
      const groupedSpecialRegion = ['810000', '820000'].includes(provinceCode);
      const cityFeature = municipality
        ? { properties: provinceFeature.properties }
        : groupedSpecialRegion ? { properties: provinceFeature.properties }
          : findUnique(provinceChildren, city, 'city', `${province}`);
      if (!cityFeature) {
        missing.push(key);
        continue;
      }
      const directAdmin = !municipality && !groupedSpecialRegion
        && nameMatches(district, cityFeature.properties.name);
      const districtFeatures = municipality || groupedSpecialRegion
        ? provinceChildren
        : directAdmin ? [cityFeature] : featureChildren(responses, cityFeature.properties.adcode);
      const districtFeature = findUnique(districtFeatures, district, 'district', `${province}|${city}`);
      if (!districtFeature) {
        missing.push(key);
        continue;
      }
      records[key] = {
        longitude: Number(districtFeature.properties.center[0]),
        source: 'administrative-center',
        sourceId: String(districtFeature.properties.adcode)
      };
    } catch (error) {
      if (/^ambiguous/u.test(error.message)) ambiguous.push(`${key}: ${error.message}`);
      else throw error;
    }
  }

  const selector = new Set(paths);
  const orphan = Object.keys(records).filter((key) => !selector.has(key));
  if (missing.length || ambiguous.length || orphan.length || Object.keys(records).length !== paths.length) {
    const report = [
      `selector=${paths.length}`,
      `direct+override=${Object.keys(records).length}`,
      `missing=${missing.length}`,
      `ambiguous=${ambiguous.length}`,
      `orphan=${orphan.length}`
    ].join(' ');
    console.error(report);
    if (missing.length) console.error(`missing:\n${missing.join('\n')}`);
    if (ambiguous.length) console.error(`ambiguous:\n${ambiguous.join('\n')}`);
    if (orphan.length) console.error(`orphan:\n${orphan.join('\n')}`);
    throw new Error(`county longitude build aborted: ${report}`);
  }
  return { records, aliases: overrides.aliases || {} };
}

function jsLiteral(value) {
  return JSON.stringify(value, null, 2);
}

function renderModuleTemplate(data) {
  const sortedRecords = Object.fromEntries(Object.entries(data.records).sort(([a], [b]) => a.localeCompare(b)));
  const sortedAliases = Object.fromEntries(Object.entries(data.aliases || {}).sort(([a], [b]) => a.localeCompare(b)));
  const payload = jsLiteral({ VERSION, records: sortedRecords, aliases: sortedAliases });
  return `(function (root, factory) {\n  var data = factory();\n  if (typeof module === 'object' && module.exports) module.exports = data;\n  if (root) root.CountyLongitudeData = data;\n})(typeof globalThis !== 'undefined' ? globalThis : this, function () {\n  var payload = ${payload};\n  var records = Object.freeze(payload.records);\n  var aliases = Object.freeze(payload.aliases);\n  function clean(value) { return String(value == null ? '' : value).trim(); }\n  function keyOf(location) {\n    if (typeof location === 'string') return location.split('|').map(clean).join('|');\n    location = location || {};\n    return [location.province, location.city, location.district].map(clean).join('|');\n  }\n  function result(row, level, matchedKey, estimated) {\n    return { longitude: row.longitude, level: level, source: row.source, sourceVersion: payload.VERSION, matchedKey: matchedKey, estimated: estimated };\n  }\n  function resolveLocation(location, options) {\n    options = options || {};\n    var key = keyOf(location);\n    var row = records[key];\n    if (row) return result(row, 'county', key, false);\n    var aliasKey = aliases[key];\n    if (aliasKey && records[aliasKey]) return result(records[aliasKey], 'county_alias', aliasKey, false);\n    var parts = key.split('|');\n    var complete = parts.length === 3 && parts.every(Boolean);\n    if (options.allowFallback === false || complete) throw new Error('县级经度未匹配: ' + key);\n    var candidates = Object.keys(records).filter(function (candidate) {\n      var c = candidate.split('|');\n      return parts[0] && c[0] === parts[0] && parts[1] && c[1] === parts[1];\n    });\n    if (candidates.length) {\n      var cityLongitude = candidates.reduce(function (sum, candidate) { return sum + records[candidate].longitude; }, 0) / candidates.length;\n      return result({ longitude: Number(cityLongitude.toFixed(6)), source: 'estimated-city', }, 'city_fallback', parts.slice(0, 2).join('|'), true);\n    }\n    candidates = Object.keys(records).filter(function (candidate) { return parts[0] && candidate.indexOf(parts[0] + '|') === 0; });\n    if (candidates.length) {\n      var provinceLongitude = candidates.reduce(function (sum, candidate) { return sum + records[candidate].longitude; }, 0) / candidates.length;\n      return result({ longitude: Number(provinceLongitude.toFixed(6)), source: 'estimated-province' }, 'province_fallback', parts[0], true);\n    }\n    return result({ longitude: 120, source: 'default-fallback' }, 'default_fallback', '', true);\n  }\n  return { VERSION: payload.VERSION, records: records, aliases: aliases, resolveLocation: resolveLocation };\n});\n`;
}

function renderModule(data) {
  return renderModuleTemplate(data).replace(
    "    var complete = parts.length === 3 && parts.every(Boolean);\\n    if (options.allowFallback === false || complete)",
    "    if (options.allowFallback === false)"
  );
}

async function main() {
  const regionData = loadRegionData();
  const paths = flattenRegionData(regionData);
  let manifest = fs.existsSync(MANIFEST_FILE) ? readJson(MANIFEST_FILE) : null;
  let overrides = fs.existsSync(OVERRIDES_FILE) ? readJson(OVERRIDES_FILE) : { version: VERSION, aliases: {}, coordinates: {} };

  if (process.argv.includes('--freeze-sources')) {
    manifest = await fetchPinnedManifest(regionData);
    writeJson(MANIFEST_FILE, manifest);
  }
  if (process.argv.includes('--freeze-taiwan')) {
    overrides = await queryTaiwan(paths, overrides);
    writeJson(OVERRIDES_FILE, overrides);
  }
  if (!manifest) throw new Error(`missing ${MANIFEST_FILE}; run with --freeze-sources`);
  if (overrides.version !== VERSION) throw new Error(`overrides version must be ${VERSION}`);
  const responses = await fetchPinnedResponses(manifest);
  const data = buildRecords(regionData, responses, overrides);
  fs.writeFileSync(OUTPUT_FILE, renderModule(data), 'utf8');
  console.log(`selector=${paths.length} direct+override=${Object.keys(data.records).length} missing=0 ambiguous=0 orphan=0`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

module.exports = { flattenRegionData, nameMatches, renderModule };
