(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DeepReport = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var SCHEMA_VERSION = '2.0.0';

  function buildFacts(bazi, gender, options) {
    options = options || {};
    var host = typeof window !== 'undefined' ? window : globalThis;
    var deps = options.deps || {
      calculator: host.BaZiCalculator,
      structural: host.StructuralAnalysis,
      chain: host.BaZiChain,
    };
    if (!bazi || !deps.calculator) throw new Error('深度报告缺少有效命盘或计算器');

    var professional = deps.calculator.getProfessionalReportFacts(bazi, gender);
    var structural = deps.structural
      ? deps.structural.evaluate(bazi, deps.calculator)
      : { relationEvents: [], structuralRisks: [] };
    var chain = deps.chain
      ? deps.chain.analyze(bazi)
      : { adjustments: [], hints: [], ganChain: [], zhiChain: [] };
    var core = Object.freeze({
      strength: professional.strength,
      pattern: professional.pattern,
      yongJi: professional.yongJi,
      congGe: !!(professional.pattern && professional.pattern.congGe),
      actionChains: professional.actionChains || [],
      relationEvents: structural.relationEvents || [],
      structuralRisks: structural.structuralRisks || [],
      chain: chain,
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      anchorYear: Number(options.anchorYear),
      chartIdentity: [bazi.year, bazi.month, bazi.day, bazi.hour]
        .map(function (pillar) { return pillar.gan + pillar.zhi; })
        .join(' '),
      core: core,
      wealth: null,
      relationship: null,
      study: null,
      currentYear: null,
      fiveYear: null,
    };
  }

  return { SCHEMA_VERSION: SCHEMA_VERSION, buildFacts: buildFacts };
}));
