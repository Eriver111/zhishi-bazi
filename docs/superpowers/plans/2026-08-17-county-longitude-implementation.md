# County Longitude and True Solar Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every one of the current 2,901 province/city/county selector paths a frozen county administrative-center longitude and use one traceable resolver throughout true-solar-time calculation and display.

**Architecture:** A generated, versioned browser/Node data module owns county longitude records and legacy aliases. `js/bazi.js` consumes one resolver contract and keeps its legacy string signature only as a compatibility adapter; new form, result, Ziwei, and Hepan paths pass the full province/city/county tuple. Calculation output carries match level and dataset version so display and caches disclose exactly which longitude was used without changing paid-report authorization.

**Tech Stack:** Browser JavaScript, Node.js 22 test runner, `vm` test harnesses, static HTML script loading, Playwright for desktop/mobile acceptance.

**Spec:** `docs/superpowers/specs/2026-08-17-county-longitude-and-bazi-audit-design.md`

## Global Constraints

- Cover all 2,901 paths currently declared in `js/region.js`, including mainland China, Hong Kong, Macau, and Taiwan; no exceptions.
- Runtime calculation must be offline and deterministic; no browser geocoding, GPS, detailed-address input, or manual longitude input.
- The coordinate is the county-level administrative center, not the user's exact birthplace.
- The canonical key is `province|city|district`; county-name-only lookup is forbidden.
- New complete selector input must resolve at county level; fallbacks are for historical or incomplete data only and must be visible.
- Four-pillar direct-entry mode continues to bypass true solar time.
- Coordinate data version changes result/cache identity but must not revoke an existing paid-report entitlement.
- Do not modify `palm.html` or `api/palm-reading.js` in this plan.
- Preserve untracked `qa-deep-report-preview.html` and `scripts/audit-p3-baseline-drift.js`.

## File Map

- Create `js/county-longitudes.js`: generated UMD-style frozen records, version metadata, aliases, and resolver API for browser and Node.
- Create `scripts/county-longitude-source-manifest.json`: source URLs, retrieval date, hashes, licenses, and explicit Taiwan source notes.
- Create `scripts/county-longitude-overrides.json`: reviewed name mappings and coordinates that cannot be matched mechanically.
- Create `scripts/build-county-longitudes.js`: fetch/ingest, normalize, match full paths, reject ambiguity, and regenerate the runtime snapshot.
- Create `tests/county-longitudes.test.js`: exhaustive coverage, uniqueness, range, duplicate-name isolation, and source-version tests.
- Modify `js/bazi.js`: consume the resolver, propagate resolution metadata, and retain a legacy adapter.
- Modify `js/main.js`: validate a complete new selection and append `geo_v=county-centroid-v1`.
- Modify `js/result.js`: parse the version, use full location tuples, isolate cache versioning from payment access, and render source/fallback copy.
- Modify `js/ziwei-input.js`: pass the same full location tuple into normalization.
- Modify `paipan.html`, `result.html`, `ziwei.html`, and `hepan-result.html`: load the data module before `js/bazi.js` and bump relevant cache keys.
- Modify focused contract/regression tests named below; do not mechanically update unrelated baselines.

---

### Task 1: Freeze the 2,901-path coordinate snapshot

**Files:**
- Create: `scripts/county-longitude-source-manifest.json`
- Create: `scripts/county-longitude-overrides.json`
- Create: `scripts/build-county-longitudes.js`
- Create: `js/county-longitudes.js`
- Test: `tests/county-longitudes.test.js`

**Interfaces:**
- Consumes: `REGION_DATA` from `js/region.js`; source feature properties `{ name, adcode, center, level }`.
- Produces: `CountyLongitudeData.VERSION === 'county-centroid-v1'`, `CountyLongitudeData.records`, `CountyLongitudeData.aliases`, and `CountyLongitudeData.resolveLocation(location, options)`.

- [ ] **Step 1: Write the failing exhaustive data test**

Load `js/region.js` and the future module in separate `vm` contexts, flatten every selector path, and assert exactly 2,901 one-to-one matches:

```js
test('county longitude snapshot covers every selector path exactly once', () => {
  const paths = flattenRegionData(loadRegionData());
  assert.equal(paths.length, 2901);
  assert.equal(new Set(paths).size, 2901);
  for (const key of paths) {
    const row = longitudeData.records[key];
    assert.ok(row, `missing ${key}`);
    assert.equal(Number.isFinite(row.longitude), true, key);
    assert.ok(row.longitude >= 73 && row.longitude <= 136, key);
  }
  assert.deepEqual(Object.keys(longitudeData.records).sort(), paths.sort());
});
```

Also assert the 38 duplicate-name groups never resolve through a two-part or county-only key.

- [ ] **Step 2: Run the new test and verify the module is missing**

Run: `node --test tests/county-longitudes.test.js`  
Expected: FAIL because `js/county-longitudes.js` does not exist.

- [ ] **Step 3: Add the pinned source manifest and reviewed overrides schema**

The manifest must name the frozen version, retrieval timestamp, response SHA-256 hashes, and licensing/source notes. Use Aliyun DataV administrative-center features from `https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json` for mainland/Hong Kong/Macau. For the 40 Taiwan selector districts, freeze a reviewed OpenStreetMap Nominatim administrative-area result and store its `osm_type`, `osm_id`, `display_name`, query text, retrieval date, and ODbL attribution with the coordinate. The overrides file uses full paths only:

```json
{
  "version": "county-centroid-v1",
  "aliases": {
    "安徽省|巢湖市|庐江县": "安徽省|合肥市|庐江县"
  },
  "coordinates": {
    "台湾省|台北市|中正区": {
      "longitude": 121.5198839,
      "source": "openstreetmap-nominatim-reviewed",
      "osmType": "relation",
      "osmId": "verified-at-generation"
    }
  }
}
```

The generation step replaces `verified-at-generation` with the actual reviewed OSM identifier before the file can pass validation. Do not add a county-name-only alias. Every manual row needs a source label and stable source identifier.

- [ ] **Step 4: Implement the deterministic generator**

The generator must:

1. Parse `REGION_DATA` without editing it.
2. Fetch the DataV hierarchy from the exact URL family above, verify every response against the manifest hash before use, and ingest `properties.center` rather than polygon centroid.
3. Match province, city, and district as a hierarchy rather than globally by name.
4. Apply only explicit full-path aliases/overrides for renamed or unmatched paths and the 40 Taiwan selector districts; query Nominatim only in the offline build command, at its published rate limit, and require manual confirmation of city/district names before freezing each result.
5. Abort with a printed missing/ambiguous list unless matched paths equal selector paths exactly.
6. Emit sorted ASCII JavaScript wrapper code while preserving Chinese data strings.

Expose this exact runtime shape:

```js
{
  VERSION: 'county-centroid-v1',
  records: {
    '河北省|石家庄市|长安区': {
      longitude: 114.548151,
      source: 'administrative-center',
      sourceId: '130102'
    }
  },
  aliases: {},
  resolveLocation: resolveLocation
}
```

- [ ] **Step 5: Generate the snapshot and inspect every exception**

Run: `node scripts/build-county-longitudes.js`  
Expected: `selector=2901 direct+override=2901 missing=0 ambiguous=0 orphan=0`.

Review the generated exception report. Resolve name mismatches only through explicit full-path mappings, never fuzzy first-match behavior.

- [ ] **Step 6: Run exhaustive data tests**

Run: `node --test tests/county-longitudes.test.js`  
Expected: PASS, including Hong Kong, Macau, Taiwan, longitude range, unique keys, and all known duplicate county names.

- [ ] **Step 7: Commit the frozen data unit**

```powershell
git add -- js/county-longitudes.js scripts/build-county-longitudes.js scripts/county-longitude-source-manifest.json scripts/county-longitude-overrides.json tests/county-longitudes.test.js
git commit -m "feat: add complete county longitude snapshot"
```

### Task 2: Add the unified location resolver contract

**Files:**
- Modify: `js/county-longitudes.js`
- Modify: `js/bazi.js:645-684`
- Modify: `js/bazi.js:3889-4074`
- Test: `tests/county-longitudes.test.js`
- Test: `tests/bazi-professional-core.test.js:114-151`

**Interfaces:**
- Consumes: `CountyLongitudeData.resolveLocation({ province, city, district }, { allowFallback })`.
- Produces: `{ longitude, level, source, sourceVersion, matchedKey, estimated }`; `normalizeBirthInput(params).solarInfo.locationResolution`.

- [ ] **Step 1: Write failing resolver tests**

Cover direct county matching, controlled historical alias matching, city/province/default historical fallback, and refusal to fallback for a complete new selection:

```js
assert.deepEqual(
  pick(resolveLocation({ province:'河北省', city:'石家庄市', district:'长安区' })),
  { level:'county', matchedKey:'河北省|石家庄市|长安区', estimated:false }
);
assert.throws(() => resolveLocation(
  { province:'河北省', city:'石家庄市', district:'不存在县' },
  { allowFallback:false }
), /县级经度未匹配/);
```

Use Beijing/Changchun `朝阳区` and Beijing/Nantong `通州区` to prove full-path isolation.

- [ ] **Step 2: Run the focused tests and verify contract failures**

Run: `node --test tests/county-longitudes.test.js tests/bazi-professional-core.test.js`  
Expected: FAIL because current calculation accepts only a loose location string and returns no resolution metadata.

- [ ] **Step 3: Implement `resolveLocation` with explicit fallback policy**

Normalize whitespace and known suffix variants only inside full hierarchical fields. Return:

```js
{
  longitude: 114.548151,
  level: 'county',
  source: 'administrative-center',
  sourceVersion: 'county-centroid-v1',
  matchedKey: '河北省|石家庄市|长安区',
  estimated: false
}
```

Fallback levels set `estimated:true`. `allowFallback:false` throws for a complete unmatched selector path.

- [ ] **Step 4: Route `normalizeBirthInput` and `getTrueSolarHour` through the resolver**

New callers pass a location object:

```js
getTrueSolarHour(hour, {
  province: params.prov || '',
  city: params.city || '',
  district: params.dist || '',
  allowFallback: params.allowLocationFallback !== false
}, year, month, day, minute, clock)
```

Keep existing string calls working through a documented legacy adapter. Add `locationResolution`, `sourceVersion`, `level`, and `estimated` to `solarInfo`; keep `lng`, `lngOffsetMin`, `eotMin`, `dayOffset`, and `hourIndex` stable.

- [ ] **Step 5: Run resolver and solar boundary tests**

Run: `node --test tests/county-longitudes.test.js tests/bazi-professional-core.test.js`  
Expected: PASS, including existing midnight rollover assertions.

- [ ] **Step 6: Commit the resolver integration**

```powershell
git add -- js/county-longitudes.js js/bazi.js tests/county-longitudes.test.js tests/bazi-professional-core.test.js
git commit -m "feat: resolve true solar time by county path"
```

### Task 3: Enforce county matching on new Bazi submissions

**Files:**
- Modify: `paipan.html:1068-1075`
- Modify: `js/main.js:473-545`
- Test: `tests/form-structure-contract.test.js`
- Create: `tests/county-location-submit.test.js`

**Interfaces:**
- Consumes: `CountyLongitudeData.VERSION` and `resolveLocation(..., { allowFallback:false })`.
- Produces: result query fields `prov`, `city`, `dist`, and `geo_v=county-centroid-v1`.

- [ ] **Step 1: Write failing form submission contract tests**

Assert the data script loads before `js/bazi.js`, complete location is validated before navigation, and the URL includes the frozen version:

```js
assert.ok(html.indexOf('js/county-longitudes.js') < html.indexOf('js/bazi.js'));
assert.match(main, /resolveLocation[\s\S]*allowFallback:\s*false/);
assert.match(main, /params\.set\(['"]geo_v['"],\s*CountyLongitudeData\.VERSION\)/);
```

Execute `handleSubmit` in a DOM stub with an unmatched district and assert it shows `县级经度未匹配，请重新选择出生地` without assigning `window.location.href`.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/form-structure-contract.test.js tests/county-location-submit.test.js`  
Expected: FAIL because no county module or `geo_v` validation exists.

- [ ] **Step 3: Load and validate the county module**

Insert `js/county-longitudes.js?v=county-centroid-v1` before `js/bazi.js`. In calendar modes, require province/city/district, call the strict resolver, restore the submit button on error, and do not navigate.

- [ ] **Step 4: Append the data version without changing direct-pillar mode**

For solar/lunar submissions set `geo_v` from the module. Four-pillar direct-entry URLs and behavior remain unchanged.

- [ ] **Step 5: Run form tests**

Run: `node --test tests/form-structure-contract.test.js tests/county-location-submit.test.js tests/paipan-direct-mode-contract.test.js`  
Expected: PASS.

- [ ] **Step 6: Commit the new-submission gate**

```powershell
git add -- paipan.html js/main.js tests/form-structure-contract.test.js tests/county-location-submit.test.js
git commit -m "fix: require county longitude for new charts"
```

### Task 4: Propagate versioned location facts through result and Ziwei flows

**Files:**
- Modify: `result.html:2720-2890`
- Modify: `ziwei.html:120-131`
- Modify: `hepan-result.html:3298-3310`
- Modify: `js/result.js:20-120`
- Modify: `js/result.js:1630-1728`
- Modify: `js/ziwei-input.js:35-92`
- Test: `tests/solar-paipan-regression.test.js`
- Test: `tests/ziwei-professional-core.test.js`
- Test: `tests/report-identity.test.js`

**Interfaces:**
- Consumes: full `{ prov, city, dist }`, URL `geo_v`, and `solarInfo.locationResolution`.
- Produces: consistent Bazi/Ziwei true solar time and cache identity `solarDataVersion`; paid-access identity remains backward compatible.

- [ ] **Step 1: Write failing propagation and identity tests**

Assert result fallback recomputation calls `getTrueSolarHour` with the complete location object, Ziwei passes all three levels into `normalizeBirthInput`, and `reportAnchorKey` includes the effective solar data version while payment access parameters remain unchanged.

Add a history case with no `geo_v`: it must open, resolve with `allowFallback:true`, and record the effective current `sourceVersion` rather than accepting an old cached four-pillar result.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/solar-paipan-regression.test.js tests/ziwei-professional-core.test.js tests/report-identity.test.js`  
Expected: FAIL because result fallback currently passes district/city/province as loose strings and cache identity has no dataset version.

- [ ] **Step 3: Update static script order and cache versions**

Load `js/county-longitudes.js` before `js/bazi.js` on result, Ziwei, and Hepan result pages. Bump only the touched static resource query versions.

- [ ] **Step 4: Propagate the full tuple and effective version**

Parse `geo_v`; calculation always uses the bundled resolver version. Store effective `solarInfo.sourceVersion` in the local report/cache anchor. Do not add `geo_v` to the server entitlement key unless the access layer already supports an optional non-breaking field; paid access for the same birth input must continue to resolve.

- [ ] **Step 5: Run propagation and payment regressions**

Run: `node --test tests/solar-paipan-regression.test.js tests/ziwei-professional-core.test.js tests/report-identity.test.js tests/payment-flow.test.js tests/payment-ui-contract.test.js tests/profile-report-library.test.js`  
Expected: PASS with no entitlement regression.

- [ ] **Step 6: Commit cross-flow propagation**

```powershell
git add -- result.html ziwei.html hepan-result.html js/result.js js/ziwei-input.js tests/solar-paipan-regression.test.js tests/ziwei-professional-core.test.js tests/report-identity.test.js
git commit -m "fix: preserve county solar facts across report flows"
```

### Task 5: Render accurate county and fallback disclosure

**Files:**
- Modify: `js/result.js:138-150`
- Modify: `js/result.js:1630-1660`
- Test: `tests/solar-paipan-regression.test.js`
- Test: `tests/bazi-professional-core.test.js`

**Interfaces:**
- Consumes: `solarInfo.locationResolution`.
- Produces: county copy `按{district}县级行政中心经度 {lng}°E 校正` or explicit estimated fallback copy.

- [ ] **Step 1: Write failing copy tests for every resolution level**

Test `county`, `county_alias`, `city_fallback`, `province_fallback`, `default_fallback`, disabled true-solar-time, and direct-pillar mode. Assert no estimated path contains the old unqualified phrase `经度已校正`.

- [ ] **Step 2: Run copy tests and verify failure**

Run: `node --test tests/solar-paipan-regression.test.js tests/bazi-professional-core.test.js`  
Expected: FAIL because current copy labels province and non-120 longitudes as corrected without source quality.

- [ ] **Step 3: Implement one escaped formatter for source disclosure**

Use text-safe rendering and these rules:

```text
county        -> 按长安区县级行政中心经度 114.548151°E 校正
county_alias  -> 旧地名已映射；按长安区县级行政中心经度 114.548151°E 校正
city_fallback -> 县级经度未匹配，当前按石家庄市经度估算
province_*    -> 县级经度未匹配，当前按河北省经度估算
default_*     -> 出生地经度未匹配，当前按东经 120° 估算
```

- [ ] **Step 4: Run copy and XSS regressions**

Run: `node --test tests/solar-paipan-regression.test.js tests/bazi-professional-core.test.js tests/deep-report-render.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit disclosure copy**

```powershell
git add -- js/result.js tests/solar-paipan-regression.test.js tests/bazi-professional-core.test.js
git commit -m "fix: disclose true solar longitude accuracy"
```

### Task 6: Run complete automated regression and baseline triage

**Files:**
- Modify only if a proven regression requires a focused test correction.
- Do not edit frozen expected values merely to make failures disappear.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: recorded focused/full-suite evidence and a classified failure list.

- [ ] **Step 1: Run the county and solar suite**

Run:

```powershell
node --test tests/county-longitudes.test.js tests/county-location-submit.test.js tests/bazi-professional-core.test.js tests/solar-paipan-regression.test.js tests/ziwei-professional-core.test.js tests/report-identity.test.js
```

Expected: all PASS.

- [ ] **Step 2: Run every repository test**

Run: `node --test tests/*.test.js` through PowerShell-expanded file paths if the wildcard is not accepted by Node on Windows.  
Expected: no new failures relative to the recorded branch baseline; every failure must be listed and compared by test name, not only by total count.

- [ ] **Step 3: Verify generated data reproducibility**

Regenerate into a temporary path and byte-compare it with `js/county-longitudes.js`. Expected: identical bytes from the pinned inputs/overrides, or an explicit source-drift failure before overwrite.

- [ ] **Step 4: Inspect the final diff and repository state**

Run: `git diff --check` and `git status --short`.  
Expected: no whitespace errors; unrelated untracked files remain unmodified and unstaged.

### Task 7: Verify formal desktop and iPhone-sized page behavior

**Files:**
- Create: `artifacts/county-longitude-acceptance/` screenshots and a short JSON result log only if the repository convention permits tracked QA artifacts; otherwise keep them local and report their paths.
- Modify product code only after a reproducible browser failure and a focused failing test.

**Interfaces:**
- Consumes: formal `paipan` and `result` routes from the local server.
- Produces: visual/console evidence for county match, fallback disclosure, and four-pillar consistency.

- [ ] **Step 1: Start the formal local server on an unused port**

Run: `$env:PORT=4179; node server.js` in a persistent session.  
Expected: server remains available at `http://localhost:4179`.

- [ ] **Step 2: Test four representative locations on desktop**

Use Beijing Chaoyang, Changchun Chaoyang, a far-western county, and one Hong Kong/Macau/Taiwan district. For each, submit a birth time within 15 minutes of a true-solar-hour boundary and verify selected path, displayed longitude, true solar time, final hour pillar, and no console errors.

- [ ] **Step 3: Repeat at 390x844 mobile viewport**

Verify long autonomous-county names and disclosure copy wrap without horizontal overflow. Check `document.documentElement.scrollWidth <= window.innerWidth`.

- [ ] **Step 4: Exercise a historical fallback fixture**

Open a URL with an old/unmatched district and no `geo_v`. Expected: page opens safely, displays an explicit estimate level, and does not claim a county match.

- [ ] **Step 5: Stop the server and commit any focused acceptance fix**

If no fix is needed, make no empty commit. If a browser-only defect is found, first add the smallest reproducible automated test, fix it, rerun Tasks 6 and 7, then commit the focused change.
