# Task 4 报告：支付回调与轮询完成报告订单

状态：已完成。

提交：`3961694 feat: finalize report entitlements`

## 红绿测试

- 红灯：新增三个用例后执行 `node --test tests/payment-flow.test.js`，3 个新增用例失败：报告回调没有写入 paid 状态、错误金额没有拒绝、轮询没有使用已存储报告密钥或补偿订单。
- 绿灯：实现后再次执行同一命令，26/26 通过、0 失败。

## 实现与自审

- 回调先完成既有签名和 `TRADE_SUCCESS` 校验；报告订单再校验服务器固定金额、查找实际订单并核对 `report_type`，随后调用并发幂等的 `markReportOrderPaid`。
- 报告轮询保留网关订单号、金额、请求类型，以及旧合盘商品名称的严格校验；仅当已存在的报告订单仍为 `pending` 时才调用补偿写入，并优先返回持久化的 `report_key`。
- 积分订单轮询仍只读取回调生成的积分记录，不会经轮询发放积分。
- 已运行 `git diff --check`；无空白错误。

## 顾虑

- 测试运行会生成未跟踪的 `.data-store.json`；当前执行环境的删除策略拒绝移除它，因此未纳入本提交。工作区原有未跟踪的 `.superpowers/brainstorm/` 同样未改动。

## 修复轮 1：持久化报告类型校验

- 红灯：增加“订单号为 BaZi、但已有 pending 行存为 Hepan”用例后，`node --test tests/payment-flow.test.js` 显示该用例错误返回 200，而非 409，证明旧逻辑会错误补偿。
- 修复：轮询通过网关订单号、金额和请求类型校验后，额外要求持久化订单的 `report_type` 与订单号推导的 `reportProduct.type` 一致；不一致时返回 409/`invalid`，且在任何 `markReportOrderPaid` 调用之前退出。
- 绿灯：`node --test tests/payment-flow.test.js` 为 27/27 通过、0 失败；`git diff --check` 通过。
