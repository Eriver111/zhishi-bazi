# Task 3：今年与五年岁运事实

## 完成内容

- 新增 `DeepReport.buildAnnualFacts()` 与 `DeepReport.buildFiveYearFacts()`。
- 每个年份独立读取流年干支，并按年份匹配实际大运；跨大运时输出 `transitions`。
- 岁运动态调用既有 `analyzeLiuNian`，结构风险只有在年度节点实际触发时才升级，并保留救应提示。
- 年度财运只引用既有财富事实，通过 `wealth.base` 及同源字段增加时间激活，不重新计算财富质量。
- 缺少确认出生日期时输出五年流年与原局关系，但 `hasDaYun=false`，明确不伪造当前大运和起运年龄。
- 身心状态仅输出作息、活动、饮食和情绪管理提示，不作诊断或器官断言。
- `buildFacts()` 以显式 `anchorYear` 构建 `currentYear` 与 `fiveYear`，未引入报告年份推断或支付逻辑。

## 验证

通过：

```text
node --test tests/deep-report-timing.test.js
node --test tests/deep-report-core.test.js tests/deep-report-wealth.test.js tests/deep-report-timing.test.js tests/bazi-chain-professional.test.js tests/p3-a-structural.test.js
node --check js/deep-report.js
```

专项回归结果：38 tests passed，0 failed。工作树中 `.data-store.json` 保持未跟踪，未修改支付、AI 或冻结核心文件。

## 限制与疑虑

- 结构风险的年度升级依赖既有风险对象和 `analyzeLiuNian` 的触发证据；无法定位大运时只保留流年级事实。
- 本任务只实现岁运事实层，未接入结果页渲染、报告年份快照模块或支付读取逻辑。

