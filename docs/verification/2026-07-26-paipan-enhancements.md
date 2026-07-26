# Paipan Enhancements Verification — 2026-07-26

## Release checkpoint

- Status: **DONE**
- Final production commit tested: `ba355cc90a4448d6d0b6797acef053bb9be791ab` (`Revert "Merge branch 'main' of https://github.com/Eriver111/zhishi-bazi into feat/light-ui-redesign"`)
- Verification coverage added in this checkpoint:
  - dedicated pre-Li-Chun reverse-lookup regression (`2024-02-03`, year pillar `癸卯`)
  - executable mode-switch state coverage
  - executable rendered-candidate click/navigation coverage
- Runtime origin: `http://127.0.0.1:3000`

The automated, functional, and follow-up visual acceptance checks pass. The two findings from the initial checkpoint were resolved by reviewed production commit `60346b7`; the final full acceptance matrix below was rerun after the additive scope-correction revert at `ba355cc`. No production code was changed by this verification round.

## Automated verification

| Command | Result |
| --- | --- |
| `node --test tests/*.test.js` | PASS — 80 tests, 80 passed, 0 failed |
| `node --test tests/lunar-calendar.test.js` | PASS — 5 tests, 5 passed, 0 failed |
| `node --test tests/pillar-reverse-lookup.test.js tests/paipan-direct-mode-contract.test.js` | PASS — 14 tests, 14 passed, 0 failed |
| `node --test tests/paipan-direct-mode-contract.test.js` | PASS — 11 tests, 11 passed, 0 failed |

The explicit lunar run includes:

- `2013` lunar `1/1` → `2013-02-10`
- invalid leap-month, invalid day, and non-numeric validation
- exhaustive supported-day round trips for `1900-01-31` through `2100-12-31`

## Browser availability and fallback

The requested in-app browser backend was tried first. It returned:

```text
Browser is not available: iab
```

The browser runtime's backend list was `[]`, including after its required bootstrap troubleshooting check. Live acceptance therefore used the repository's already-installed `playwright` package with the locally installed Microsoft Edge executable:

```text
C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
```

The application was started with `node server.js` (equivalent to `npm run dev`) and exercised at `http://127.0.0.1:3000/paipan`. The fallback was headless Edge, not the in-app browser.

## Functional runtime results

### Solar baseline

Input: `2024-03-18`, hour index `3`, clock `06:00`, male.

URL:

```text
http://127.0.0.1:3000/result?year=2024&month=3&day=18&hour=3&gender=male&clock=6
```

Rendered pillars: `甲辰 丁卯 辛巳 辛卯`.

### Lunar conversion

Input: lunar `2013` year, month `1`, day `1`, hour index `3`, clock `06:00`, female.

URL:

```text
http://127.0.0.1:3000/result?year=2013&month=2&day=10&hour=3&gender=female&clock=6
```

The URL contains the expected Gregorian date `2013-02-10`.

### Direct pillars with a match

Input: `甲辰 丁卯 辛巳 辛卯`, male.

- Candidate count: `2` (within the maximum of two)
- Selected candidate: `2024-03-18`, hour index `3`, clock `06:00`
- Result pillars: `甲辰 丁卯 辛巳 辛卯` (exactly the entered pillars)

URL:

```text
http://127.0.0.1:3000/result?yg=%E7%94%B2&yz=%E8%BE%B0&mg=%E4%B8%81&mz=%E5%8D%AF&dg=%E8%BE%9B&dz=%E5%B7%B3&hg=%E8%BE%9B&hz=%E5%8D%AF&mode=pillars&timing=matched&gender=male&year=2024&month=3&day=18&hour=3&clock=6
```

The direct URL contains no `prov`, `city`, `dist`, `solar`, or `zishi` keys.

### Direct pillars without a match

Input: `甲辰 丁卯 辛巳 甲子`, male.

Actionable message:

```text
近 200 年内未找到完全匹配的出生时间。请检查四柱，或先查看不含精确出生时点的基础命盘。
```

Before choosing the base chart, the page remained at `http://127.0.0.1:3000/paipan`. The base-chart continuation URL was:

```text
http://127.0.0.1:3000/result?yg=%E7%94%B2&yz=%E8%BE%B0&mg=%E4%B8%81&mz=%E5%8D%AF&dg=%E8%BE%9B&dz=%E5%B7%B3&hg=%E7%94%B2&hz=%E5%AD%90&mode=pillars&timing=unknown&gender=male
```

It contains no fabricated `year`, `month`, `day`, `hour`, or `clock`.

## Initial viewport evidence

Each viewport displayed two candidate buttons with `16px` text, all candidate buttons stayed within the viewport, the mode-tab top-edge spread was `0px`, and the labels were readable as `年柱 / 月柱 / 日柱 / 时柱`.

| Viewport | Horizontal overflow | Tab top spread | Smallest pillar/candidate control | Candidate readability |
| --- | ---: | ---: | ---: | --- |
| `1440×900` | none (`1440/1440`) | `0px` | `19px` | 2 buttons, `16px`, within viewport |
| `390×844` | none (`390/390`) | `0px` | `44px` | 2 buttons, `16px`, within viewport |
| `430×932` | none (`430/430`) | `0px` | `43.99999px` (rendered 44px) | 2 buttons, `16px`, within viewport |

Fallback screenshots were captured during the run at:

```text
C:\Users\86132\AppData\Local\Temp\bazi-task7-1440x900.png
C:\Users\86132\AppData\Local\Temp\bazi-task7-390x844.png
C:\Users\86132\AppData\Local\Temp\bazi-task7-430x932.png
```

## Historical visual acceptance after `60346b7`

The previously blocked checks were repeated against reviewed production fix `60346b7` using the same Playwright + Edge fallback.

| Viewport | Direct calendar-only rows | Eight pillar selects | Horizontal overflow | Solar restoration |
| --- | --- | --- | --- | --- |
| `1440×900` | 3/3 `hidden=true`, `display:none`, `0px`; all fields disabled | 8/8 exactly `44px` | none (`1440/1440`) | 3/3 rows visible again |
| `390×844` | 3/3 `hidden=true`, `display:none`, `0px`; all fields disabled | 8/8 exactly `44px` | none (`390/390`) | 3/3 rows visible again |
| `430×932` | 3/3 `hidden=true`, `display:none`, `0px`; all fields disabled | 8/8 exactly `44px` | none (`430/430`) | 3/3 rows visible again |

On return to solar mode, the zishi/true-solar controls and location rows regain their visible layout. Province and other normally available controls are enabled; the dependent district selector correctly remains disabled until its parent location is chosen.

Follow-up screenshots, captured after switching back to solar mode, are at:

```text
C:\Users\86132\AppData\Local\Temp\bazi-task7-resolved-1440x900.png
C:\Users\86132\AppData\Local\Temp\bazi-task7-resolved-390x844.png
C:\Users\86132\AppData\Local\Temp\bazi-task7-resolved-430x932.png
```

## Final live acceptance after scope correction `ba355cc`

The complete live matrix was rerun against the final corrected first-parent HEAD, not the earlier fix commit:

```text
ba355cc90a4448d6d0b6797acef053bb9be791ab
```

It used the documented headless Microsoft Edge + Playwright fallback at `http://127.0.0.1:3000`. The matrix entered and asserted these exact flows:

| Flow | Entered values | Exact result URL / assertion |
| --- | --- | --- |
| Solar | `2024-03-18`, hour-index `3`, clock `06:00`, male | `http://127.0.0.1:3000/result?year=2024&month=3&day=18&hour=3&gender=male&clock=6` |
| Lunar | lunar `2013-1-1`, hour-index `3`, clock `06:00`, female | `http://127.0.0.1:3000/result?year=2013&month=2&day=10&hour=3&gender=female&clock=6` |
| Direct, matched | `甲辰 丁卯 辛巳 辛卯`, male | two candidates; selected `2024-03-18 06:00`; result retains exactly `甲辰 丁卯 辛巳 辛卯` |
| Direct, unknown | `甲辰 丁卯 辛巳 甲子`, male | `http://127.0.0.1:3000/result?yg=%E7%94%B2&yz=%E8%BE%B0&mg=%E4%B8%81&mz=%E5%8D%AF&dg=%E8%BE%9B&dz=%E5%B7%B3&hg=%E7%94%B2&hz=%E5%AD%90&mode=pillars&timing=unknown&gender=male`; no `year`, `month`, `day`, `hour`, `clock`, location, or correction keys |

At `1440×900`, `390×844`, and `430×932`, the direct screen had no horizontal overflow, exactly two readable candidates, and all eight pillar selects at exactly `44px`. At the same three viewports, switching from 四柱 back to 公历 produced no horizontal overflow, an active `solar` tab, active solar panel, inactive pillars panel, and visible calendar-only controls.

Committed screenshot evidence from this final run:

| Viewport | Direct candidates | Solar-restoration screenshot |
| --- | --- | --- |
| `1440×900` | `evidence/bazi-task7-final-ba355cc-direct-1440x900.png` | `evidence/bazi-task7-final-ba355cc-solar-restored-1440x900.png` |
| `390×844` | `evidence/bazi-task7-final-ba355cc-direct-390x844.png` | `evidence/bazi-task7-final-ba355cc-solar-restored-390x844.png` |
| `430×932` | `evidence/bazi-task7-final-ba355cc-direct-430x932.png` | `evidence/bazi-task7-final-ba355cc-solar-restored-430x932.png` |

The new `390×844` solar-restoration image is explicitly verified to show the 公历 tab selected; it replaces the earlier inconsistent four-pillars screenshot/caption pairing.

## Resolved findings

1. **Resolved:** direct-mode calendar-only controls now compute to `display:none` with zero height at every target viewport.
2. **Resolved:** all eight direct pillar selects now render at `44px` at every target viewport, including desktop.

## Deferred items

- In-app browser verification remains unavailable because no in-app browser backend was connected. Headless Edge fallback evidence is recorded above.
- This availability limitation is not a release blocker because the required runtime and visual checks completed through the established local Edge fallback.
