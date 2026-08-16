# 八字深度报告 v2 最终静态验收

- 验收日期：2026-08-16（Asia/Shanghai）
- 验收工作树：`bazi-deep-report-v2-verified`
- 验收起点：`3318ed2eb1c8a3e300ed1062fd9d2cc7d5c8bc1c`
- 分支共同起点：`a2279ecfca895bf95d7355fdea85aa2b2537e196`
- 范围：只运行 Node 静态测试、语法检查和 Git 比对；未启动 `npm run dev`、`server.js` 或任何服务进程。

## 总体回归与基线判定

给定基线为 **400 项 / 388 通过 / 12 失败**。本次新鲜执行 `node --test tests/*.test.js` 的实际结果为 **442 项 / 430 通过 / 12 失败**（退出码 1）。

深度报告 v2 新增了 42 项测试；通过数也正好增加 42 项，失败数不变。下列 12 个失败名称与给定基线逐项一致，因此判定为：**零新增失败；基线失败仍存在，不以本次实现为由解决或掩盖。**

1. `shared birth normalization separates true-solar civil-date changes from Zi-hour pillar changes`
2. `所有八字入口加载同一版核心取用脚本`
3. `Zi-hour day change affects only day/hour pillars at the shared boundary`
4. `homepage uses v3 mobile artwork while preserving the v2 desktop artwork`
5. `result page loads local PDF dependencies in order and exposes one accessible action sheet`
6. `service worker rolls the mobile PDF cache to v7 and precaches all local PDF scripts`
7. `direct-pillar dependencies load in calculation order before main`
8. `desktop report payment renders the gateway QR image instead of treating QR content as an image`
9. `hepan deep report creates a hepan order instead of falling through to the generic report branch`
10. `service worker rolls the static cache so deployed payment scripts replace stale copies`
11. `result page cache-busts the repaired renderer bundle`
12. `static assets have correct content type and browser caching`

## 专项与冻结证据

| 命令/检查 | 实际结果 | 判定 |
| --- | --- | --- |
| `node --test tests/deep-report-*.test.js` | 58/58 通过，退出码 0 | 通过 |
| 专业核心、渲染、链路、P3-A 冻结与 `tests/bazi-*.test.js` | 59 项：57 通过、2 失败 | 两项均为上表既有基线失败；P3-A 冻结断言全部通过 |
| 支付、订单、二维码、报告库、PDF、移动端契约 8 个文件 | 88 项：83 通过、5 失败 | 五项均为上表既有基线失败 |
| `node --check`（排除 `node_modules`、测试和文档的 122 个 JS 文件） | 122/122 通过 | 通过 |

P3-A 冻结测试已重新验证：`js/bazi.js` 53 盘五行回放零漂移、`relationEvents` 53 盘共 271 个事件、`structuralRisks` 53 盘 17 列全等、`shaAB` 53 盘 15 列全等，且 K2-final 四盘锚点与 #8/B1 根节点均通过。

深度报告专项覆盖并通过以下本轮关键事实：单一权威事实对象渲染五付费区、证据链稳定、从财格、身弱而财旺的压力表达、库财引动的条件性、财破印与财党杀相关证据门、跨大运五年逐年解析、结构风险仅由年度节点触发，以及文昌/官印/伤官配印等学业链的证据门。未带出生日期的四柱输入明确不伪造大运，属于降级而非推断。

年度快照专项 6 项全部通过：显式 `report_year` 优先、来宾首次中国年份持久化、无效值回退、中国时区跨年、付费链接仅携带只读购买年份，以及年度不进入支付身份或报告身份。

## 代码与支付隔离

本地 Git 对象验证：`63fafaa:js/bazi.js` 与工作树 `js/bazi.js` 的 blob 均为 `5ac868a03c7a346250a7b9dfba930f58e241b513`；`git diff --exit-code 63fafaa -- js/bazi.js` 为 0。P3-A 测试中的 SHA-256 + `git show` 双重断言也通过。

相对分支共同起点检查以下支付实现文件，均无差异：

- `api/create-order.js`
- `api/check-order.js`
- `api/callback.js`
- `js/paywall.js`
- `js/hepan-paywall.js`

`api/reports/access.js` 的唯一差异是读取已购记录时兼容 `getPaidReportAccess` 并在原有 `unlocked` / `report_key` 响应上增加只读 `paid_at`；`tests/report-order-store.test.js` 的 `getPaidReportAccess exposes paid_at without changing the access decision` 已通过。支付实现隔离成立。

## 限制与运行数据

- 禁止性措辞扫描在 `js/deep-report.js` 返回两处匹配，均是 `命主克夫妻宫` 这一非确定性关系描述中被子串模式 `克夫` 命中；没有扫描到其余模式。该原始扫描结果保留，未改写产品文案。
- 全量测试产生 `.data-store.json`；它保持**未跟踪且未暂存**，不纳入本提交。
- 本验收遵守静态限制，未执行原任务中需要本地站点的桌面/手机浏览器步骤。因此，浏览器视口、解锁后的实际画面和真实 PDF 导出只能由后续允许启动服务的验收补齐；本报告不将它们表述为已完成。

## 结论

在允许的静态验收范围内，深度报告 v2 的新增测试、事实冻结、年度快照、四柱降级和支付身份隔离均通过；全量回归对给定 400/388/12 基线没有新增失败。上列 12 项既有失败及受静态限制而未执行的浏览器验收，仍是提交后需要保留的已知事项。
