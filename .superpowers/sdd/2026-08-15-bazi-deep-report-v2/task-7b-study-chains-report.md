# Task 7b：补充学习证据链交付报告

## 交付范围

- 在 `js/deep-report.js` 的 `study` facts 中新增 `chains` 数组，保留原有四个学习维度与 `path` 契约。
- 链对象统一包含 `id`、`present`、`evidence`、`elementRoles`、`blockers`、`conditions`、`conclusion`、`confidence`。
- 覆盖 `sha_yin`、`wealth_regulates_seal`、`food_controls_sha`、`yangren_output` 与身弱官杀无印的 `learning_pressure` 条件事实。
- 复用 `structuralRisks`/`relationEvents` 的已登记风险；未加入金水相涵、木火通明自动识别或任何教育结果预测。
- `sha_yin` 强度要求有效格局或权威行动链、真实官杀与印、印为用/喜且无阻断；`wealth_regulates_seal` 要求权威“印成势→财制印”证据、真实财印与财为用/喜，并与财破印风险分开；`food_controls_sha` 严格区分食神/伤官及七杀/正官。

## TDD 证据

先新增 focused study-chain 测试并确认缺少 `chains` 时失败（6 项失败），再实现最小报告层逻辑；当前 `tests/deep-report-study.test.js` 18/18 通过。

## 验证

通过：

```text
node --test tests/deep-report-study.test.js
node --test tests/deep-report-study.test.js tests/deep-report-core.test.js tests/deep-report-render.test.js tests/bazi-chain-professional.test.js tests/p3-a-structural.test.js
```

组合回归结果：55/55 通过；包含报告 study/core/render、专业生克链与 P3-A/B/C 结构冻结对账。

## 未决疑虑

1. `wealth_regulates_seal` 只接受同一条生产 core 权威记录中明确的“印成势→财制印”因果证据；若未来生产 core 证据字段改名，需要同步适配器与测试。
2. `yangren_output` 固定为 `limited` 并提示人工复核；当前核心没有可自动确认的统一“羊刃—食伤”权威链。
3. `learning_pressure` 只消费 strength level、官杀出现和无印联合门槛，不涉及健康或教育结果；从格仍按核心 `congGe` 门控。
4. 本任务未改动 `js/bazi.js`、`js/structural.js`、支付、AI、访问控制或 `.data-store.json`。

## 第 1 轮修复

- `food_controls_sha` 现在复用并识别枭神夺食、财党杀、承载不足、身弱不担财等结构/链证据；食神或伤官为忌神时阻止 `strong`。有效食神制杀与枭神夺食、食神为忌的反例固定为 `limited`。
- 财制印证据仅来自生产 core 可暴露的 `actionChains` 与 `yongJi.reasoning/evidence/elementReasons/chainHints/chainAdjustments`（以及既有 `core.chain` 提示），不再依赖 `actionCandidates`、`candidateEvidence` 等伪字段。
- 真实 `BaZiCalculator` + `DeepReport.buildFacts` 端到端回归已加入；当前可复现盘未暴露明确“印成势→财制印”权威证据，因此诚实输出 `present:false`、`unsupported:true`、`confidence:'limited'`。
- `yangren_output.manualReviewRequired` 固定为 `true`；财破印反例明确断言 `confidence:'limited'`。

第 1 轮专项测试：18/18 通过。

## 第 2 轮修复

- 财制印命中改为逐条记录判断：同一 `actionChain`、`yongJi.evidence` 项或 `chainHint` 对象/字符串中必须同时出现“印成势”和“财制印/财星制印”；不同记录之间不会拼接成因果链。
- 新增反例：独立记录“印成势”与“可考虑财制印”不命中；新增正例：同一条“印成势→财制印”命中。

第 2 轮专项与冻结回归：55/55 通过。
