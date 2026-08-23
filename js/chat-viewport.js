(function (root, factory) {
  var api = factory(root);
  root.ChatViewport = api;
  if (typeof document !== 'undefined') {
    var start = function () {
      api.init({
        root: document.documentElement,
        scrollTarget: document.getElementById('messages')
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
    else start();
  }
})(typeof window !== 'undefined' ? window : this, function (root) {
  function init(options) {
    options = options || {};
    var docRoot = options.root || (root.document && root.document.documentElement);
    var scrollTarget = options.scrollTarget || (root.document && root.document.getElementById('messages'));
    var viewport = root.visualViewport;
    var framePending = false;
    var stickToBottom = true;

    function isNearBottom() {
      if (!scrollTarget) return false;
      return scrollTarget.scrollHeight - scrollTarget.scrollTop - scrollTarget.clientHeight < 72;
    }

    function applyViewport() {
      framePending = false;
      var height = viewport && viewport.height ? viewport.height : root.innerHeight;
      var top = viewport && typeof viewport.offsetTop === 'number' ? viewport.offsetTop : 0;
      if (docRoot && docRoot.style && height) {
        docRoot.style.setProperty('--chat-viewport-height', Math.round(height) + 'px');
        docRoot.style.setProperty('--chat-viewport-top', Math.max(0, Math.round(top)) + 'px');
      }
      if (scrollTarget && stickToBottom) scrollTarget.scrollTop = scrollTarget.scrollHeight;
    }

    function schedule() {
      if (framePending) return;
      stickToBottom = isNearBottom();
      framePending = true;
      (root.requestAnimationFrame || function (fn) { return setTimeout(fn, 0); })(applyViewport);
    }

    function settleViewport() {
      stickToBottom = isNearBottom();
      schedule();
      setTimeout(schedule, 80);
      setTimeout(schedule, 240);
    }

    applyViewport();
    if (viewport) {
      viewport.addEventListener('resize', schedule);
      viewport.addEventListener('scroll', schedule);
    }
    root.addEventListener('resize', schedule);
    root.addEventListener('orientationchange', schedule);
    if (root.document && root.document.addEventListener) {
      root.document.addEventListener('focusin', settleViewport);
      root.document.addEventListener('focusout', settleViewport);
    }

    return function cleanup() {
      if (viewport) {
        viewport.removeEventListener('resize', schedule);
        viewport.removeEventListener('scroll', schedule);
      }
      root.removeEventListener('resize', schedule);
      root.removeEventListener('orientationchange', schedule);
      if (root.document && root.document.removeEventListener) {
        root.document.removeEventListener('focusin', settleViewport);
        root.document.removeEventListener('focusout', settleViewport);
      }
    };
  }

  return { init:init };
});
