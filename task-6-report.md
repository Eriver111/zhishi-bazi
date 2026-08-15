# Task 6 报告：固定购买年份且不污染支付身份

## 完成内容

- 新增 `js/deep-report-anchor.js`：外部购买年份、本地快照、中国时区当前年份的稳定解析；报告库链接只读携带 `report_year`。
- 结果页在 paywall 初始化前独立提取并删除 `reportYear`；本地排盘记录身份查询也移除 `report_year`。
- `profile.html` 和 `result.html` 加载 anchor 模块；报告库链接携带 `paid_at` 对应购买年份。
- `getPaidReportAccess()` 只读返回 `{ unlocked, paid_at }`，`api/reports/access.js` 返回 `paid_at`，保留 `hasPaidReport()` 布尔兼容包装。
- 未修改支付创建、回调、轮询、金额、二维码、支付身份算法、命理、AI 或 `.data-store`。

## 验证

通过：

```text
node --test tests/deep-report-anchor.test.js tests/direct-pillar-bazi.test.js tests/profile-report-library.test.js tests/report-api.test.js
24 passed

node --test tests/payment-flow.test.js tests/report-order-store.test.js tests/report-identity.test.js
41 passed

node --test --test-name-pattern="bazi paywall sends account credentials" tests/payment-ui-contract.test.js
1 passed
```

支付 UI 全文件测试仍有既有环境基线失败：两个用例的测试 VM 未提供 `AbortController`，service worker 版本断言期望 `zhishi-v7` 而当前代码为 `zhishi-v12`；本任务未修改相关支付文件或 service worker。
