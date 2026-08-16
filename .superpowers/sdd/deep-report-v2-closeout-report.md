# Deep Report v2 Closeout Report

- 日期：2026-08-16（Asia/Shanghai）
- 分支：`feat/bazi-deep-report-v2-verified`
- 产品与测试提交：`4a58a7d7c477217493a44bee249369499a4a2ccd`（`fix: close remaining deep report findings`）
- 约束：未启动服务；未执行 fetch/pull/merge/push；未修改冻结核心、AI、支付、订单、二维码、回调、轮询、会员、积分、访问身份、PDF 引擎或 `.data-store.json`。

## 根因与最小修复

### Finding A：年度综合触发未交付

事实层已经在每个年度对象中保留 `overallTriggers`，但 `renderDeepCurrentYear` 与 `renderDeepFiveYear` 从未消费该字段，因此四柱直排已经计算出的原局年度关系也无法出现在付费页面或同源 PDF DOM。

修复只发生在付费报告渲染层：

- 在今年栏目加入一个“综合变化”块，在五年逐年卡片加入一个“原局互动”块；每个年度最多渲染一个该块。
- 先收集事业、财富、关系、学业及 `triggeredRisks` 已渲染事实，再按稳定 ID、结构字段与中性化文本去重；同一综合触发在同一年度只出现一次。
- 四柱直排继续使用已有原局年度关系且保持 `daYun: null`，不构造大运。
- HTML 输出前统一把灾祸、诉讼、疾病、离婚、损失及确定性措辞改写为条件性、中性表达。
- `buildReportHTML()` 继续克隆现场付费 section DOM；测试验证页面财富质量与综合触发所在 DOM 会进入 PDF HTML。

### Finding B：财富质量与支持阈值

`wealth.resource.quality` 已经包含月令、根气、生源、受制、关系和不确定性，但财富渲染只显示 `resource` 父级摘要。承载判断则把任何一个喜用印比出现都视为有效支持，没有区分透干、本气和单个弱藏干。

修复保持冻结喜忌和强弱结果不变：

- 财富栏目分项展示月令与季节、根气、生源、受制、关系质量、不确定性；空类别也明确显示证据不足，所有文本均经过 HTML 转义。
- 有效支持只接受喜用印比透干、支本气、至少两个不同柱的中气/余气，或明确的权威印比生身/扶身/承载行动链。
- 单个中气或余气只标记 `limited`，继续保持“承压”，并明确说明“仅部分缓解承载压力，不能作为有效支持”。
- 未增加新的强弱分数，也未改变冻结用神、喜神、忌神。

## TDD 证据

1. 改动前聚焦基线：`node --test tests/deep-report-timing.test.js tests/deep-report-wealth.test.js tests/deep-report-render.test.js`，35/35 通过。
2. 首轮 RED：新增综合触发、直排关系、财富质量与支持阈值测试后，32 项中 23 通过、9 失败；失败均命中预期缺失行为。
3. 财富空类别 RED：单独运行 `wealth quality keeps every evidence dimension`，1/1 按预期失败。
4. 最终聚焦 GREEN：同一三文件命令，46/46 通过。

## 最终验证

| 验证 | 实际结果 |
| --- | --- |
| `node --test tests/deep-report-*.test.js` | 83/83 通过，退出码 0 |
| 深度报告 study/core/render、专业链与 P3 冻结组合 | 64/64 通过，退出码 0 |
| 专业核心、报告、喜忌、直排与 P3 组合 | 50 项：48 通过、2 个既有基线失败，退出码 1 |
| 支付、访问身份、报告库、PDF/移动端 8 文件组合 | 93 项：88 通过、5 个既有基线失败，退出码 1 |
| 四个改动 JS 文件的 `node --check` | 4/4 退出码 0 |
| `git diff --check` | 退出码 0 |
| `node --test tests/*.test.js` | 485 项：473 通过、12 失败，退出码 1 |

全量 12 个失败名称与既有基线完全一致：

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

## 边界核对

- 产品提交只包含 `js/deep-report.js`、`js/result.js`、`tests/deep-report-render.test.js`、`tests/deep-report-wealth.test.js`。
- `js/bazi.js`、`js/structural.js`、`js/bazi-chain.js`、`api/create-order.js`、`api/check-order.js`、`api/callback.js`、`js/paywall.js`、`js/hepan-paywall.js`、`lib/supabase.js`、`js/report-pdf.js`、`package.json`、`package-lock.json` 相对收尾前 HEAD 均无差异。
- 五个付费 section ID 与解锁框架未改。
- `.data-store.json` 保持未跟踪且从未暂存。

## 残余风险

- 按禁令未启动服务，因此没有做真实浏览器视口、已解锁交互和实际 PDF 文件的动态验收；页面/PDF 同源由现场 DOM 克隆测试及既有 PDF 合同测试覆盖。
- 12 个既有基线失败仍保留，未越界修改。
- 权威印比链识别有意只接受明确的生身、扶身、助身、帮身、护身、支持或承载措辞；上游若以后引入没有稳定 ID、没有可显示文本或使用全新同义词的记录，会保守降级为未识别或有限支持，而不会误判为有效支持。
