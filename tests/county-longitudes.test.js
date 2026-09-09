const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const { renderModule } = require('../scripts/build-county-longitudes');

const ROOT = path.resolve(__dirname, '..');

function loadRegionData() {
  const source = fs.readFileSync(path.join(ROOT, 'js', 'region.js'), 'utf8');
  const context = {};
  vm.runInNewContext(`${source}\nthis.__regionData = REGION_DATA;`, context, {
    filename: 'js/region.js'
  });
  return context.__regionData;
}

function loadLongitudeData() {
  const source = fs.readFileSync(path.join(ROOT, 'js', 'county-longitudes.js'), 'utf8');
  const context = { module: { exports: {} }, exports: {} };
  vm.runInNewContext(source, context, { filename: 'js/county-longitudes.js' });
  return context.module.exports.VERSION ? context.module.exports : context.CountyLongitudeData;
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

test('county longitude snapshot covers every selector path exactly once', () => {
  const paths = flattenRegionData(loadRegionData());
  const longitudeData = loadLongitudeData();
  const source = fs.readFileSync(path.join(ROOT, 'js', 'county-longitudes.js'), 'utf8');
  const recordsBlock = source.match(/"records": \{([\s\S]*?)\n  \},\n  "aliases": \{/);
  assert.ok(recordsBlock, 'missing generated records block');
  const generatedKeys = [...recordsBlock[1].matchAll(/^    "([^"]+)": \{$/gm)].map((match) => match[1]);

  assert.equal(paths.length, 2902);
  assert.equal(new Set(paths).size, 2902);
  assert.equal(new Set(generatedKeys).size, generatedKeys.length, 'generated source contains duplicate record keys');
  for (const key of paths) {
    const row = longitudeData.records[key];
    assert.ok(row, `missing ${key}`);
    assert.equal(Number.isFinite(row.longitude), true, key);
    assert.ok(row.longitude >= 73 && row.longitude <= 136, key);
    assert.equal(typeof row.source, 'string', `${key} source`);
    assert.ok(row.source.length > 0, `${key} source`);
    assert.equal(typeof row.sourceId, 'string', `${key} sourceId`);
    assert.ok(row.sourceId.length > 0, `${key} sourceId`);
  }
  assert.deepEqual(Object.keys(longitudeData.records).sort(), paths.sort());
});

test('Shijiazhuang selector includes Xinji with an exact reviewed longitude', () => {
  const regionData = loadRegionData();
  const longitudeData = loadLongitudeData();
  const key = '河北省|石家庄市|辛集市';

  assert.ok(regionData['河北省']['石家庄市'].includes('辛集市'));
  const row = longitudeData.records[key];
  assert.equal(row.longitude, 115.217451);
  assert.equal(row.source, 'administrative-center-reviewed');
  assert.equal(row.sourceId, '130181');
  const resolved = longitudeData.resolveLocation({
    province: '河北省', city: '石家庄市', district: '辛集市'
  }, { allowFallback: false });
  assert.equal(resolved.longitude, 115.217451);
  assert.equal(resolved.level, 'county');
  assert.equal(resolved.source, 'administrative-center-reviewed');
  assert.equal(resolved.sourceVersion, 'county-centroid-v1');
  assert.equal(resolved.matchedKey, key);
  assert.equal(resolved.estimated, false);
});

test('duplicate district names never create county-only or two-part lookup keys', () => {
  const paths = flattenRegionData(loadRegionData());
  const longitudeData = loadLongitudeData();
  const byDistrict = new Map();

  for (const fullPath of paths) {
    const [province, city, district] = fullPath.split('|');
    const occurrences = byDistrict.get(district) || [];
    occurrences.push({ province, city });
    byDistrict.set(district, occurrences);
  }

  const duplicateGroups = [...byDistrict.entries()].filter(([, rows]) => rows.length > 1);
  assert.equal(duplicateGroups.length, 38);
  for (const [district, rows] of duplicateGroups) {
    assert.equal(Object.hasOwn(longitudeData.records, district), false, district);
    assert.equal(Object.hasOwn(longitudeData.aliases, district), false, district);
    for (const { province, city } of rows) {
      assert.equal(Object.hasOwn(longitudeData.records, `${province}|${district}`), false);
      assert.equal(Object.hasOwn(longitudeData.records, `${city}|${district}`), false);
      assert.equal(Object.hasOwn(longitudeData.aliases, `${province}|${district}`), false);
      assert.equal(Object.hasOwn(longitudeData.aliases, `${city}|${district}`), false);
    }
  }
});

test('snapshot metadata pins versioned and reviewable source provenance', () => {
  const longitudeData = loadLongitudeData();
  const manifest = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'scripts', 'county-longitude-source-manifest.json'),
    'utf8'
  ));
  const overrides = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'scripts', 'county-longitude-overrides.json'),
    'utf8'
  ));

  assert.equal(longitudeData.VERSION, 'county-centroid-v1');
  assert.equal(manifest.version, longitudeData.VERSION);
  assert.equal(overrides.version, longitudeData.VERSION);
  assert.match(manifest.retrievedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(manifest.dataV.urlTemplate, /geo\.datav\.aliyun\.com\/areas_v3\/bound\/\{adcode\}_full\.json/);
  assert.match(manifest.dataV.licenseNotes, /DataV|Aliyun/i);
  assert.match(manifest.taiwan.licenseNotes, /ODbL|OpenStreetMap/i);
  assert.equal(Object.keys(overrides.coordinates).filter((key) => key.startsWith('台湾省|')).length, 40);

  for (const [url, sha256] of Object.entries(manifest.dataV.responses)) {
    assert.match(url, /^https:\/\/geo\.datav\.aliyun\.com\/areas_v3\/bound\/\d+_full\.json$/);
    assert.match(sha256, /^[a-f0-9]{64}$/);
  }
  for (const [key, row] of Object.entries(overrides.coordinates)) {
    assert.equal(key.split('|').length, 3, key);
    assert.equal(typeof row.source, 'string', key);
    assert.ok(row.source.length > 0, key);
    assert.equal(typeof row.sourceId, 'string', key);
    assert.ok(row.sourceId.length > 0, key);
    assert.notEqual(row.sourceId, 'verified-at-generation', key);
  }
  for (const [from, to] of Object.entries(overrides.aliases)) {
    assert.equal(from.split('|').length, 3, from);
    assert.equal(to.split('|').length, 3, to);
  }
});

test('snapshot includes Hong Kong, Macau, and all reviewed Taiwan districts', () => {
  const longitudeData = loadLongitudeData();
  const keys = Object.keys(longitudeData.records);

  assert.equal(keys.filter((key) => key.startsWith('香港特别行政区|')).length, 18);
  assert.equal(keys.filter((key) => key.startsWith('澳门特别行政区|')).length, 7);
  assert.equal(keys.filter((key) => key.startsWith('台湾省|')).length, 40);
});

test('legacy complete locations may fall back while new submissions can require an exact county', () => {
  const longitudeData = loadLongitudeData();
  const legacyLocation = { province: '北京市', city: '北京市', district: '旧朝阳区名称' };

  const fallback = longitudeData.resolveLocation(legacyLocation, { allowFallback: true });
  assert.equal(fallback.level, 'city_fallback');
  assert.equal(fallback.estimated, true);
  assert.throws(
    () => longitudeData.resolveLocation(legacyLocation, { allowFallback: false }),
    /县级经度未匹配/
  );
});

test('county longitude generator preserves the legacy fallback contract', () => {
  const rendered = renderModule({
    records: {
      '河北省|石家庄市|辛集市': {
        longitude: 115.217451,
        source: 'administrative-center-reviewed',
        sourceId: '130181'
      }
    },
    aliases: {}
  });

  assert.doesNotMatch(rendered, /var complete = parts\.length/);
  assert.match(rendered, /if \(options\.allowFallback === false\)/);
});
