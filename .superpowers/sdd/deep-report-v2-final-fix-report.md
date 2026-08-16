# Deep Report v2 最终修复报告

- 日期：2026-08-16（Asia/Shanghai）
- 实现提交：`b67ed2e`（`fix: close deep report v2 review findings`）
- 工作树：`bazi-deep-report-v2-verified`
- 限制：未启动 `npm run dev`、`server.js` 或任何服务；未执行 fetch/pull/merge/push；未加入 AI 调用；`.data-store.json` 保持未跟踪且未暂存。

## 修复结果

1. 登录已购报告在事实构建前等待认证访问响应，以 `paid_at` 的中国年份作为权威锚点；URL `report_year` 不再参与锚点决策。访问查询按 `paid_at`、`created_at`、`order_id` 升序选择最早成功订单，本地降级路径使用同一确定性政策。
2. 无出生日期的四柱直排不再把 `null` 大运传入只支持岁运联合分析的链分析器；改用现有 `BaZiCalculator.getPillarRelations/getBranchRelations` 对流年与原局逐柱生成权威关系，仍不虚构大运。
3. 年度触发先读取结构化领域字段，再使用保守文本回退；财运、关系、学业、事业各自只接收本领域触发，未匹配项保留在 `overallTriggers`。付费渲染对遗留高确定性风险词做中性化表达。
4. 财富正向路径只接受同一条权威行动链或关系记录中的明确正向证据；`财破印/财坏印` 不再生成 `财配印`，`财党杀` 不再生成 `财生官`。
5. 财富事实新增由现有计算器和冻结结构数据支持的月令、根气、生源、受制、关系与不确定性字段，不新增强弱分数。身弱且财为忌时，若实际印比出现并被冻结喜忌标为用/喜，先说明承载缓解。
6. 关系栏目现在展示夫妻宫全部藏干十神、夫妻宫喜忌角色、配偶星质量、涉日关系事件与条件性结构风险；所有字段转义并标注可信度。
7. 学业栏目现在展示 `study.chains` 的结论、证据、元素角色、阻断条件和可信度，不新增学历、录取或教育结果断言。
8. 锚点存储的 `getItem/setItem` 异常均安全回退到当前中国年份，不再使五个付费栏目空白。

## 文件

- 报告事实与锚点：`js/deep-report.js`、`js/deep-report-anchor.js`
- 页面与访问接线：`js/result.js`、`js/paywall.js`
- 已购访问读取：`lib/supabase.js`
- 回归测试：`tests/deep-report-anchor.test.js`、`tests/deep-report-render.test.js`、`tests/deep-report-timing.test.js`、`tests/deep-report-wealth.test.js`、`tests/report-order-store.test.js`

`js/paywall.js` 的改动仅把已经取得的 `/api/reports/access` 响应在解锁前交给报告锚点；订单创建、金额、二维码、回调、轮询、积分、会员和权限布尔判定未改。

## TDD 记录

- 锚点/重复订单 RED：15 项中 5 项按预期失败；GREEN：15/15 通过。
- 无大运关系/领域分离 RED：13 项中新增 3 项按预期失败；GREEN：13/13 通过。
- 财富反例/质量/承载 RED：9 项中新增 4 项按预期失败；GREEN 后与核心合跑 11/11 通过。
- 关系/学业/风险词渲染 RED：13 项中新增 3 项按预期失败；GREEN 后关系、学业、渲染合跑 39/39 通过。

## 最终验证

| 命令 | 实际结果 |
| --- | --- |
| `node --test tests/deep-report-*.test.js` | 72/72 通过，退出码 0 |
| 支付、访问身份、报告库、PDF/移动端 8 文件组合 | 96 项：91 通过、5 个既有基线失败，退出码 1 |
| P3 冻结、专业核心与渲染 5 文件组合 | 59 项：57 通过、2 个既有基线失败，退出码 1 |
| `node --check` 六个本轮 JS 文件 | 6/6 退出码 0 |
| `node --test tests/*.test.js` | 474 项：462 通过、12 失败，退出码 1 |

全量 12 个失败名称与基线验收报告逐项一致：

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

冻结边界检查：相对 `214bfbb`，`js/bazi.js`、`js/structural.js`、`js/bazi-chain.js`、`api/create-order.js`、`api/check-order.js`、`api/callback.js`、`js/hepan-paywall.js` 均无差异。

## 残余风险

- 按任务禁令未启动服务，因此真实浏览器视口、已解锁视觉状态和实际 PDF 导出仍未做动态验收；页面/PDF 同源只由现有 DOM/PDF 静态测试覆盖。
- 上述 12 个既有基线失败仍保留，本轮未越界修复。
- 禁词源码扫描仍会命中渲染器中的中性化替换规则，以及事实字段名“命主克夫妻宫”对子串 `克夫` 的误命中；实际付费 DOM 回归已验证不会输出测试中的高确定性遗留风险词。
