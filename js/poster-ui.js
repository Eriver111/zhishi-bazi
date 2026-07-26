(function (global) {
  'use strict';

  var MANIFEST_URL = '/images/posters/manifest.json';
  var model = null;
  var configuredGender = 'male';
  var ready = false;
  var isOpen = false;
  var renderPromise = null;
  var downloadPromise = null;
  var manifest = null;
  var manifestPromise = null;
  var listenersBound = false;
  var opener = null;
  var previousBodyOverflow = '';
  var failedAction = 'render';
  var configurationVersion = 0;
  var renderVersion = -1;

  function element(id) {
    return global.document && global.document.getElementById(id);
  }

  function errorMessage(code) {
    var messages = {
      NOT_CONFIGURED: '命盘数据尚未准备好，请稍后重试。',
      MANIFEST_LOAD_FAILED: '海报资源清单暂时无法加载，请重试。',
      MANIFEST_ENTRY_MISSING: '对应的命格背景暂未准备好，请重试。',
      BACKGROUND_LOAD_FAILED: '海报背景加载失败，请检查网络后重试。',
      FONT_LOAD_FAILED: '海报字体加载失败，请重试。',
      RENDER_FAILED: '海报生成失败，请重试。',
      EXPORT_FAILED: '图片保存失败，请重试。',
    };
    return messages[code] || '海报暂时无法生成，请重试。';
  }

  function clearError(status) {
    if (!status || !status.dataset) return;
    delete status.dataset.error;
  }

  function setLoading() {
    var canvas = element('posterCanvas');
    var status = element('posterStatus');
    var download = element('posterDownload');
    var retry = element('posterRetry');
    if (canvas) canvas.hidden = true;
    if (status) {
      clearError(status);
      status.hidden = false;
      status.textContent = '正在生成你的命格海报…';
    }
    if (download) {
      download.hidden = true;
      download.disabled = false;
    }
    if (retry) retry.hidden = true;
  }

  function setSuccess(message) {
    var canvas = element('posterCanvas');
    var status = element('posterStatus');
    var download = element('posterDownload');
    var retry = element('posterRetry');
    if (canvas) canvas.hidden = false;
    if (status) {
      clearError(status);
      status.hidden = false;
      status.textContent = message || '海报已生成，可免费下载。';
    }
    if (download) {
      download.hidden = false;
      download.disabled = false;
    }
    if (retry) retry.hidden = true;
  }

  function setFailure(code, action) {
    var canvas = element('posterCanvas');
    var status = element('posterStatus');
    var download = element('posterDownload');
    var retry = element('posterRetry');
    failedAction = action || 'render';
    if (failedAction === 'render') {
      if (canvas) canvas.hidden = true;
      if (download) download.hidden = true;
    } else {
      if (canvas) canvas.hidden = false;
      if (download) {
        download.hidden = false;
        download.disabled = false;
      }
    }
    if (status) {
      status.hidden = false;
      status.textContent = errorMessage(code);
      status.dataset.error = code;
    }
    if (retry) retry.hidden = false;
  }

  function showModal() {
    var document = global.document;
    var modal = element('posterModal');
    var close = element('posterClose');
    if (!document || !modal) return false;
    if (!isOpen) {
      opener = document.activeElement || element('posterButton');
      previousBodyOverflow = document.body && document.body.style
        ? document.body.style.overflow
        : '';
    }
    isOpen = true;
    modal.hidden = false;
    modal.classList.add('is-open');
    if (document.body && document.body.style) document.body.style.overflow = 'hidden';
    if (close && typeof close.focus === 'function') close.focus();
    return true;
  }

  function close() {
    var document = global.document;
    var modal = element('posterModal');
    if (!isOpen) return;
    isOpen = false;
    if (modal) {
      modal.hidden = true;
      modal.classList.remove('is-open');
    }
    if (document && document.body && document.body.style) {
      document.body.style.overflow = previousBodyOverflow;
    }
    if (opener && typeof opener.focus === 'function') opener.focus();
    opener = null;
  }

  function entryList(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data.entries)) return data.entries;
    if (Array.isArray(data.posters)) return data.posters;
    if (Array.isArray(data.backgrounds)) return data.backgrounds;
    if (Array.isArray(data.assets)) return data.assets;
    return [];
  }

  function selectedSource(data, selectedModel, selectedGender) {
    var key = selectedModel && selectedModel.backgroundKey;
    var entries = entryList(data);
    var entry;
    var direct;
    var i;
    for (i = 0; i < entries.length; i += 1) {
      entry = entries[i];
      if (!entry || typeof entry !== 'object') continue;
      if (
        entry.key === key
        || entry.id === key
        || entry.backgroundKey === key
        || (entry.dayGan === selectedModel.dayGan && entry.gender === selectedGender)
      ) {
        return typeof entry.src === 'string' && entry.src ? entry.src : null;
      }
    }
    direct = data && data[key];
    if (typeof direct === 'string') return direct;
    if (direct && typeof direct.src === 'string') return direct.src;
    return null;
  }

  async function loadManifest() {
    var response;
    if (manifest) return manifest;
    if (manifestPromise) return manifestPromise;
    manifestPromise = Promise.resolve().then(async function () {
      if (typeof global.fetch !== 'function') throw new Error('MANIFEST_LOAD_FAILED');
      response = await global.fetch(MANIFEST_URL);
      if (!response || response.ok === false || typeof response.json !== 'function') {
        throw new Error('MANIFEST_LOAD_FAILED');
      }
      return response.json();
    }).then(function (data) {
      manifest = data;
      return data;
    }).catch(function () {
      manifestPromise = null;
      throw new Error('MANIFEST_LOAD_FAILED');
    });
    return manifestPromise;
  }

  async function renderPoster(selectedModel, selectedGender, version) {
    var data;
    var backgroundUrl;
    var result;
    try {
      data = await loadManifest();
      backgroundUrl = selectedSource(data, selectedModel, selectedGender);
      if (!backgroundUrl) {
        if (version === configurationVersion) setFailure('MANIFEST_ENTRY_MISSING', 'render');
        return { ok: false, error: 'MANIFEST_ENTRY_MISSING' };
      }
      if (!global.PosterRenderer || typeof global.PosterRenderer.render !== 'function') {
        if (version === configurationVersion) setFailure('RENDER_FAILED', 'render');
        return { ok: false, error: 'RENDER_FAILED' };
      }
      result = await global.PosterRenderer.render({
        canvas: element('posterCanvas'),
        model: selectedModel,
        backgroundUrl: backgroundUrl,
      });
      if (!result || !result.ok) {
        if (version === configurationVersion) {
          setFailure((result && result.error) || 'RENDER_FAILED', 'render');
        }
        return result || { ok: false, error: 'RENDER_FAILED' };
      }
      if (version === configurationVersion) {
        ready = true;
        setSuccess();
      }
      return result;
    } catch (error) {
      if (version === configurationVersion) {
        setFailure(error && error.message === 'MANIFEST_LOAD_FAILED'
          ? 'MANIFEST_LOAD_FAILED'
          : 'RENDER_FAILED', 'render');
      }
      return {
        ok: false,
        error: error && error.message === 'MANIFEST_LOAD_FAILED'
          ? 'MANIFEST_LOAD_FAILED'
          : 'RENDER_FAILED',
      };
    } finally {
      renderPromise = null;
    }
  }

  function open() {
    bindListeners();
    if (!showModal()) return Promise.resolve({ ok: false, error: 'RENDER_FAILED' });
    if (!model) {
      setFailure('NOT_CONFIGURED', 'render');
      return Promise.resolve({ ok: false, error: 'NOT_CONFIGURED' });
    }
    if (ready) {
      setSuccess();
      return Promise.resolve({ ok: true });
    }
    if (renderPromise) {
      if (renderVersion !== configurationVersion) {
        return renderPromise.then(function () { return open(); });
      }
      return renderPromise;
    }
    setLoading();
    renderVersion = configurationVersion;
    renderPromise = renderPoster(model, configuredGender, configurationVersion);
    return renderPromise;
  }

  function configure(input) {
    var data = input || {};
    configurationVersion += 1;
    ready = false;
    downloadPromise = null;
    configuredGender = data.gender === 'female' ? 'female' : 'male';
    try {
      model = global.BaZiPosterTemplates
        && typeof global.BaZiPosterTemplates.resolve === 'function'
        ? global.BaZiPosterTemplates.resolve(data)
        : null;
    } catch (error) {
      model = null;
    }
  }

  async function download() {
    var button = element('posterDownload');
    var result;
    var version = configurationVersion;
    if (!ready || downloadPromise) return downloadPromise;
    if (!global.PosterRenderer || typeof global.PosterRenderer.download !== 'function') {
      setFailure('EXPORT_FAILED', 'download');
      return { ok: false, error: 'EXPORT_FAILED' };
    }
    if (button) button.disabled = true;
    try {
      downloadPromise = Promise.resolve(global.PosterRenderer.download({
        canvas: element('posterCanvas'),
        model: model,
      }));
      result = await downloadPromise;
      if (!result || !result.ok) {
        if (version === configurationVersion) {
          setFailure((result && result.error) || 'EXPORT_FAILED', 'download');
        }
        return result || { ok: false, error: 'EXPORT_FAILED' };
      }
      if (version === configurationVersion) setSuccess('图片已保存。');
      return result;
    } catch (error) {
      if (version === configurationVersion) setFailure('EXPORT_FAILED', 'download');
      return { ok: false, error: 'EXPORT_FAILED' };
    } finally {
      downloadPromise = null;
      if (button) button.disabled = false;
    }
  }

  function bindListeners() {
    var document = global.document;
    var modal;
    var closeButton;
    var retryButton;
    var downloadButton;
    if (listenersBound || !document) return;
    modal = element('posterModal');
    closeButton = element('posterClose');
    retryButton = element('posterRetry');
    downloadButton = element('posterDownload');
    if (!modal || !closeButton || !retryButton || !downloadButton) return;
    listenersBound = true;
    closeButton.addEventListener('click', close);
    retryButton.addEventListener('click', function () {
      if (failedAction === 'download') download();
      else {
        ready = false;
        open();
      }
    });
    downloadButton.addEventListener('click', download);
    modal.addEventListener('click', function (event) {
      if (event.target === modal) close();
    });
    document.addEventListener('keydown', function (event) {
      if (isOpen && event.key === 'Escape') {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        close();
      } else if (isOpen && event.key === 'Tab') {
        var controls = [closeButton, downloadButton, retryButton].filter(function (control) {
          return control && !control.hidden && !control.disabled;
        });
        var currentIndex;
        var nextIndex;
        if (!controls.length) return;
        currentIndex = controls.indexOf(document.activeElement);
        if (event.shiftKey) {
          nextIndex = currentIndex <= 0 ? controls.length - 1 : currentIndex - 1;
        } else {
          nextIndex = currentIndex < 0 || currentIndex === controls.length - 1 ? 0 : currentIndex + 1;
        }
        if (typeof event.preventDefault === 'function') event.preventDefault();
        if (typeof controls[nextIndex].focus === 'function') controls[nextIndex].focus();
      }
    });
  }

  global.PosterUI = {
    configure: configure,
    open: open,
  };
})(window);
