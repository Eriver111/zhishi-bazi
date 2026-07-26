# Paipan Enhancements Verification — 2026-07-26

## Release checkpoint

- Status: **BLOCKED**
- Production commit tested: `7c9052a` (`fix: omit unknown timing from AI context`)
- Verification coverage added in this checkpoint:
  - dedicated pre-Li-Chun reverse-lookup regression (`2024-02-03`, year pillar `癸卯`)
  - executable mode-switch state coverage
  - executable rendered-candidate click/navigation coverage
- Runtime origin: `http://127.0.0.1:3000`

The automated and functional flows pass, but visual acceptance found two production issues described under **Blocking findings**. No production code was changed as part of this verification task.

## Automated verification

| Command | Result |
| --- | --- |
| `node --test tests/*.test.js` | PASS — 78 tests, 78 passed, 0 failed |
| `node --test tests/lunar-calendar.test.js` | PASS — 5 tests, 5 passed, 0 failed |
| `node --test tests/pillar-reverse-lookup.test.js tests/paipan-direct-mode-contract.test.js` | PASS — 14 tests, 14 passed, 0 failed |

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

## Viewport evidence

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

## Blocking findings

1. In direct mode, `.calendar-only-fields` elements have `hidden=true` and their controls are disabled, but the zishi, true-solar, and location controls remain visibly rendered at all three viewports. The author layout rules override the expected hidden rendering. Direct URLs correctly omit these values, but the visual behavior does not meet the intended direct-mode isolation.
2. At `1440×900`, the pillar selects render at `19px` high rather than the `44px` acceptance target. The two mobile viewports render these controls at approximately `44px`.

Per the task constraint, these production defects were not fixed inside the verification checkpoint.

## Deferred items

- In-app browser verification remains unavailable because no in-app browser backend was connected. Headless Edge fallback evidence is recorded above.
- Production fixes for the two blocking visual findings require a reviewed implementation task followed by another visual acceptance run.
