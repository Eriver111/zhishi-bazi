'use strict';
// Explicit graph fragments for rendering/reconciliation tests. These establish
// the tested evidence contract; they are not claimed as a real person's chart.
module.exports=function mechanismFixture(names,life){
 const specs={
  '财破印':['财破印','土','水','正财','正印','克'],
  '比肩夺财':['比劫制财','木','土','比肩','正财','克'],
  '比劫夺财':['比劫制财','木','土','比肩','正财','克'],
  '伤官见官':['伤官见官','火','金','伤官','正官','克'],
  '枭夺食':['印制食伤','土','水','偏印','食神','克'],
  '官杀混杂':['官杀克身','金','木','七杀','比肩','克']
 };
 const nodes=[],edges=[],mechanisms=[],triggers=[],favorable=new Set(),unfavorable=new Set();
 for(const [i,name] of (Array.isArray(names)?names:[names]).entries()){
  const spec=specs[name];if(!spec)throw new Error('Missing synthetic evidence for '+name);
  const source={id:'fixture-'+i+'.gan.source',pillar:'month',layer:'gan',wx:spec[1],shiShen:spec[3],weight:1};
  const target={id:'fixture-'+i+'.gan.target',pillar:'day',layer:'gan',wx:spec[2],shiShen:spec[4],weight:1};
  const edge={id:'fixture-edge-'+i,type:spec[5],strength:1,from:source.id,to:target.id,fromNode:source,toNode:target,evidence:'合成有效作用边'};
  nodes.push(source,target);edges.push(edge);favorable.add(target.wx);if(name!=='财破印')unfavorable.add(source.wx);
  mechanisms.push({id:'fixture-mechanism-'+i,name:spec[0],sourceWx:source.wx,targetWx:target.wx,sourceShiShen:source.shiShen,targetShiShen:target.shiShen,
   sourcePillar:source.pillar,targetPillar:target.pillar,sourceNodeId:source.id,targetNodeId:target.id,nodeIds:[source.id,target.id],edgeIds:[edge.id],actionStage:'effective',dominanceScore:2,evidence:[edge.evidence]});
  triggers.push({id:'fixture-year-'+i,source:'流年',type:'天干生',relation:'生',targetLayer:'stem',targetNodeId:source.id,fromNodeId:'annual.gan',toNodeId:source.id,detail:'合成当年实际生扶该机制源头'});
 }
 return {triggers,reportLifeContext:life,reportMechanismContext:{chain:{mechanisms,fullMechanisms:mechanisms,paths:[],factGraph:{nodes,edges}},yongJi:{xiShen:[...favorable],jiShen:[...unfavorable]}}};
};
