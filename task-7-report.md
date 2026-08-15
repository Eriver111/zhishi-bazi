# Task 7 报告：统一事实渲染五个付费栏目

状态：CHECKPOINT_READY

## 完成内容

- `renderPaidContent()` 只构建一次 `DeepReport.buildFacts()`，并缓存同一份事实供今年、婚恋、财富、学业、五年五个既有容器渲染。
- 结果页按 `_reportAnchorYear` 传入 `{ anchorYear }`；Task 6 的 `report_year` 仍在付费身份参数之外。
- 新增统一 HTML escape、证据行、条件限制和错误卡片渲染；事实构建失败时五个栏目明确提示并提供重试，不回退旧分析函数或旧矛盾结论。
- 保留既有五个 section ID、抽屉展开和 paywall/unlock 框架；展示层不重算财富、岁运、婚恋或学业事实。
- 未修改金额、二维码、回调、轮询、积分、会员/权限、AI 请求、冻结命理算法或 `.data-store.json`。

## 测试

TDD 先运行 `node --test tests/deep-report-render.test.js`，确认旧 `renderPaidContent()` 调用旧分析函数导致失败；实现后渲染与 anchor 聚焦测试通过：

```text
node --test tests/deep-report-render.test.js tests/deep-report-anchor.test.js
12 passed, 0 failed
```

Task 7 指定回归：

```text
node --test tests/deep-report-render.test.js tests/bazi-professional-report-render.test.js tests/mobile-report-pdf.test.js tests/report-pdf.test.js tests/homepage-visual-contract.test.js
36 passed, 3 baseline failures
```

保留的既有失败为首页移动 artwork 缺失、结果页本地 PDF vendor 依赖缺失、service-worker PDF cache 版本不符；均未由本任务文件改动引入。

深度报告及相关支付/报告回归：

```text
node --test tests/deep-report-*.test.js tests/bazi-chain-professional.test.js tests/bazi-yongji-report.test.js tests/p3-a-structural.test.js tests/report-identity.test.js tests/report-order-store.test.js tests/report-api.test.js
95 passed, 1 baseline failure
```

唯一失败为既有 `bazi-yongji-report.test.js` 页面核心脚本版本契约（`paipan.html`）；支付/报告身份/订单存储测试均通过。

## 提交

待父任务确认后提交 checkpoint 原子 commit：`feat: render paid sections from unified facts`。
