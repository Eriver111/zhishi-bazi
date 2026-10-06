'use strict';

// Deterministic projection of the complete audit, not a score or event classifier.
function annualMechanismContext(graph) {
  if (!graph || graph.scope!=='temporal-structure-audit' || !Array.isArray(graph.paths) || !Array.isArray(graph.edges)) return '';
  const arr=value=>Array.isArray(value)?value:[];
  const nodes=Object.fromEntries(arr(graph.nodes).filter(n=>n&&n.id&&n.pillar&&n.layer&&n.char).map(n=>[n.id,n]));
  const edges=Object.fromEntries(graph.edges.filter(e=>e&&e.id).map(e=>[e.id,e]));
  const positions={year:'年柱',month:'月柱',day:'日柱',hour:'时柱',dayun:'大运',annual:'流年'};
  const nodeName=id=>{const n=nodes[id];return n ? (positions[n.pillar]||n.pillar)+(n.layer==='hidden'?'支'+n.branch+'藏':'')+n.char+'（'+(n.shiShen||n.family||'')+'）' : id;};
  const statuses={'annual-new-route':'本年新增关系路径','annual-additional-carrier':'已有同类路径，本年增加载体','decade-background':'大运已有背景',
    'annual-counteraction-contact':'本年新见对原控制源的制约','annual-additional-counteractor':'原有同类制约，本年增加作用源'};
  const stages={relation:'仅关系存在',connected:'节点连续，效力未定',contested:'存在竞争制约',blocked:'受阻','counteraction-contact':'触及原控制源，解除未证实'};
  const originalStages={effective:'原局作用成立，不代表当年仍有效',partial:'条件未齐',blocked:'受阻',relation:'仅关系存在',absent:'未成立','edge-supported':'关系边，未作有效作用裁决'};
  const labels={'intra-path-control-contact':'链内相克','incoming-control-contact':'外来克制','stem-binding-contact':'天干合的牵连','root-branch-contact':'根所在支受作用','no-literal-root':'未见同五行藏根'};
  const provided=graph.paths.concat(arr(graph.counteractions));
  // Never fill missing node/edge references with plausible-looking prose.
  const all=provided.filter(p=>p&&Array.isArray(p.nodeIds)&&p.nodeIds.length>=2&&Array.isArray(p.edgeIds)
    &&p.edgeIds.length===p.nodeIds.length-1&&p.nodeIds.every(id=>nodes[id])
    &&p.edgeIds.every((id,i)=>edges[id]?.fromNodeId===p.nodeIds[i]&&edges[id]?.toNodeId===p.nodeIds[i+1]));
  const sorted=all.map((p,index)=>({p,index,visible:(p.nodeIds||[]).filter(id=>nodes[id]?.layer==='gan').length}))
    .sort((a,b)=>Number(b.p.temporalStatus!=='decade-background')-Number(a.p.temporalStatus!=='decade-background')||b.visible-a.visible||a.index-b.index);
  const groups=new Map();
  for(const {p} of sorted){const key=(p.kind||p.name)+':'+p.temporalStatus;if(!groups.has(key))groups.set(key,p);}
  const shown=[...groups.values()].slice(0,10);
  if(!shown.length)return '';
  const lines=['【岁运补入后的节点通路】下面是实际生克关系的候选路径，不是已成立的格局或已发生的事件。节点连续不等于有效，天干相合不自动合走；本年重复载体不能冒充首次出现。'];
  for(const p of shown){
    const constraintIds=arr(p.constraintIds);
    const constraints=constraintIds.map(id=>graph.constraintsById?.[id]).filter(Boolean);
    const priority=c=>{
      const edge=edges[c.edgeId],from=nodes[edge?.fromNodeId],to=nodes[edge?.toNodeId];
      if(from?.scope==='annual'||nodes[c.nodeId]?.scope==='annual')return 0;
      if(to?.scope==='annual'||edge?.scope==='annual')return 1;
      return edge?.scope==='dayun'?2:3;
    };
    const constraintGroups=new Map();
    for(const c of constraints.slice().sort((a,b)=>priority(a)-priority(b))){
      const edge=edges[c.edgeId];
      const text=(labels[c.type]||c.type)+'：'+(edge?.evidence||nodeName(c.nodeId||'')||'需核对');
      if(!constraintGroups.has(c.type))constraintGroups.set(c.type,[]);
      const group=constraintGroups.get(c.type);
      if(group.length<2&&!group.includes(text))group.push(text);
    }
    const roots=arr(p.carrierEvidenceIds).map(id=>graph.carrierEvidenceById?.[id]).filter(Boolean);
    const carrierText=roots.map(r=>nodeName(r.nodeId)+'字面藏根见'+(arr(r.rootIds).map(nodeName).join('、')||'无')
      +'（原局'+arr(r.usableNatalRootIds).length+'处达根系账本承载条件'
      +(arr(r.temporalRootIds).length?'；岁运根效力尚未结算':'')+'）').join('；');
    const constraintTexts=[...constraintGroups.values()].flat();
    const original=p.mechanismName?'。原作用：'+p.mechanismName+'（'+(originalStages[p.originalActionStage]||'阶段未提供')+'）':'';
    lines.push((statuses[p.temporalStatus]||p.temporalStatus)+'｜'+(p.name||p.kind)+'｜'+(stages[p.stage]||p.stage)
      +'：'+(p.nodeIds||[]).map(nodeName).join(' → ')
      +'。实际边：'+(p.edgeIds||[]).map(id=>edges[id]?.evidence||id).join('；')
      +original+'。承载：'+(carrierText||'未提供，不补造')+'。同时检查：'+(constraintTexts.join('；')||'本图未列竞争关系，不等于证明畅通')
      +'。制约共'+constraintIds.length+'项，摘要展示'+constraintTexts.length+'项（'+constraintGroups.size+'类）；未展示变体不能当作不存在。'
      +(constraints.length<constraintIds.length?'部分制约引用缺失，不能按没有制约处理。':''));
  }
  lines.push('完整审计有'+provided.length+'条路径/制约候选，本段按类型和年度来源摘要'+shown.length+'条；数量不是独立证据票数或事件概率。'
    +(provided.length>all.length?'其中'+(provided.length-all.length)+'条缺少有效节点或连续边，未用作依据。':''));
  lines.push('据此分别比较职业身份与资格、收入来源与投资损益、学业考试及家庭关系的证据。财生官印不是必然录用，财克印也不自动等于辍学或失业；要说明当年新增哪一作用、原有通路是否受制，不能只看喜忌或一个宫位的冲。现有效力字段为未证实，不得把候选通路写成已经解除风险。');
  return lines.join('\n');
}
module.exports={annualMechanismContext};
