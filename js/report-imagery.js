(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReportImagery=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
// Traditional interpretation hypotheses, NOT an empirical prediction model.
// The registry owns conditions, counterexamples, outcome variants and provenance together.
const rules=[];
function add(id,name,group,names,condition,counterexample,rows){
 rules.push({id,name,group,names,condition,counterexample,source:group==='timing'?'timing':'structure',outcomes:rows.map(r=>({domain:r[0],manifestation:r[1],label:r[2],detail:r[3]}))});
}
add('wealth-breaks-seal','财破印','restriction',['财破印','财坏印','财印冲'],'有用印受到财的实际克制，并在当年被引动','印为忌且财有效制印，应转财制印；正常消费不算损失',[
 ['wealth','unexpected-loss','非计划性损失或回款受损','出现非计划性钱财损失、坏账或回款受损（正常消费、储蓄转投资不算损失）'],
 ['study','preparation-disrupted','学习或资格准备被现实事务打断','学习、考证或资格准备被工作、资金或其他现实事务打断']]);
add('peer-takes-wealth','比劫分流','restriction',['比肩夺财','比劫夺财','比劫分流'],'财需要保护而比劫形成争夺或分流','同伴带来新客户或收入，不应记成夺财',[
 ['wealth','partnership-loss','合伙、人情或竞争造成损失','因合伙分配、借款未收回或竞争损失而减少实际留存']]);
add('output-controls-officer','伤官见官','restriction',['伤官见官','官逢伤官'],'伤官与需要维护的正官形成实际冲突','官为病且食伤有效节官，不用同一句冲突断语',[
 ['career','authority-conflict','与领导、制度或审核发生冲突','与领导、制度或审核发生明显冲突，影响工作推进']]);
add('seal-restrains-output','枭夺食','restriction',['枭夺食','枭神夺食'],'偏印实际克制有用食神，未被有效制解','仅有印与食神共存、或印有效约束过量输出均不足',[
 ['study','output-interrupted','学习输出或考试发挥受阻','学习输出、考试发挥或作品提交受到干扰'],
 ['career','delivery-interrupted','项目交付或专业输出受阻','项目交付、创作或专业输出出现中断或明显返工']]);
add('officer-pressure','官杀压力','pressure',['官杀混杂','杀重无制','官杀混杂压身','七杀攻身'],'官杀压力实际存在且制化不完整','已有制化不等于毫无压力，但不能仍按完全无救处理',[
 ['career','responsibility-pressure','职责或考核压力集中','职责、考核或多方要求集中增加，影响工作节奏']]);
add('peer-resists-kill','比劫抗杀','support',['比劫抗杀'],'七杀压身、比劫有实际承载，非从格；区分硬扛与有效制化','只说累不算完成目标；比劫无力或资源断裂时不能保证扛过',[
 ['career','costly-completion','很累，但靠硬扛或同伴分担完成了','压力和投入明显增加，靠自己持续硬扛或同伴分担，最终完成了主要目标'],
 ['career','costly-stalled','付出很累，事情仍被拖住','虽持续加大投入或找人分担，主要目标仍未完成，或只能勉强维持']]);
add('peer-carries-wealth','比劫担财','support',['比劫担财'],'财多耗身且比劫确有承载作用','分担没有增加可留存收入、反而侵占收益时不算承财',[
 ['wealth','shared-capacity','有人分担后接住了订单或资金压力','通过同伴协作、团队分工或增加执行人手，接住原先独自难以承接的订单与资金安排']]);
add('seal-transforms-kill','杀印相生','support',['杀印相生','印化杀'],'七杀经印到身的连续通路成立，印可用且没有严重断点','只有杀生印、没有印生身，不能称压力已转化',[
 ['career','pressure-to-qualification','压力转成资历、方法或平台支持','面对较强考核或责任，通过学习、资质或成熟方法获得支持，事情由难推进转为能处理']]);
add('officer-seal-support','官印相生','support',['官印相生'],'正官经印到身的连续通路成立且落点可用','名义上的岗位、证书不等于已经获得晋升',[
 ['career','institutional-recognition','按流程积累，获得正式认可','依靠规范流程、专业资质和持续积累，得到正式录用、评审认可或明确职责']]);
add('food-controls-kill','食神制杀','resolution',['食神制杀'],'食神有效、七杀确有压力，日主能承受泄身','极弱不能泄、食神无力或印夺食时，不按制杀成功解释',[
 ['career','skill-resolves-pressure','靠技能或方案化解难题','面对竞争、催促或棘手任务，通过专业技能和可执行方案解决了关键问题'],
 ['study','performance-under-pressure','压力下靠方法和发挥拿到结果','面对较难考试、竞赛或评审，通过方法训练和实际发挥拿到阶段成果']]);
add('output-controls-kill','食伤制杀','resolution',['食伤制杀'],'实际食伤作用于七杀且有承载，不能用见食伤代替制杀','继续泄弱自身或没有制到七杀时不算有效解压',[
 ['career','solution-negotiation','用表达与解决方案争回主动','通过说明方案、展示成果或解决具体问题，改变了原先被动承压的局面']]);
add('hurt-combines-kill','伤官合杀','resolution',['伤官合杀'],'实际伤官与七杀有合，且现有裁决支持合的作用','只记合不自动记化，更不能直接许诺升职',[
 ['career','negotiated-release','通过协商缓和强硬要求','通过协商、专业表达或重新约定条件，缓和了原先强硬的要求']]);
add('blade-joins-kill','羊刃驾杀','resolution',['羊刃驾杀'],'刃与杀双方有力、相互制衡而非单方过量','刃旺无制或杀重失衡，不套用敢冲就成事',[
 ['career','decisive-execution','在高压任务中靠执行力打开局面','面对紧急任务或强竞争，以果断行动和执行力推进了原先难以开展的事情']]);
add('seal-guides-output','伤官配印','resolution',['伤官配印'],'印与伤官的实际作用受到现有格局/功能裁决支持','印太重压住表达、伤官无制，均不能泛化为才学发挥',[
 ['career','expertise-standardized','把想法整理成专业成果','将原本分散或锋利的想法，整理成有方法、有规范、能被接受的专业成果'],
 ['study','knowledge-to-output','理解与表达接上，形成成绩或作品','通过系统学习和整理，将理解转成可检验的成绩、作品或资格成果']]);
add('output-generates-wealth','食伤生财','flow',['食伤生财'],'输出到财的真实通路存在，落点可用且当年被引动','有作品没有成交、收入增加却未留存，分别核对',[
 ['wealth','skill-converted-income','技能、内容或产品换成实际收入','靠技能服务、内容、产品或具体解决方案，获得实际成交、回款或收入增长']]);
add('wealth-generates-officer','财生官','flow',['财生官'],'财到正官的真实通路存在且正官可用','只增加投入或责任而未获认可，不算职位提升',[
 ['career','resources-to-responsibility','资源带来更正式的职责','客户、项目或资源增加后，获得更明确的平台职责、管理权限或正式任用']]);
add('wealth-feeds-kill','财党杀','pressure',['财党杀','财生杀'],'财加强有压力的七杀，制化不完整','杀已经有效制化或顺势成格，不套财多必压身',[
 ['career','resource-pressure','项目越大，责任和约束越重','随着项目、资金或资源规模增加，考核、时限和责任随之加重'],
 ['wealth','cash-tied-to-pressure','资金投入与履约压力绑在一起','为了履约、经营责任或维持项目，资金被持续占用，周转余地缩小']]);
add('officer-protects-wealth','官护财','resolution',['官护财'],'官杀实际制约争财的比劫，且保护财而非继续生杀','合同存在不等于执行有效；没有控制争夺则不算护财',[
 ['wealth','rules-protect-retention','用合同或制度守住收益','通过明确合同、权限或分配规则，减少了争夺、欠款或不合理分流，守住收益']]);
add('wealth-regulates-seal','财制印','resolution',['财制印'],'印过量为病，财实际制印且没有破坏有用印','财破可用印是另一方向，不能混为现实推动力',[
 ['career','action-over-overthinking','现实目标推动落地','明确的项目、收入或交付目标，促使自己结束空想和过度准备，真正开始行动']]);
add('seal-supports-self','印扶身','support',['印扶身'],'印生身通路实际存在且印可用','只见印不推断有人帮助，更不回写父母关系',[
 ['study','method-supported-learning','靠资料和方法稳住学习','借助系统资料、指导或成熟方法，改善了原先难以独自解决的学习问题'],
 ['career','preparation-reduces-load','准备与指导减轻了独自承压','通过培训、清晰指导或可复用的方法，减少摸索成本，工作逐渐稳定']]);
add('seal-overrestricts-output','印重抑输出','restriction',['印重抑输出'],'印实际约束有用输出且印为忌','有效审校和方法整理不算压制表达',[
 ['career','overpreparation-delays','准备很多，交付反而迟缓','反复查资料、修改或等待认可，实际表达、决策和交付被拖慢']]);
add('output-drains-self','食伤泄身过度','pressure',['食伤泄身过度'],'现有身弱病因明确为食伤泄身，输出节点又被引动','有成果并能恢复不算过度消耗，不能据此诊断疾病',[
 ['career','output-exhaustion','持续输出，精力跟不上','持续处理表达、创作、交付或服务任务，投入增加而恢复不足，后续进度受影响']]);
add('peer-through-output','比劫生食伤','flow',['比劫生食伤'],'同气力量确实进入输出链而非停留在争夺','人多热闹却无产出，不算团队力量转成果',[
 ['career','team-to-delivery','团队力量转为实际产出','通过协作、分工或共同练习，把人手与行动力转成了实际交付和成果']]);
add('officer-regulates-peers','官杀制劫','resolution',['官杀制劫'],'比劫过量且官杀实际约束比劫、方向可用','官杀压弱身不是同一解释，不能说越管越好',[
 ['career','discipline-improves-cooperation','明确规则后协作改善','明确分工、期限和责任后，原先争抢、各行其是的局面有所改善']]);
add('output-regulates-officer','食伤节官','resolution',['食伤节官'],'正官已成为压力且现有食伤有力可节官，不破可用官格','不能把食神制杀的条件直接复制到正官',[
 ['career','process-reform','用专业改进减少不合理约束','通过技术、表达或流程改进，减少了重复要求和不合理约束']]);
add('wealth-officer-seal-flow','财官印连续流通','flow',['财官印连续流通'],'财到官杀到印再到身是连续通路，关键落点可用','几种十神同时出现不等于连续相生；资源不自动等于收入',[
 ['career','resources-to-capability','资源、平台和专业能力接上','项目资源、平台规则与专业积累形成配合，使自己能承担更完整的工作']]);
add('clash-releases-obstruction','冲动忌神','timing',['冲动忌神'],'当年冲作用于忌神，已有关系裁决为有利','只见冲不能直接说冲开财库或必然发财',[
 ['change','change-releases-block','变动后反而解开原来的阻碍','经历位置、安排或环境调整后，原先卡住的事情开始推进']]);
add('clash-damages-support','冲动喜用','timing',['冲动喜用'],'当年冲作用于有用节点且关系裁决不利','局部作用不等于整体失败，不由冲直接断灾病',[
 ['change','support-disruption','依赖的安排变化，需重新适应','原先依赖的平台、资源或稳定安排发生变化，带来额外适应与重建成本']]);
add('combine-connects','合的牵引','timing',['合的牵引'],'当年实际合会被记录，只取联结或牵制，不冒称已合化','有联系不等于关系确定、结婚或获得好处',[
 ['relationship','closer-coordination','联系加深，共同安排增多','与重要关系或合作对象的联系更密切，需要协调的共同安排增多']]);
add('punishment-rework','刑的反复摩擦','timing',['刑的反复摩擦'],'当年刑或自刑有明确作用对象','一次普通争执不够代表持续反复，不诊断性格和疾病',[
 ['career','repeated-friction','同类问题反复，工作来回处理','工作中的同类要求、沟通问题或返工反复出现，需要多次处理']]);
add('recurrence-revisits','伏吟重现','timing',['伏吟重现'],'当年有明确伏吟记录及现实领域独立触发','重复干支不等于灾难，也不保证同一事件重演',[
 ['change','old-issue-revisited','旧事项回来，需要重新处理','以前处理过的安排、计划或问题重新出现，需要复查、收尾或再次选择']]);

// Common process -> contextual actors/tasks -> observed outcome. Only the first
// layer can be referenced across settings; it never confirms the target outcome.
const commonProcesses={
 'wealth-breaks-seal':'现实资源与投入挤压原有的支持和准备，原先依赖的方法或安排受到干扰',
 'peer-takes-wealth':'同伴之间的分配、竞争或共同开支，使个人可支配资源被分流',
 'output-controls-officer':'自主表达与权威要求之间存在张力，可能以质疑、反驳或不愿直接服从表现',
 'seal-restrains-output':'接收指导、检查或限制的过程，阻断了原本需要发挥的实际输出',
 'officer-pressure':'外部要求、责任或约束集中增加，压缩了个人可调整的余地',
 'peer-resists-kill':'面对外部压力，主要靠自身持续投入或同伴分担承载，过程耗力，结果另看',
 'peer-carries-wealth':'通过分担与协作，提高独自难以承接的资源安排或执行能力',
 'seal-transforms-kill':'借助学习、指导或方法，把外部压力转成可以理解和处理的要求',
 'officer-seal-support':'通过规范要求、系统准备与指导建立连接，争取正式认可',
 'food-controls-kill':'通过熟练技能、训练和可执行办法应对难点，争取处理压力的主动权',
 'output-controls-kill':'把表达和实际成果用于解决外部难题，而不只停留在被动承压',
 'hurt-combines-kill':'通过表达、协商与重新约定，寻找缓和强硬要求的空间',
 'blade-joins-kill':'在紧迫要求下调动行动力和执行力，形成推进事情的力量',
 'seal-guides-output':'将分散的想法与表达整理成系统、有规范、可检验的成果',
 'output-generates-wealth':'实际输出连接到可交换的价值，能否形成可支配收入另行核对',
 'wealth-generates-officer':'资源投入连接到参与资格或责任要求，认可程度另看',
 'wealth-feeds-kill':'投入和承接规模扩大后，期限、责任和外部约束也随之加重',
 'officer-protects-wealth':'借助规则、凭据和边界减少争夺或不合理分配，保护已有资源',
 'wealth-regulates-seal':'具体需求和现实约束推动行动，减少过度准备与停留在想法中的情况',
 'seal-supports-self':'通过资料、指导或成熟方法获得支撑，减少独自摸索的负担',
 'seal-overrestricts-output':'准备、检查或等待认可占用过多精力，挤压实际表达与完成事项的空间',
 'output-drains-self':'持续输出与投入超过当时恢复节奏，后续推进受到消耗的影响',
 'peer-through-output':'同伴力量通过协作、分工或共同练习转成实际产出',
 'officer-regulates-peers':'用明确规则和分工约束争抢或各行其是，重新组织协作',
 'output-regulates-officer':'通过专业表达和改进办法调整不合理约束，区别于损坏有用的规则',
 'wealth-officer-seal-flow':'资源、组织要求与学习支持相互连接，帮助个人承担更完整的事项',
 'clash-releases-obstruction':'原有安排变化后，先前的阻碍出现松动空间',
 'clash-damages-support':'原来可依赖的安排被打断，需要重新寻找支持与适应方式',
 'combine-connects':'人与人或事项之间的联结增多，共同协调与相互牵制也随之增加',
 'punishment-rework':'同类要求、沟通或处理环节反复出现，形成来回摩擦',
 'recurrence-revisits':'既往事项或安排重新进入当前生活，需要再次处理或选择'
};
rules.forEach(rule=>{rule.commonProcess=commonProcesses[rule.id];});

// Validate stored option identities against the registry before using common
// process evidence. Text or a forged rule name alone cannot supply a reference.
function describeOption(option){
 if(!option)return null;
 const rule=rules.find(r=>'rule:'+r.id===option.mechanism_key);if(!rule)return null;
 const match=String(option.manifestation||'').match(/^([^:]+)(?::(student|exam|work|transition|home|retired|daily))?$/);if(!match)return null;
 const scene=match[2]||'unspecified';
 const valid=rule.outcomes.some(o=>o.manifestation===match[1]&&(o.domain===option.domain||o.domain==='career'&&option.domain==='study'&&['student','exam'].includes(scene)));
 return valid?{id:rule.id,name:rule.name,commonProcess:rule.commonProcess,scene,domain:option.domain,manifestation:match[1]}:null;
}

// A manifestation is bound to a life setting. Feedback from school must not
// silently validate an employment outcome, even when the structural rule matches.
const settings={
 student:{label:'在读',task:'课程、作业或集体活动',goal:'学习阶段目标',people:'同学或学习伙伴',authority:'老师要求、校规或评价标准',support:'教材、答疑或学习方法',resource:'学习材料、时间与可支配费用',output:'答题、作业或作品',plan:'课程与校园生活安排'},
 exam:{label:'备考进修',task:'复习、练习或报名准备',goal:'备考阶段目标',people:'备考伙伴',authority:'考试要求、报名条件或评审标准',support:'课程、指导或复习方法',resource:'备考时间、资料与培训费用',output:'模拟答题、展示或考核作业',plan:'复习与考核安排'},
 transition:{label:'求职调整',task:'申请、面试准备或方向探索',goal:'求职或转型阶段目标',people:'同行或协助者',authority:'申请条件、甄选流程或约定',support:'信息、指导或准备方法',resource:'求职时间、培训费用与生活预算',output:'申请材料、面试表达或试做成果',plan:'求职与生活安排'},
 home:{label:'居家生活',task:'生活事务、照料分工或个人计划',goal:'生活安排目标',people:'协作分担者',authority:'办事要求、共同约定或分工规则',support:'实用信息、指导或办事方法',resource:'可支配时间、物资与生活预算',output:'办事成果或个人创作',plan:'日常生活与照料安排'},
 retired:{label:'退休生活',task:'日常办事、兴趣活动或共同安排',goal:'个人生活目标',people:'同伴或协助者',authority:'办事规定、活动要求或共同约定',support:'可靠信息、指导或办事方法',resource:'可支配时间、生活预算与物资',output:'办事成果或兴趣作品',plan:'日常生活与活动安排'},
 daily:{label:'生活场景待细分',task:'个人事务或共同任务',goal:'当时的主要目标',people:'同伴或协助者',authority:'相关要求、流程或共同约定',support:'资料、指导或处理方法',resource:'可支配时间、费用与物资',output:'实际表达或完成的成果',plan:'当时的主要生活安排'}
};
const sceneTexts={
 'wealth-breaks-seal':'原本用于{goal}的{resource}受到挤占，打断了准备或推进',
 'peer-takes-wealth':'因共同支出分摊、代垫未还或费用争议，可支配的钱实际减少；正常约定内分摊不算损失',
 'output-controls-officer':'自己的表达或做法与{authority}发生明显冲突，影响了{task}的推进',
 'seal-restrains-output':'反复接收指导、检查或修改，打断了{output}，出现无法按计划完成的情况',
 'officer-pressure':'{authority}集中增多，{task}的节奏受到挤压',
 'peer-resists-kill':'面对较重的{task}，靠持续投入或{people}分担承压',
 'peer-carries-wealth':'通过{people}分担费用或执行，接住了原先独自难以承担的{resource}安排',
 'seal-transforms-kill':'面对较严的{authority}，通过{support}理清办法，原先难处理的{task}逐渐能推进',
 'officer-seal-support':'按照{authority}准备，借助{support}完成要求，获得明确审核或评价认可',
 'food-controls-kill':'面对较难的{task}，靠方法训练与实际发挥解决关键难点，形成了可核对的阶段成果',
 'output-controls-kill':'通过{output}展示解决办法，使原先被动承压的局面有所改善',
 'hurt-combines-kill':'通过说明理由、展示{output}或协商条件，缓和了原先强硬的要求',
 'blade-joins-kill':'面对紧迫的{task}，靠明确分工和果断行动推进了原先卡住的事情',
 'seal-guides-output':'把分散的想法通过{support}整理成有条理的{output}，达到可检验的要求',
 'output-generates-wealth':'通过实际技能服务或作品获得了可支配收入；只有得到认可、尚无报酬时不算收入兑现',
 'wealth-generates-officer':'投入{resource}后获得了参与资格或更明确的责任；单纯增加花费不算获得认可',
 'wealth-feeds-kill':'投入{resource}越多，随之而来的期限和要求越紧，{task}的压力反而加重',
 'officer-protects-wealth':'通过明确费用约定、凭据或分配规则，减少代垫未还或不合理分摊，守住可支配的钱',
 'wealth-regulates-seal':'具体的预算、期限或实际需求，促使自己停止过度准备，开始推进{task}',
 'seal-supports-self':'借助{support}减少独自摸索，原先吃力的{task}逐渐稳定',
 'seal-overrestricts-output':'反复查资料、等待认可或修改，反而拖慢了{output}，没能按计划完成',
 'output-drains-self':'持续投入{output}或{task}，恢复时间不足，后续进度受影响；不据此判断疾病',
 'peer-through-output':'通过{people}协作、分工或共同练习，形成了实际的{output}，而非只有讨论',
 'officer-regulates-peers':'明确分工、期限和规则后，{people}之间原先争抢或各行其是的情况改善',
 'output-regulates-officer':'通过{output}说明实际问题并改进办法，减少了重复要求或不合理限制',
 'wealth-officer-seal-flow':'{resource}、可参与的机会与{support}接上，使自己更有能力推进{task}',
 'clash-releases-obstruction':'{plan}调整后，原先卡住的事情开始推进；变化本身不等于有利',
 'clash-damages-support':'原先依赖的{support}或稳定安排发生变化，需要重新适应{task}',
 'combine-connects':'与{people}的联系加深，共同参与的{plan}增多；不据此推断恋爱或婚姻',
 'punishment-rework':'{task}中同类要求、沟通或返工反复出现，需要多次处理',
 'recurrence-revisits':'过去的{plan}或未处理完的问题再次出现，需要复查、收尾或重新选择'
};
function resolveScene(input){
 if(!input)return null;
 const age=input.age==null?null:Number(input.age);
 if(['student','exam','working','transition','home','retired'].includes(input.status))return input.status;
 return Number.isFinite(age)&&age>=6&&age<18?'student':'daily';
}
function sceneOutcomes(rule,domain,life){
 const historicalStudy=life&&life.historical&&life.status==='unknown'&&domain==='study';
 const scene=historicalStudy?(Number(life.age)<24?'student':'exam'):resolveScene(life);
 let rows=rule.outcomes.filter(o=>o.domain===domain);
 if(!scene)return rows;
 if(domain==='study'&&!['student','exam'].includes(scene))return [];
 // School/learning manifestations have their own domain and annual evidence gate.
 if(domain==='study'&&!rows.length&&['student','exam'].includes(scene))rows=rule.outcomes.filter(o=>o.domain==='career').map(o=>({...o,domain:'study'}));
 if(scene==='working')return rows.map(o=>({...o,manifestation:o.manifestation+'@work'}));
 const s=settings[scene],format=t=>t.replace(/\{(\w+)\}/g,(_,k)=>s[k]);
 return rows.filter(o=>!(rule.id==='output-generates-wealth'&&life.age!=null&&Number(life.age)<18)).map(o=>{
  let detail=format(sceneTexts[rule.id]);
  if(rule.id==='wealth-breaks-seal'&&domain==='wealth')detail='出现非计划性钱财损失、代垫未还或退款未到账，影响可支配费用；正常购买资料、消费或转存不算损失';
  if(rule.id==='peer-resists-kill')detail+=o.manifestation==='costly-completion'?'，最终完成了'+s.goal:'，但'+s.goal+'仍未完成或只能勉强维持';
  if(historicalStudy)detail='如果当年在读、学习或备考：'+detail;
  return {...o,manifestation:o.manifestation+'@'+scene,label:rule.name+'·'+({study:'学习与准备',career:s.task,wealth:'可支配费用',relationship:'联系与协作',change:s.plan}[domain]||s.task)+(rule.id==='peer-resists-kill'?(o.manifestation==='costly-completion'?'：累但完成':'：累仍受阻'):''),detail};
 });
}
const arr=x=>Array.isArray(x)?x:[];
function role(y,wx){const e=arr(y&&y.elementRoleLedger&&y.elementRoleLedger.entries).find(e=>e.element===wx);return e&&e.fortuneRole||(arr(y&&y.yongShen).includes(wx)?'用神':arr(y&&y.xiShen).includes(wx)?'喜神':arr(y&&y.jiShen).includes(wx)?'忌神':'未定');}
const good=r=>r==='用神'||r==='喜神';
function collectSignals(analysis){
 analysis=analysis||{};
 const signals=arr(analysis.triggers).filter(s=>s&&s.source!=='大运').concat(arr(analysis.reportTriggeredRisks)).filter(s=>s&&s.active!==false&&s.strengthensRisk!==false).map(s=>({...s,origin:'annual'}));
 const context=analysis.reportMechanismContext||{},chain=context.chain||{},y=context.yongJi||{},cause=y.weaknessCause||{};
 const ms=arr(chain.mechanisms),triggers=arr(analysis.triggers).filter(t=>t.source!=='大运');
 const follows=context.congGe===true||!!(context.congGe&&context.congGe.isCong)||!!(context.pattern&&context.pattern.congGe);
 const hits=m=>triggers.filter(t=>/六冲|天克地冲|地冲月提|六合|半合|三合|三会|刑|六害|六破|伏吟/.test(t.type||'')&&t.target&&(t.target===m.sourcePillar||t.target===m.targetPillar));
 const emit=(type,m,evidence)=>{const hit=hits(m);if(hit.length)signals.push({type,origin:'activated-natal',detail:arr(evidence||m.evidence).concat(hit.map(t=>t.detail||t.type)).join('；'),strength:m.dominanceScore||1});};
 ms.forEach(m=>{
  const sr=role(y,m.sourceWx),tr=role(y,m.targetWx);
  if(m.name==='财破印'){if(good(tr))emit('财破印',m);else if(tr==='忌神'&&good(sr))emit('财制印',m);}
  if(m.name==='比劫制财'){if(good(sr)&&cause.type==='财多耗身'&&!follows)emit('比劫担财',m);else if(sr==='忌神'&&good(tr))emit('比劫夺财',m);}
  if(m.name==='食伤生财'&&good(tr)&&good(sr))emit(m.name,m);
  if(m.name==='财生官杀'){if(m.targetShiShen==='正官'&&good(tr))emit('财生官',m);if(m.targetShiShen==='七杀'&&tr==='忌神'&&!follows)emit('财党杀',m);}
  if(m.name==='印生身'&&good(sr)&&!follows)emit('印扶身',m);
  if(m.name==='印制食伤'){
   if(m.sourceShiShen==='偏印'&&m.targetShiShen==='食神'&&good(tr)&&sr==='忌神')emit('枭夺食',m);
   else if(sr==='忌神'&&good(tr))emit('印重抑输出',m);
   if(good(sr)&&m.targetShiShen==='伤官'&&arr(y.functionalTasks).some(t=>t.type==='印星制伤护格'))emit('伤官配印',m);
  }
  if(['食神制杀','食伤制杀'].includes(m.name)&&!follows&&(cause.foodGodControlsKill===true||(!cause.type&&good(sr)&&tr==='忌神')))emit(m.name,m);
  if(['食伤制官','伤官见官'].includes(m.name)){
   if(good(tr))emit('伤官见官',m);else if(tr==='忌神'&&good(sr)&&!cause.type)emit('食伤节官',m);
  }
  if(m.name==='官杀克身'){
   if(good(sr)&&tr==='忌神')emit('官杀制劫',m);
   if(m.sourceShiShen==='七杀'&&tr!=='忌神'&&sr==='忌神'&&!follows)emit('七杀攻身',m);
  }
 });
 // Continuous paths are already proved by common graph nodes in bazi-chain; mere cooccurrence is insufficient.
 arr(chain.paths).forEach(path=>{
  const first=ms.find(m=>m.name==='官杀生印'),last=ms.find(m=>m.name==='印生身');
  if(path.name==='官杀经印通关'&&first&&last&&good(role(y,last.sourceWx)))emit(first.sourceShiShen==='七杀'?'杀印相生':'官印相生',first,path.steps);
  if(path.name==='财官印身连续流通'&&first&&last&&good(role(y,last.sourceWx)))emit('财官印连续流通',first,path.steps);
 });
 const nodes=arr(chain.factGraph&&chain.factGraph.nodes),edges=arr(chain.factGraph&&chain.factGraph.edges);
 const effective=n=>n&&['本气','地支本气'].includes(n.depth)&&Number(n.weight)>0&&Number(n.effectiveCoefficient==null?1:n.effectiveCoefficient)>=0.5;
 const peers=nodes.filter(n=>n.family==='比劫'&&effective(n));
 if(!follows&&['七杀攻身','官杀混杂压身'].includes(cause.type)&&good(role(y,cause.peerElement))&&peers.length){
  const kill=ms.find(m=>m.sourceShiShen==='七杀'&&m.name==='官杀克身');
  if(kill)emit('比劫抗杀',kill,arr(kill.evidence).concat(['比劫有透出或本气承载；只支持承压候选，不保证结果']));
 }
 edges.forEach(e=>{
  const a=e.fromNode,b=e.toNode;if(!a||!b||e.type!=='生'||Number(e.strength)<0.55)return;
  const m={sourcePillar:a.pillar,targetPillar:b.pillar,evidence:[e.evidence]};
  if(a.family==='比劫'&&b.family==='食伤'&&good(role(y,b.wx)))emit('比劫生食伤',m);
  if((a.family==='日主'||a.family==='比劫')&&b.family==='食伤'&&cause.type==='食伤泄身'&&!follows)emit('食伤泄身过度',m);
 });
 edges.filter(e=>e.type==='克'&&Number(e.strength)>=0.55&&e.fromNode&&e.toNode&&e.fromNode.family==='官杀'&&e.toNode.family==='比劫').forEach(e=>{
  const next=edges.find(f=>f.type==='克'&&Number(f.strength)>=0.55&&f.fromNode&&f.toNode&&f.fromNode.id===e.toNode.id&&f.toNode.family==='财');
  if(next&&good(role(y,e.fromNode.wx))&&good(role(y,next.toNode.wx)))emit('官护财',{sourcePillar:e.fromNode.pillar,targetPillar:e.toNode.pillar,evidence:[e.evidence,next.evidence]});
 });
 const primaryPattern=context.pattern||{};
 [primaryPattern].concat(arr(primaryPattern.relatedPatterns)).forEach(p=>{if(p.status==='成格'){
  const name=String(p.name||p.legacyName||'').replace(/格$/,'');
  if(['伤官合杀','羊刃驾杀','伤官配印','官护财'].includes(name)){
   const matching=ms.filter(m=>name==='伤官配印'?m.name==='印制食伤':m.sourceShiShen==='七杀'||m.targetShiShen==='七杀');
   matching.forEach(m=>emit(name,m,['现有格局裁决：'+p.name].concat(arr(m.evidence))));
  }
 }});
 triggers.forEach(t=>{
  const emitTiming=type=>signals.push({...t,type,origin:'annual-relation',detail:t.detail||t.type});
  if(['六冲','天克地冲','地冲月提'].includes(t.type)){
   if(t.isGood===true&&t.targetRole==='忌神')emitTiming('冲动忌神');
   if(t.isGood===false&&good(t.targetRole))emitTiming('冲动喜用');
  }
  if((t.target==='day'&&['六合','半合','三合局'].includes(t.type))||t.type==='流年合日支')emitTiming('合的牵引');
  if(['month','hour'].includes(t.target)&&['刑','自刑','三刑俱全'].includes(t.type))emitTiming('刑的反复摩擦');
  if(t.type==='伏吟')emitTiming('伏吟重现');
 });
 return signals;
}
function candidates(domain,analysis){
 const signals=collectSignals(analysis);
 const life=analysis&&(analysis.reportLifeContext||analysis.eventAdjudication&&analysis.eventAdjudication.lifeContext);
 return rules.flatMap(rule=>{
  const riskRules=['wealth-breaks-seal','peer-takes-wealth','output-controls-officer','seal-restrains-output','officer-pressure','wealth-feeds-kill'];
  const matches=signals.filter(s=>rule.names.includes(s.type)&&(s.origin!=='annual'||riskRules.includes(rule.id)));if(!matches.length)return [];
  // Incompatible beneficial/adverse readings of the same mechanism require resolution first.
  const opposites={'wealth-breaks-seal':'财制印','wealth-regulates-seal':'财破印','peer-takes-wealth':'比劫担财','peer-carries-wealth':'比劫夺财'};
  if(opposites[rule.id]&&signals.some(s=>s.type===opposites[rule.id]))return [];
  return sceneOutcomes(rule,domain,life).map(o=>({key:domain+':'+rule.id+':'+o.manifestation.replace('@',':'),domain,mechanism_key:'rule:'+rule.id,manifestation:o.manifestation.replace('@',':'),label:o.label,detail:o.detail,
   reportBaseline:rule.id==='peer-resists-kill'?'压力仍然存在，推进主要靠持续投入、硬扛或同伴分担，过程较为耗力；承载能否持续决定任务能推进到哪一步，不直接断定已经完成。':o.detail+'。适用前提：'+rule.condition+'。',
   reportLabel:rule.id==='peer-resists-kill'?'比劫抗杀·承压方式':o.label,
   evidence:['规则候选：'+rule.name+'；共同作用：'+rule.commonProcess+'；成立条件：'+rule.condition,'触发依据：'+matches.map(s=>s.detail||s.conclusion||s.type).join('；'),'反例与边界：'+rule.counterexample],
   followup_prompt:'是否确实出现了上述过程和结果？',followup_options:[],
   _priority:Math.max(...matches.map(s=>Number(s.strength)||1))
  }));
 }).sort((a,b)=>b._priority-a._priority);
}
return {version:'imagery-v3',rules,candidates,collectSignals,resolveScene,sceneOutcomes,describeOption};
});
