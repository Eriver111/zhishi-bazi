'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
function createHarness(respond) {
  const payloads = [], counters = { charged:0, saved:0 };
  const safe = Object.fromEntries(['ziwei-context','hepan-reply-scopes','ai-conversation-evidence',
    'ai-chart-evidence','ai-annual-mechanisms','ai-requested-year'].map(name =>
    ['../lib/' + name + '.js', require('../../lib/' + name)]));
  const scope = {
    module:{exports:{}}, process:{env:{AI_API_KEY:'isolated-placeholder',AI_API_URL:'https://model.invalid/test',AI_MODEL:'deepseek-v4-flash'}},
    console:{log(){},warn(){},error(){}}, setTimeout,clearTimeout,AbortController,
    require(name) {
      if (Object.hasOwn(safe,name)) return safe[name];
      if (name === 'crypto') return require('node:crypto');
      if (name === '../lib/auth.js') return {requireAuth:()=>({uid:'test-only'})};
      if (name === '../lib/ai-abuse-guard.js') return {beginAiRequest:()=>({ok:true,release(){}})};
      if (name === '../lib/supabase.js') return {
        trackFreeUsageByUser:async()=>({used:0}),
        bumpFreeUsageByUser:async()=>{counters.charged++;},
        saveUserChatHistory:async(_id,role)=>{if(role==='assistant')counters.saved++;}
      };
      throw Error('Unexpected dependency ' + name);
    },
    fetch:async(url,options)=>{
      if(url!=='https://model.invalid/test')throw Error('Unexpected outbound URL');
      const payload=JSON.parse(options.body);payloads.push(payload);
      return respond(payload,payloads.length);
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../api/ai-chat.js'),'utf8'),scope,{timeout:5000});
  return {api:scope.module.exports._test,callAI:scope.callAI,payloads,counters,
    async request(question,chartData){
      const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return body;}};
      await scope.module.exports({method:'POST',headers:{},body:{question,chartData,mode:'simple',free_mode:true,free_id:'test-only'}},res);
      return res;
    }};
}
function response(text) { return {ok:true,status:200,json:async()=>({model:'isolated-fixture',choices:[{message:{content:text}}]})}; }
module.exports={createHarness,response};
