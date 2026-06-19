/**
 * 水墨星河 — Canvas 四层动态背景
 * 底层：墨色柔光云雾缓慢流动
 * 二层：细密星辰光点闪烁
 * 三层：极淡墨迹纹理偶尔飘过
 * 四层：八字/神煞术语全屏渐入渐出流动
 * 用法：MoXingHe.start('mxhCanvas');
 */
var MoXingHe = (function(){
  var canvas, ctx, w, h, raf, running=false;
  var clouds=[], stars=[], inkStrokes=[], floatingTexts=[];
  var pointer={x:0.5,y:0.5,tx:0.5,ty:0.5};

  // 流动术语池
  var TERMS=[
    '甲','乙','丙','丁','戊','己','庚','辛','壬','癸',
    '子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥',
    '正官','七杀','正印','偏印','比肩','劫财','食神','伤官','正财','偏财',
    '青龙','白虎','朱雀','玄武','勾陈','腾蛇',
    '长生','沐浴','冠带','临官','帝旺','衰','病','死','墓','绝','胎','养',
    '天乙贵人','文昌','驿马','桃花','羊刃','空亡','华盖','太极贵人','福星','禄神','天罗','地网',
    '紫微','天府','天机','太阳','武曲','天同','廉贞','破军','贪狼','巨门','天相','天梁','七杀',
    '纳音','五行','四柱','大运','流年','节气','岁运','命宫',
    '甲子','乙丑','丙寅','丁卯','戊辰','己巳','庚午','辛未','壬申','癸酉',
    '金','木','水','火','土',
    '立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至',
    '滴天髓','三命通会','子平真诠','穷通宝鉴','渊海子平'
  ];

  function randTerm(){return TERMS[Math.floor(Math.random()*TERMS.length)];}

  // === 流动文字粒子 ===
  function FloatingText(){
    this.reset();
    this.alpha=0;
    this.phase=Math.random()*15; // 初始随机相位
  }
  FloatingText.prototype.reset=function(){
    this.text=randTerm();
    this.x=(Math.random()-0.2)*1.4;
    this.y=(Math.random()-0.1)*1.2;
    this.vx=(Math.random()-0.5)*0.00012;
    this.vy=(Math.random()-0.5)*0.00008;
    this.fontSize=12+Math.floor(Math.random()*12); // 12-24px
    this.life=12+Math.random()*18; // 12-30秒生命
    this.age=0;
    this.fading='in';
  };
  FloatingText.prototype.update=function(dt){
    this.x+=this.vx; this.y+=this.vy;
    if(this.x<-0.3)this.x=1.3; if(this.x>1.3)this.x=-0.3;
    if(this.y<-0.2)this.y=1.2; if(this.y>1.2)this.y=-0.2;
    this.age+=dt;
    if(this.age>this.life){this.reset();this.age=0;}
    var p=this.age/this.life;
    if(p<0.15)this.alpha=p/0.15*0.08; // 渐入
    else if(p>0.75)this.alpha=(1-p)/0.25*0.08; // 渐出
    else this.alpha=0.08; // 保持
  };
  FloatingText.prototype.draw=function(){
    ctx.save();
    ctx.globalAlpha=this.alpha;
    ctx.font='normal '+this.fontSize+'px "Source Han Serif SC","STKaiti","KaiTi","FangSong",serif';
    ctx.fillStyle='#dac878';ctx.shadowColor='rgba(218,200,120,.06)';ctx.shadowBlur=2;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(this.text,this.x*w,this.y*h);
    ctx.restore();
  };

  // === 墨色云雾 ===
  function Cloud(){
    this.x=Math.random()*1.5-0.25; this.y=Math.random()*1.2-0.1;
    this.r=0.18+Math.random()*0.35;
    this.vx=(Math.random()-0.5)*0.00015; this.vy=(Math.random()-0.5)*0.00010;
    this.color=Math.random()<0.4?'gold':'ink';
    this.colorAlpha=this.color==='gold'?0.03:0.025;
  }
  Cloud.prototype.update=function(){
    this.x+=this.vx; this.y+=this.vy;
    if(this.x<-0.5)this.x=1.5; if(this.x>1.5)this.x=-0.5;
    if(this.y<-0.3)this.y=1.3; if(this.y>1.3)this.y=-0.3;
  };
  Cloud.prototype.draw=function(){
    var cx=this.x*w,cy=this.y*h,r=this.r*Math.min(w,h);
    var g=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
    if(this.color==='gold'){g.addColorStop(0,'rgba(201,168,76,'+this.colorAlpha+')');g.addColorStop(1,'rgba(201,168,76,0)');}
    else{g.addColorStop(0,'rgba(140,130,110,'+this.colorAlpha+')');g.addColorStop(1,'rgba(140,130,110,0)');}
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
  };

  // === 星辰 ===
  function Star(){
    this.reset(); this.phase=Math.random()*Math.PI*2; this.speed=0.003+Math.random()*0.012;
  }
  Star.prototype.reset=function(){this.x=Math.random();this.y=Math.random();};
  Star.prototype.update=function(){this.phase+=this.speed;};
  Star.prototype.draw=function(){
    var alpha=0.15+0.25*Math.abs(Math.sin(this.phase)),sz=1+Math.sin(this.phase*2.3)*0.6;
    ctx.fillStyle='rgba(220,200,150,'+alpha+')';ctx.beginPath();ctx.arc(this.x*w,this.y*h,sz,0,Math.PI*2);ctx.fill();
  };

  // === 墨迹 ===
  function InkStroke(){this.reset();}
  InkStroke.prototype.reset=function(){
    this.x=-0.15;this.y=Math.random()*0.7+0.15;this.len=0.08+Math.random()*0.18;
    this.alpha=0.008+Math.random()*0.018;this.speed=0.00025+Math.random()*0.0004;this.rot=Math.random()*0.3-0.15;
  };
  InkStroke.prototype.update=function(){this.x+=this.speed;if(this.x>1.2)this.reset();};
  InkStroke.prototype.draw=function(){
    ctx.save();ctx.translate(this.x*w,this.y*h);ctx.rotate(this.rot);
    ctx.lineWidth=2+Math.random()*3;ctx.strokeStyle='rgba(180,170,150,'+this.alpha+')';
    ctx.beginPath();ctx.moveTo(0,0);
    ctx.quadraticCurveTo(this.len*w*0.5,(Math.random()-0.5)*30,this.len*w,(Math.random()-0.5)*20);
    ctx.stroke();ctx.restore();
  };

  // === 主循环 ===
  var lastT=0;
  function resize(){if(!canvas)return;w=canvas.offsetWidth;h=canvas.offsetHeight;canvas.width=w;canvas.height=h;}
  function loop(t){
    if(!running)return;
    var dt=lastT?(t-lastT)/1000:0.03; lastT=t;
    pointer.x+=(pointer.tx-pointer.x)*0.02; pointer.y+=(pointer.ty-pointer.y)*0.02;

    ctx.clearRect(0,0,w,h);

    // 底层
    var g0=ctx.createRadialGradient(w*0.5,h*0.35,0,w*0.5,h*0.35,Math.max(w,h));
    g0.addColorStop(0,'rgba(15,12,8,0.0)');g0.addColorStop(0.45,'rgba(15,12,8,0.55)');g0.addColorStop(1,'rgba(6,4,2,0.97)');
    ctx.fillStyle=g0;ctx.fillRect(0,0,w,h);

    for(var i=0;i<clouds.length;i++){clouds[i].update();clouds[i].draw();}
    for(var i=0;i<stars.length;i++){stars[i].update();stars[i].draw();}
    for(var i=0;i<inkStrokes.length;i++){inkStrokes[i].update();inkStrokes[i].draw();}

    // 流动文字层
    for(var i=0;i<floatingTexts.length;i++){floatingTexts[i].update(dt);floatingTexts[i].draw();}

    // 视差金纹
    ctx.save();var px=(pointer.x-0.5)*16,py=(pointer.y-0.5)*12;ctx.translate(px,py);
    var gr=ctx.createLinearGradient(0,h*0.15,w*0.6,h*0.25);
    gr.addColorStop(0,'rgba(201,168,76,0)');gr.addColorStop(0.5,'rgba(201,168,76,'+(0.005+Math.sin(t*0.0003)*0.003)+')');gr.addColorStop(1,'rgba(201,168,76,0)');
    ctx.fillStyle=gr;ctx.fillRect(w*0.2,h*0.15,w*0.6,h*0.08);ctx.restore();

    raf=requestAnimationFrame(loop);
  }

  function init(canvasId, showTexts){
    showTexts = showTexts !== false; // 默认 true，只传 false 才关闭
    canvas=document.getElementById(canvasId);if(!canvas)return;
    ctx=canvas.getContext('2d');resize();window.addEventListener('resize',resize);
    clouds=[];stars=[];inkStrokes=[];floatingTexts=[];
    for(var i=0;i<8;i++)clouds.push(new Cloud());
    for(var i=0;i<120;i++)stars.push(new Star());
    for(var i=0;i<4;i++)inkStrokes.push(new InkStroke());
    if(showTexts) for(var i=0;i<18;i++)floatingTexts.push(new FloatingText());
    document.addEventListener('mousemove',function(e){pointer.tx=e.clientX/w;pointer.ty=e.clientY/h;});
    document.addEventListener('touchmove',function(e){pointer.tx=e.touches[0].clientX/w;pointer.ty=e.touches[0].clientY/h;},{passive:true});
    running=true;requestAnimationFrame(loop);
  }
  function stop(){running=false;if(raf)cancelAnimationFrame(raf);}
  return {start:init,stop:stop};
})();