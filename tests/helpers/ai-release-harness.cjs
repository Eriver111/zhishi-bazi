'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
function createHarness(respond, options = {}) {
  const payloads = [], counters = { charged:0, saved:0 };
  const events = [], savedMessages = [];
  async function saveHistory(_id, role, content) {
    events.push('save-' + role); savedMessages.push({role, content});
    if (role === 'assistant') counters.saved++;
  }
  async function charge() { events.push('charge'); counters.charged++; return {credits:9,remaining:1}; }
  const safe = Object.fromEntries(['ziwei-context','hepan-reply-scopes','ai-conversation-evidence',
    'ai-chart-evidence','ai-annual-mechanisms','ai-requested-year'].map(name =>
    ['../lib/' + name + '.js', require('../../lib/' + name)]));
  const scope = {
    module:{exports:{}}, process:{env:{AI_API_KEY:'isolated-placeholder',AI_API_URL:'https://model.invalid/test',AI_MODEL:'deepseek-v4-flash'}},
    console:{log(){},warn(){},error(){}}, setTimeout,clearTimeout,AbortController,
    require(name) {
      if (Object.hasOwn(safe,name)) return safe[name];
      if (name === 'crypto') return require('node:crypto');
      if (name === '../lib/auth.js') return {requireAuth:()=>options.anonymous ? null : ({uid:'test-only'}),getClientIp:()=> '192.0.2.1'};
      if (name === '../lib/ai-abuse-guard.js') return {beginAiRequest:()=>{
        events.push('guard-begin');
        return options.guardBlocked ? {ok:false,reason:'concurrent'} : {ok:true,release(){events.push('guard-release');}};
      }};
      if (name === '../lib/supabase.js') return {
        trackFreeUsageByUser:async()=>({used:options.freeUsed || 0}),
        getFreeUsage:async()=>({used:options.freeUsed || 0}),
        getUserCredits:async()=>options.credits === undefined ? 10 : options.credits,
        getCreditsByCode:async()=>({credits:options.credits === undefined ? 10 : options.credits}),
        isMonthlyActive:async()=>options.monthly ? {expires_at:'2099-01-01'} : null,
        isMonthlyActiveByUserId:async()=>options.monthly ? {expires_at:'2099-01-01'} : null,
        bumpFreeUsageByUser:charge, trackFreeUsage:charge, deductCreditByUser:charge, deductCredit:charge,
        saveUserChatHistory:saveHistory, saveChatHistory:saveHistory
      };
      throw Error('Unexpected dependency ' + name);
    },
    fetch:async(url,options)=>{
      if(url!=='https://model.invalid/test')throw Error('Unexpected outbound URL');
      const payload=JSON.parse(options.body);payloads.push(payload);
      events.push('model-' + payloads.length);
      return respond(payload,payloads.length);
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../api/ai-chat.js'),'utf8'),scope,{timeout:5000});
  return {api:scope.module.exports._test,callAI:scope.callAI,callAIWithValidationRetry:scope.callAIWithValidationRetry,payloads,counters,events,savedMessages,
    async request(question,chartData,bodyOverrides = {}){
      const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return body;}};
      await scope.module.exports({method:'POST',headers:{},body:{question,chartData,mode:'simple',free_mode:true,free_id:'test-only',...bodyOverrides}},res);
      return res;
    }};
}
function response(text) { return {ok:true,status:200,json:async()=>({model:'isolated-fixture',choices:[{message:{content:text}}]})}; }
module.exports={createHarness,response};
