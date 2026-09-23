# 八字判读审计工作流

本工具检查记录完整性、规则符合性和比较口径，不验证填报者的真实身份、古籍论断的正确性或人生预测准确率。历史8轮仍是内部审计材料。

## 新批次准备

每轮仍为10盘。以下以尚未建立的 `audits/bazi/round-09` 为路径示例；工具不会替审计者生成答案。

1. `cases.json` 保存输入、四柱和覆盖标签；不得复用历史批次四柱。`prepare` 会直接检查 `audits/bazi/round-*` 的实际案例，排除当前目录，不依赖旧登记表是否更新。
2. 先记录独立判读，再运行引擎。保留 `independent-rulings.md` 的说明，并填写同名 JSON 的结构化数据；只有标题或缺字段不能冻结。
3. 每轮指定 `datasetRole`：`development` 为开发审计，`acceptance` 为冻结验收，`disputed` 为争议留档。开发样本不能被报告为验收通过率。
4. `acceptance` 必须完成不同于原判读者的第二人工复核，具有明确规则或文献来源，且无未决项、争议或质量隔离。工具只能验证这些字段及流程声明，不能认证专家资质或“外部金标准”。

结构化文件的顶层字段：

| 字段 | 含义 |
| --- | --- |
| `schemaVersion` | 当前为1 |
| `roundId` | 与案例文件一致，例如round-09 |
| `datasetRole` | development / acceptance / disputed |
| `ruleVersion` | 实际采用的规则版本，例如zhishi-judgement-v1-20260922；不能仅填引擎提交号 |
| `sources` | 来源ID、类型、可追溯位置、说明；项目约定、文献、外部复核、内部复核、AI辅助分别记录 |
| `cases` | 与案例ID及四柱逐一对应的10份判断 |

每份判断必须包含：`id`、`pillars`、ISO格式的 `decidedAt`、`engineOutputSeen:false`、`author`、`sourceIds`、`review`、`strength`、`following`、`pattern`、`yongJi`、`disputes`。各判读项须有 `evidence` 说明列表；从格和格局分别记录名称及状态；喜用忌记录首用、喜用集合、忌神集合。具体字段、枚举及完整合成示例见 `scripts/bazi-audit-schema.js` 与 `tests/bazi-audit-round.test.js`，测试示例不能拿来充当实际审计答案。

`yongJi.favorable` 沿用引擎 `xiShen` 的喜用集合口径，已定时包含首用五行；若要单独表达“其余喜神”，应在解释文字中说明，不能把两种集合口径混用于完全一致比较。

## 命令顺序

在仓库根目录运行，使用新建的实际批次路径替换示例路径：

```text
node scripts/bazi-audit-round.js prepare audits/bazi/round-09
node scripts/bazi-audit-round.js freeze-rulings audits/bazi/round-09
node scripts/bazi-audit-round.js capture-engine audits/bazi/round-09
node scripts/bazi-audit-round.js verify audits/bazi/round-09
node scripts/bazi-audit-round.js compare audits/bazi/round-09
```

冻结后不能覆盖裁判记录；已有引擎结果不能重捕获覆盖。新冻结使用LF归一化哈希，避免Windows换行差异被误报为改动。`capture-engine` 必须匹配冻结时的引擎，且分别保存基础格局 `basePattern` 和最终格局 `pattern`。

`compare` 只读冻结结果，不重新调用当前引擎；先校验材料和结果哈希，再逐项比较。强弱方向、具体档位、从格名称/状态、首用五行、喜用集合、忌神集合、最终格局名称/状态分别记录。未知或待定项不能计作通过，不输出一个模糊总准确率。

对验收批次显式检查资格：

```text
node scripts/bazi-audit-round.js verify audits/bazi/round-09 --require-acceptance
```

## 历史材料与勘误

旧批次可执行 `verify`，输出区分：材料完整性、当前引擎是否匹配冻结版本、是否具有新规范的验收资格。当前引擎经过修复而与旧版不一致，并不代表旧文件被篡改。旧材料没有新规范冻结的判读元数据，不可通过补写文件将旧批次直接升级为新验收答案。

`audits/bazi/judgement-quality.json` 目前隔离R08-C03/C04。工具也按历史四柱关联隔离，换一个案例ID不能绕过。复核后应另留有来源的勘误及复核记录，再讨论是否解除；不得重写原裁判来制造与引擎一致。

历法核对与上述判读审计分开。四柱与问真一致，不构成旺衰、喜用忌或格局验收。
