# Task 4 婚恋事实层报告

## 已完成

- 新增 `DeepReport.buildRelationshipFacts(bazi, gender, core, calculator)`，并接入 `buildFacts`。
- 男命按正财/偏财取配偶星，女命按正官/七杀取配偶星；记录透干、藏干层级、柱位、月令/根气响应、正偏混杂和喜忌角色。
- 夫妻宫读取日支五行及全部藏干、藏干十神、喜忌角色，并复用涉及日支的 `relationEvents` 与 `structuralRisks`。
- 日干与日支生克方向按五行生成/克制关系输出，文案只描述支持、投入、主导或压力方向，不推断谁更爱谁。
- 远近、年龄只输出带证据的弱倾向；外在气质降级为气质与形象风格原型，冲突或缺失时为 `limited`，不输出具体样貌。
- 稳定性文案明确合冲不等于必婚或必离，未新增核心旺衰、格局或结构风险计算。

## 复核修正

- 夫妻宫风险筛选现在读取冻结风险对象的 `parties`、`why`、`partyEvidence`、`evidence`、`triggerHint`，并保留真实风险对象与证据字段。
- 外在气质只把夫妻宫和配偶星视为两个独立来源；喜忌同向不再重复计数，五行风格冲突时保持 `limited`。
- 年龄事实只构建一次，`age` 与 `ageTendency` 复用同一对象。

## 验证

聚焦回归：

- `node --test tests/deep-report-relationship.test.js tests/deep-report-core.test.js tests/deep-report-wealth.test.js tests/p3-a-structural.test.js`
- 结果：25/25 通过。
- `git diff --check` 通过。

全量现状：

- `node --test tests/*.test.js`：422 个测试，410 通过、12 个失败；失败项为当前工作树中既有的时间边界、页面资源版本、支付页面和静态资源契约，与本次允许文件无关。
- `npm test` 不可用：项目未定义 `test` script。

未修改支付、AI、`.data-store.json` 或冻结核心文件。
