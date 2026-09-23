(function () {
  'use strict';
  if (window.ZhishiTouchSheet) return;
  var active=null, pending=null, serial=0, media=window.matchMedia('(max-width:700px)');
  function finish() { if(pending){var done=pending;pending=null;done();} }
  function destroy(reason) {
    if(!active)return;
    var current=active;active=null;
    window.removeEventListener('resize',current.resize);
    if(window.visualViewport){visualViewport.removeEventListener('resize',current.resize);visualViewport.removeEventListener('scroll',current.resize);}
    current.dialog.close();current.dialog.remove();document.body.style.overflow=current.overflow;
    if(current.opener&&current.opener.isConnected)current.opener.focus({preventScroll:true});
    if(current.onClose)current.onClose(reason);
  }
  function close(reason) {
    if(!active)return Promise.resolve();
    var id=active.id,owns=history.state&&history.state.zhishiTouchSheet===id;
    destroy(reason||'cancel');
    if(!owns)return Promise.resolve();
    return new Promise(function(resolve){pending=resolve;try{history.back();}catch(_){finish();}});
  }
  window.addEventListener('popstate',function(){
    if(active&&(!history.state||history.state.zhishiTouchSheet!==active.id))destroy('back');
    finish();
  });
  function open(options) {
    if(active||pending||!media.matches||!window.HTMLDialogElement)return null;
    options=options||{};
    var opener=options.opener||document.activeElement,id='sheet-'+Date.now()+'-'+(++serial);
    var dialog=document.createElement('dialog');dialog.className='touch-sheet';dialog.setAttribute('aria-labelledby',id+'-title');
    var panel=document.createElement('section');panel.className='touch-sheet__panel';
    var head=document.createElement('header');head.className='touch-sheet__head';
    var title=document.createElement('h2');title.id=id+'-title';title.textContent=options.title||'请选择';
    var cancel=document.createElement('button');cancel.type='button';cancel.className='touch-sheet__cancel';cancel.textContent='取消';
    head.append(title,cancel);var body=document.createElement('div');body.className='touch-sheet__body';
    var footer=document.createElement('footer');footer.className='touch-sheet__footer';panel.append(head,body,footer);dialog.append(panel);document.body.append(dialog);
    function resize(){if(window.visualViewport){dialog.style.height=visualViewport.height+'px';dialog.style.top=visualViewport.offsetTop+'px';}}
    active={id:id,dialog:dialog,opener:opener,overflow:document.body.style.overflow,resize:resize,onClose:options.onClose};
    document.body.style.overflow='hidden';
    cancel.onclick=function(){close('cancel');};
    dialog.addEventListener('cancel',function(e){e.preventDefault();close('cancel');});
    dialog.addEventListener('click',function(e){if(e.target===dialog)close('cancel');});
    // The extra history entry makes browser/Android Back dismiss the panel first.
    try{history.pushState(Object.assign({},history.state,{zhishiTouchSheet:id}),'',location.href);}catch(_){}
    window.addEventListener('resize',resize);
    if(window.visualViewport){visualViewport.addEventListener('resize',resize);visualViewport.addEventListener('scroll',resize);}
    resize();dialog.showModal();
    return {body:body,footer:footer,dialog:dialog,close:close};
  }
  function widthChange(){if(!media.matches)close('resize');}
  if(media.addEventListener)media.addEventListener('change',widthChange);else media.addListener(widthChange);
  window.addEventListener('pagehide',function(){destroy('pagehide');finish();});
  window.ZhishiTouchSheet={open:open,close:close,isOpen:function(){return !!active;}};
})();
