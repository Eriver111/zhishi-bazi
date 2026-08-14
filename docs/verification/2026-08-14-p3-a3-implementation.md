# P3-A3 正式实装/回归：structural 解释层接入生产数据流

> 2026-08-14 · 依据 P3-A3 规格十条执行 · 分支 `p3-a3`（基准 HEAD `00b402f`）
> 纪律：不改引擎、不改 P1/P2 分数、验收前不 push、不部署；A1/A2 冻结产物逐字照抄
> **结论：四层 A/B 验证 10/10 全过；P1/P2 零漂移；53 盘 relationEvents/structuralRisks 与 A2-final 冻结产物逐项全等；#9 与 K2-final 关键盘全中；全量测试无新增失败（14 条失败全部为基准状态既有）→ P3-A3 达标，待 GPT 裁 CLOSED/部署**

## 0. git 快照与纪律断言

| 项 | 值 |
|---|---|
| 基准 HEAD | `00b402f`（P3-A2-final，GPT 最终裁决 10 条全量落地） |
| 工作分支 | `p3-a3`（新建，验收前不 push） |
| 引擎字节冻结 | `js/bazi.js` 与部署 blob `63fafaa` sha256 逐字节一致（`87f3255b0b130855fabd416379cbf60819336132e827bbd5ff38f278bc9d934d`，A 层测试内双重断言：本地 sha256 + `git show 63fafaa` 比对） |
| 移植来源 | `_p3_a2_risk_evaluator.js`（A2-final 冻结原型，只读未动）——生产模块逐字节移植其 36-489 行逻辑，镜像表保留行号证据注释 |

## 1. 正式 diff / 传播面

```
 api/ai-chat.js            | 16 ++++++++++++++++
 js/ai-chat-integration.js |  8 ++++++++
 js/result.js              |  8 ++++++++
 result.html               |  1 +
 4 files changed, 33 insertions(+)
```

新增 2 文件（不含报告本文档）：

| 文件 | 内容 |
|---|---|
| `js/structural.js`（新，~490 行） | 生产模块。UMD 包装，逐字节移植 A2-final 冻结逻辑（镜像表 / relationEvents / 8 类事件全柱枚举 / 7 检测器 / shaAB / presenceEvidence 五档 / K2-final 口径）。公共 API：`relationEvents`、`evaluateStructuralRisks`、`shaAB`、`evaluate(bazi, calculator)`；`evaluate` 内部回退 `window.BaZiCalculator`，engine 不可用时 risks=[] 而 relationEvents（纯柱层）仍可算 |
| `tests/p3-a-structural.test.js`（新，~350 行） | 四层 A/B 回归（见 §3） |

## 2. 页面数据流接入位置（三处，全部只增不改）

1. **`result.html`**：`js/bazi.js?v=20260813d` 之后新增 `<script src="js/structural.js?v=1"></script>`。
2. **`js/result.js`**（`if(_bazi){` 块内、`localStorage.setItem('ai_chart_data',…)` 之前）：`d.relationEvents = sa.relationEvents; d.structuralRisks = sa.structuralRisks;`（try/catch 包裹，模块缺失静默跳过）。chart data 统一对象**新增字段、不覆盖既有字段**；页面无展示区但数据流可读取（`ai_chart_data` 落库 + 结果页内存对象均带两层）。
3. **`js/ai-chat-integration.js`**（`buildResultContext` 同样式追加块）+ **`api/ai-chat.js`**：
   - SYSTEM_PROMPT 新增两条——relationEvents 为事实层枚举（对称关系 source/target 仅规范排序不赋因果；天干克保留真实克方方向）；structuralRisks 为条件性结构风险，**明确提示「喜用忌是五行总体需求、structuralRisks 是条件性结构风险，不得把 risk 元素重新解释成忌神」**、引用必须用条件语言。
   - `buildSingleChart()` 渲染两节：四柱关系事件（事实层枚举）+ 条件性结构风险（type[severity]：parties。why。缓解：mitigations。triggerHint 结构显现：partyEvidence）。

## 3. 四层 A/B 验证：10/10 全过

| 层 | 断言 | 结果 |
|---|---|---|
| A | 引擎 sha256 + git show 63fafaa 双重字节冻结；53 盘五行层（score/level/yong/xi/ji/pattern/cong）与 `_p2_4a_replay.csv` 逐项全等（P1/P2 零漂移） | ✅ |
| B1 | relationEvents 53 盘与 `_p3_a1_relation_events.csv` 逐项一致，总数 271、类型分布一致 | ✅ |
| B2 | structuralRisks 59 行 × 17 列与 `_p3_a2_risks.csv` 逐项全等 | ✅ |
| B3 | shaAB（K1/K2/证据/制化/合绊）53 盘 × 15 列与 `_p3_a2_sha_ab.csv` 逐项全等 | ✅ |
| C | #9 黄金样本：51 分/用木/喜木/忌空/杀印相生格·成格/8 events/3 risks/子午冲 why 只写印星之根；两层零污染（仅允许 engine 既有 `_siLing` 缓存，其余逐字节一致） | ✅ |
| D | K2-final 四盘：A6=存在、P15-03=不输出、H05=潜在、H13=不输出；#8/B1 透干七杀坐支之根节点受冲恢复 | ✅ |
| 九×3 | 对称关系 source/target 仅规范排序（POS_NAME 升序）、天干克保留真实克方（`KE[WX[source]]===WX[target]`）；全 53 盘 triggerHint 禁确定性语言 / severity 仅两档 / partyEvidence 非空；官杀混杂双透口径逐条核对 | ✅ |

## 4. 全量测试：370/384，14 条失败全部为基准状态既有（0 条由 A3 引入）

- `node --test`（Node 24.16.0 自动发现，384 tests）：370 pass / 14 fail。
- **对照实验**：`git stash` 掉 A3 全部改动后在 00b402f 基准上跑全部失败文件 → **同样的 14 条失败**（111 tests, 97 pass, 14 fail，一一对应）→ 结论：14 条全部为既有失败，A3 引入 0 条新失败。
- P3 脚本回归：`_p3_a2_risk_evaluator.js` 35 断言全过、`_p3_a1_relation_events.js` 黄金样本全过；三个冻结 CSV 重生成字节一致（git status 无 CSV 改动）。

14 条既有失败归因：

| # | 失败 | 归因 |
|---|---|---|
| 1 | `_za_test.js` 整文件 | 根目录遗留草稿测试文件，被 Node 24 默认 `*_test.js` glob 误收 |
| 2-4 | 三处版本号断言（`bazi.js?v=20260813c`/`20260810b`、`result.js?v=5`：bazi-yongji-report / paipan-direct-mode-contract / renyuan-presentation） | 引擎版本号已升至 20260813d，测试锁旧版号——既有测试维护债 |
| 5-7 | SW 三处缓存断言（mobile-report-pdf v7、payment-ui-contract 静态缓存） | SW 版本/清单与测试锁版本漂移 |
| 8 | mobile-report-pdf:263 html2canvas 依赖顺序 | result.html 依赖布局与测试锁版本漂移 |
| 9 | homepage-visual-contract:14 v3 移动端图 | `images/zhishi-hero-ink-mobile-v3.png` 资源不在仓库 |
| 10-11 | payment-ui-contract:106/429 `ReferenceError: AbortController is not defined` | 测试 vm 沙箱环境缺 Node 全局（测试环境问题，与业务无关） |
| 12 | static-headers:6 `404 !== 200` | 测试引用的静态资源缺失 |
| 13-14 | 子时两断言（bazi-professional-core:126、hepan-professional-consistency:47）+ ziwei 早晚子时（ziwei-professional-core:39） | 日期依赖型断言随 2026 日期漂移 |

## 5. Schema 备注（规格四与冻结产物的差异处理）

- 风险对象字段**严格照搬 A2-final 冻结产物**：`type / severity / parties / why / mitigations / triggerHint / evidence / partyEvidence`（8 字段，与 `risk()` 返回体逐字一致）。
- 规格四中「target/source」与「structuralPresence或partyEvidence」：冻结产物选择 `partyEvidence`（无 `structuralPresence` 字段），且风险对象不含 `target/source`（parties 已承载方向信息）。**冻结产物为权威**——A2-final 已获 GPT 裁决，A3 不得因规格文字回改字段形状，此差异记录于此备 GPT 复核。

## 6. 两条保留意见状态：全部未扩

1. **exposedUnrooted > hiddenMainRoot**：仅展示顺序，未改判定。
2. **d2 合绊**：仅 mitigation 文案，无自动降级。
3. 未新增七杀坐禄位节点；未扩中余气财印冲；未扩藏干官杀混杂。

## 7. 停止条件自检

| 规格十条件 | 状态 |
|---|---|
| P1/P2 全输出零漂移 | ✅ A 层 53 盘全等 |
| 53 盘 structuralRisks 与 A2-final 全等 | ✅ B2 17 列全等 |
| #9 与 K2-final 关键盘全部命中 | ✅ C/D 全中 |
| 全量测试无新增未解释失败 | ✅ 370/384，14 条既有失败逐条归因（基准对照证明非 A3 引入） |
| 验收前不 push、不部署 | ✅ 仅本地提交于 `p3-a3` |

**→ P3-A3 达标。待 GPT 裁 CLOSED / 部署。**

## 8. GPT P3-A3 最终裁决（2026-08-14）：CLOSED

1. **P3-A 正式 CLOSED**。依据：P1/P2 对 53 盘零漂移；正式 relationEvents 与 A2-final 271 events 全等；正式 structuralRisks 与 A2-final 59 risks 全等；#9 黄金样本、K2-final 四盘、#8/B1 节点恢复全部命中；全量测试与基准 A/B 失败集一致，A3 新增失败 0。
2. **Schema 备注批准当前正式实现，不返工**：structuralRisk v1 正式字段采用冻结产物 `type / severity / parties / why / mitigations / triggerHint / evidence / partyEvidence`。**`partyEvidence` 为 structuralPresence 的正式承载字段**；structuralRisk v1 不设通用 target/source，具体作用双方及方向由 `parties / why / evidence` 表达（规格在收敛过程中发生的合理 schema 简化，非漏字段）。relationEvents 中非对称关系仍保留真实 source→target，对称关系 source/target 仅 canonical ordering。
3. **冻结清单（不在部署前扩展）**：exposedUnrooted vs hiddenMainRoot 排序；d2 合绊自动降级；七杀坐禄但非本气根节点；藏干官杀混杂；中余气财印冲；任何新 structuralRisk 类型。
4. **允许部署 p3-a3**：fetch 检查 origin/main → merge（真实 merge）→ 确认只带入 A3 白名单 → push main → webhook 部署 → 线上验证 js/bazi.js 与 P2 冻结 blob 字节一致、js/structural.js 与 merge blob 字节一致。
5. **线上最小验收**：#9（51 中和/用木/喜木/忌空/8 events/3 risks/伤官见官=潜在/子午冲 why 含"印星之根"不含"日主之禄"/财印冲=潜在）；K2（A6=存在/P15-03 不输出/H05=潜在/H13 不输出/#8/B1 恢复）；再选一个零 structuralRisk 盘验证五行层零漂移。
6. 验收通过后 **P3-A = CLOSED + deployed**，不再修改 P3-A 规则。下一阶段先做 P3 总体收口判断（P3-B nonDayBranchRoot 是否值得独立开 P2.4 / structuralRisks 如何进入最终报告 UI / 是否进入最终盲测），**不默认 P3-B 一定要实现**。
