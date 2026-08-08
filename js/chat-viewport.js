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

    function applyViewport() {
      framePending = false;
      var height = viewport && viewport.height ? viewport.height : root.innerHeight;
      if (docRoot && docRoot.style && height) {
        docRoot.style.setProperty('--chat-viewport-height', Math.round(height) + 'px');
      }
      if (scrollTarget) scrollTarget.scrollTop = scrollTarget.scrollHeight;
    }

    function schedule() {
      if (framePending) return;
      framePending = true;
      (root.requestAnimationFrame || function (fn) { return setTimeout(fn, 0); })(applyViewport);
    }

    applyViewport();
    if (viewport) {
      viewport.addEventListener('resize', schedule);
      viewport.addEventListener('scroll', schedule);
    }
    root.addEventListener('resize', schedule);
    root.addEventListener('orientationchange', schedule);

    return function cleanup() {
      if (viewport) {
        viewport.removeEventListener('resize', schedule);
        viewport.removeEventListener('scroll', schedule);
      }
      root.removeEventListener('resize', schedule);
      root.removeEventListener('orientationchange', schedule);
    };
  }

  return { init:init };
});
