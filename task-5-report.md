# Task 5 学业事实层报告

## 已完成

- 新增 `DeepReport.buildStudyFacts(bazi, core, calculator)`，并接入 `buildFacts()`。
- 学业拆为吸收理解、表达输出、纪律应试、实践转化四个维度；每一维保留状态、结论、证据、可信度、条件与喜忌角色。
- 印星同时读取透干/藏干、正偏印和冻结喜忌：印为忌时明确提示思虑、资料堆积与行动/输出转化问题，不写成天然学业好。
- 食神、伤官分别输出稳定表达与创新表达倾向；官杀用于纪律、考试与长期执行，并识别官印相生、杀印相生、官杀混杂等结构文本。
- 学习路径按有效格局/生克链、喜忌承载、十神透藏优先，输出考试型、研究创作型、技术型、创作型、实践型或复合型；文昌/学堂仅作为辅助证据。
- 结构风险与相关关系事件以条件性障碍输出；学习建议聚焦方法、练习、项目、复盘与执行，不承诺学历、学校层次或录取结果。

## 复核修正

- `studyActionText()` 只读取行动链/链路文本，不再把格局名称、状态或破格原因混作正向证据。
- 官印相生、杀印相生、伤官配印只有在冻结格局明确成格（或等价有效状态）且命局实际出现对应官杀、印、伤官时才走强路径；破格、缺十神时降为复合/条件性参考。
- 路径读取冻结 `core.yongJi` 的相关十神角色；印、官杀或食伤为忌时降低可信度并明确承载、输出和现实反馈条件。未重新计算喜忌。
- 路径证据补充实际十神的柱位与透藏层级、逐项喜忌角色、有效格局证据及行动链文本。

## TDD 验证

- 先新增失败测试并运行，确认 `DeepReport.buildStudyFacts is not a function`。
- 实现后通过：

```text
node --test tests/deep-report-study.test.js
7/7 passed
```

- 聚焦回归通过：

```text
node --test tests/deep-report-*.test.js
32/32 passed
```

- `node -c js/deep-report.js` 与 `git diff --check` 通过。
- 指定回归中 `bazi-yongji-report.test.js` 有 1 个工作树既有页面版本契约失败（`paipan.html` 未匹配 `js/bazi.js?v=20260813c`），其余 21 项通过；未修改该冻结页面。

## 范围确认

仅修改 `js/deep-report.js`，新增 `tests/deep-report-study.test.js` 与本报告；未修改支付、AI、冻结核心算法或 `.data-store.json`。
