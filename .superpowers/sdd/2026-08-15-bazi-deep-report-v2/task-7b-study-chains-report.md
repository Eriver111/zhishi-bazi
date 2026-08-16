# Task 7b：补充学习证据链交付报告

## 交付范围

- 在 `js/deep-report.js` 的 `study` facts 中新增 `chains` 数组，保留原有四个学习维度与 `path` 契约。
- 链对象统一包含 `id`、`present`、`evidence`、`elementRoles`、`blockers`、`conditions`、`conclusion`、`confidence`。
- 覆盖 `sha_yin`、`wealth_regulates_seal`、`food_controls_sha`、`yangren_output` 与身弱官杀无印的 `learning_pressure` 条件事实。
- 复用 `structuralRisks`/`relationEvents` 的已登记风险；未加入金水相涵、木火通明自动识别或任何教育结果预测。
- `sha_yin` 强度要求有效格局或权威行动链、真实官杀与印、印为用/喜且无阻断；`wealth_regulates_seal` 要求权威“印成势→财制印”证据、真实财印与财为用/喜，并与财破印风险分开；`food_controls_sha` 严格区分食神/伤官及七杀/正官。

## TDD 证据

先新增 focused study-chain 测试并确认缺少 `chains` 时失败（6 项失败），再实现最小报告层逻辑；实现后 `tests/deep-report-study.test.js` 13/13 通过。

## 验证

通过：

```text
node --test tests/deep-report-study.test.js
node --test tests/deep-report-study.test.js tests/deep-report-core.test.js tests/deep-report-render.test.js tests/bazi-chain-professional.test.js tests/p3-a-structural.test.js
```

组合回归结果：50/50 通过；包含报告 study/core/render、专业生克链与 P3-A/B/C 结构冻结对账。

## 未决疑虑

1. `wealth_regulates_seal` 只接受显式“印成势→财制印”行动/候选证据；若未来核心候选字段改名，需要同步证据适配器与测试。
2. `yangren_output` 固定为 `limited` 并提示人工复核；当前核心没有可自动确认的统一“羊刃—食伤”权威链。
3. `learning_pressure` 只消费 strength level、官杀出现和无印联合门槛，不涉及健康或教育结果；从格仍按核心 `congGe` 门控。
4. 本任务未改动 `js/bazi.js`、`js/structural.js`、支付、AI、访问控制或 `.data-store.json`。
