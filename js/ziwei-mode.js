window.switchZwMode=function(m){
  window._zwMode=m;
  document.querySelectorAll(".zw-mode-btn").forEach(function(b){b.classList.remove("active")});
  var ab=document.querySelector(".zw-mode-btn[onclick*='"+m+"']");if(ab)ab.classList.add("active");
  var ps=document.querySelectorAll(".palace");ps.forEach(function(p){p.classList.remove("hua-lu","hua-quan","hua-ke","hua-ji","hl","hl2")});
  document.getElementById("svgLines").innerHTML="";
  var zas=document.querySelectorAll(".za");zas.forEach(function(z){z.style.display=(m==="sanhe")?"":"none"});
  if(m==="sihua"&&window._sihuaCol){
    var hc={禄:"hua-lu",权:"hua-quan",科:"hua-ke",忌:"hua-ji"};
    window._sihuaCol.forEach(function(sh){ps.forEach(function(el){var pn=el.querySelector(".pname");if(pn&&pn.textContent===sh.palace)el.classList.add(hc[sh.hua])})});
    drawSiHuaLines();
  }else if(m==="feixing"){drawFeiXingLines();}
};

function drawSiHuaLines(){
  if(!window._sihuaCol||!window._sihuaCol.length)return;
  var svg=document.getElementById("svgLines"),gr=document.getElementById("zwGrid").getBoundingClientRect();
  var sm={};window._sihuaCol.forEach(function(sh){sm[sh.hua]=sh.zhi});
  function cpp(z){var el=document.querySelector('.palace[data-zhi="'+z+'"]');if(!el)return null;var r=el.getBoundingClientRect();return{x:r.left+r.width/2-gr.left,y:r.top+r.height/2-gr.top}}
  svg.setAttribute("viewBox","0 0 "+gr.width+" "+gr.height);svg.style.width=gr.width+"px";svg.style.height=gr.height+"px";
  var hc={禄:"#4CAF50",权:"#FF9800",科:"#2196F3",忌:"#F44336"};
  var ord=["禄","权","科","忌"];var html="";
  for(var i=0;i<ord.length;i++){
    var fz=sm[ord[i]],tz=sm[ord[(i+1)%4]],c=hc[ord[i]];
    if(fz&&tz){var fp=cpp(fz),tp=cpp(tz);
    if(fp&&tp)html+='<line x1="'+fp.x+'" y1="'+fp.y+'" x2="'+tp.x+'" y2="'+tp.y+'" style="stroke:'+c+';stroke-width:2;stroke-dasharray:6 3"/>';}
  }
  svg.innerHTML=html;
}

function drawFeiXingLines(){
  var svg=document.getElementById("svgLines"),gr=document.getElementById("zwGrid").getBoundingClientRect();
  var DZ2=["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
  var tr={0:[0,4,8],1:[1,5,9],2:[2,6,10],3:[3,7,11]};
  function cpp(z){var el=document.querySelector('.palace[data-zhi="'+z+'"]');if(!el)return null;var r=el.getBoundingClientRect();return{x:r.left+r.width/2-gr.left,y:r.top+r.height/2-gr.top}}
  svg.setAttribute("viewBox","0 0 "+gr.width+" "+gr.height);svg.style.width=gr.width+"px";svg.style.height=gr.height+"px";
  var html="";
  for(var i=0;i<12;i++){
    var zhi=DZ2[i];var fp=cpp(zhi);if(!fp)continue;
    var tri=tr[i%4];
    tri.forEach(function(t){if(t===i)return;var tp=cpp(DZ2[t]);if(tp)html+='<line x1="'+fp.x+'" y1="'+fp.y+'" x2="'+tp.x+'" y2="'+tp.y+'" style="stroke:rgba(201,168,76,.15);stroke-width:1"/>';});
    var opp=(i+6)%12;var op=cpp(DZ2[opp]);
    if(op)html+='<line x1="'+fp.x+'" y1="'+fp.y+'" x2="'+op.x+'" y2="'+op.y+'" style="stroke:rgba(91,159,212,.12);stroke-width:1"/>';
  }
  svg.innerHTML=html;
}
