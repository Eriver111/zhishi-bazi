(function (global) {
  'use strict';

  var A4_HEIGHT_MM = 297;
  var MARGIN_MM = 10;
  var CONTENT_WIDTH_MM = 190;
  var CONTENT_HEIGHT_MM = A4_HEIGHT_MM - (MARGIN_MM * 2);
  var DEFAULT_FILENAME = '知时命理报告.pdf';
  var PDF_TYPE = 'application/pdf';
  var JPEG_QUALITY = 0.85;
  var JPEG_COMPRESSION = 'NONE';
  var MAX_RENDER_SCALE = 1.35;
  var MAX_CANVAS_SIDE = 8192;
  var MAX_CANVAS_PIXELS = 12000000;
  var FRAME_LOAD_TIMEOUT_MS = 15000;
  var FONT_LOAD_TIMEOUT_MS = 8000;
  var BLOCK_RENDER_TIMEOUT_MS = 45000;

  function removeNode(node) {
    if (!node) return;
    if (typeof node.remove === 'function') {
      node.remove();
    } else if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
  }

  function waitForIframe(iframe, html) {
    return new Promise(function (resolve, reject) {
      iframe.addEventListener('load', resolve, { once: true });
      iframe.addEventListener('error', function () {
        reject(new Error('报告页面加载失败'));
      }, { once: true });
      iframe.srcdoc = html;
    });
  }

  function createAbortError(signal) {
    var reason = signal && signal.reason;
    var error;
    if (reason && reason.name === 'AbortError') return reason;
    error = new Error('PDF 生成已取消');
    error.name = 'AbortError';
    return error;
  }

  function throwIfAborted(signal) {
    if (signal && signal.aborted) throw createAbortError(signal);
  }

  function waitForAbortable(promise, signal) {
    if (!signal) return Promise.resolve(promise);
    var guardedPromise = Promise.resolve(promise);
    if (signal.aborted) {
      // 先接住底层异步任务可能稍后产生的拒绝，再返回取消结果。
      guardedPromise.catch(function () {});
      return Promise.reject(createAbortError(signal));
    }
    return new Promise(function (resolve, reject) {
      var settled = false;

      function cleanup() {
        signal.removeEventListener('abort', onAbort);
      }

      function onAbort() {
        if (settled) return;
        settled = true;
        cleanup();
        reject(createAbortError(signal));
      }

      signal.addEventListener('abort', onAbort, { once: true });
      guardedPromise.then(function (value) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      }, function (error) {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      });
    });
  }

  function createTimeoutError(label) {
    var error = new Error((label || '操作') + '超时');
    error.name = 'TimeoutError';
    return error;
  }

  function waitForStage(promise, signal, timeoutMs, label, windowRef) {
    var timerApi = windowRef && typeof windowRef.setTimeout === 'function'
      && typeof windowRef.clearTimeout === 'function'
      ? windowRef
      : global;
    var delay = Math.max(1, Number(timeoutMs) || 1);
    var timer;
    var timed = new Promise(function (resolve, reject) {
      timer = timerApi.setTimeout(function () {
        reject(createTimeoutError(label));
      }, delay);
      if (timer && typeof timer.unref === 'function') timer.unref();
    });

    return waitForAbortable(Promise.race([Promise.resolve(promise), timed]), signal)
      .finally(function () {
        timerApi.clearTimeout(timer);
      });
  }

  function isAbortError(error) {
    return !!(error && error.name === 'AbortError');
  }

  function reportStatus(options, message) {
    if (typeof options.onStatus === 'function') options.onStatus(message);
  }

  function resolveJsPdf(options, windowRef) {
    return options.JsPdfCtor
      || windowRef.jsPDF
      || (windowRef.jspdf && windowRef.jspdf.jsPDF);
  }

  function getRenderScale(block, windowRef) {
    var width = Math.max(1, Number(block && (block.scrollWidth || block.offsetWidth)) || 820);
    var height = Math.max(1, Number(block && (block.scrollHeight || block.offsetHeight)) || 1);
    var deviceScale = Math.max(1, Number(windowRef && windowRef.devicePixelRatio) || 1);
    var sideScale = Math.min(MAX_CANVAS_SIDE / width, MAX_CANVAS_SIDE / height);
    var pixelScale = Math.sqrt(MAX_CANVAS_PIXELS / (width * height));

    return Math.max(0.25, Math.min(MAX_RENDER_SCALE, deviceScale, sideScale, pixelScale));
  }

  function addPdfImage(pdf, canvas, height, state, signal) {
    var imageData;
    throwIfAborted(signal);
    imageData = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    try {
      throwIfAborted(signal);
      if (state.hasImage) pdf.addPage();
      throwIfAborted(signal);
      pdf.addImage(
        imageData,
        'JPEG',
        MARGIN_MM,
        MARGIN_MM,
        CONTENT_WIDTH_MM,
        height,
        undefined,
        JPEG_COMPRESSION,
      );
      state.hasImage = true;
      throwIfAborted(signal);
    } finally {
      imageData = null;
    }
  }

  function addCanvasToPdf(pdf, canvas, documentRef, state, signal) {
    var sourceWidth = canvas.width;
    var sourceHeight = canvas.height;
    var fullHeightMm;
    var maxSliceHeight;
    var sourceY;

    if (!sourceWidth || !sourceHeight) {
      throw new Error('报告区块尺寸无效');
    }

    fullHeightMm = sourceHeight * CONTENT_WIDTH_MM / sourceWidth;
    if (fullHeightMm <= CONTENT_HEIGHT_MM) {
      addPdfImage(pdf, canvas, fullHeightMm, state, signal);
      return;
    }

    maxSliceHeight = Math.max(1, Math.floor(CONTENT_HEIGHT_MM * sourceWidth / CONTENT_WIDTH_MM));
    sourceY = 0;

    while (sourceY < sourceHeight) {
      throwIfAborted(signal);
      var sliceHeight = Math.min(maxSliceHeight, sourceHeight - sourceY);
      var sliceCanvas = documentRef.createElement('canvas');
      var context;

      sliceCanvas.width = sourceWidth;
      sliceCanvas.height = sliceHeight;
      try {
        context = sliceCanvas.getContext('2d');
        if (!context) throw new Error('无法创建分页画布');
        context.drawImage(
          canvas,
          0,
          sourceY,
          sourceWidth,
          sliceHeight,
          0,
          0,
          sourceWidth,
          sliceHeight,
        );
        throwIfAborted(signal);
        addPdfImage(
          pdf,
          sliceCanvas,
          sliceHeight * CONTENT_WIDTH_MM / sourceWidth,
          state,
          signal,
        );
      } finally {
        sliceCanvas.width = 0;
        sliceCanvas.height = 0;
      }
      sourceY += sliceHeight;
      throwIfAborted(signal);
    }
  }

  async function prepare(options) {
    options = options || {};

    var windowRef = options.windowRef || global;
    var documentRef = options.documentRef || windowRef.document;
    var html2canvasImpl = options.html2canvasImpl || windowRef.html2canvas;
    var JsPdfCtor = resolveJsPdf(options, windowRef);
    var signal = options.signal;
    var iframe;

    try {
      throwIfAborted(signal);
      if (!documentRef || !documentRef.body) throw new Error('浏览器文档不可用');
      if (typeof html2canvasImpl !== 'function') throw new Error('html2canvas 不可用');
      if (typeof JsPdfCtor !== 'function') throw new Error('jsPDF 不可用');

      throwIfAborted(signal);
      iframe = documentRef.createElement('iframe');
      iframe.setAttribute('data-report-pdf', '');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.setAttribute('sandbox', 'allow-same-origin');
      iframe.style.position = 'fixed';
      // html2canvas 在部分移动内核中会裁掉放在巨大负坐标上的内容。
      // 将 iframe 留在正常坐标系并置于页面背后，可完整捕获横向表格。
      iframe.style.left = '0';
      iframe.style.top = '0';
      iframe.style.width = '1280px';
      iframe.style.height = '1px';
      iframe.style.opacity = '1';
      iframe.style.zIndex = '-2147483647';
      iframe.style.pointerEvents = 'none';
      iframe.style.border = '0';
      documentRef.body.appendChild(iframe);

      reportStatus(options, '正在载入报告内容……');
      await waitForStage(
        waitForIframe(iframe, options.html || ''),
        signal,
        options.frameLoadTimeoutMs || FRAME_LOAD_TIMEOUT_MS,
        '报告内容载入',
        windowRef,
      );
      throwIfAborted(signal);

      var frameDocument = iframe.contentDocument
        || (iframe.contentWindow && iframe.contentWindow.document);
      if (!frameDocument) throw new Error('无法读取报告页面');
      if (frameDocument.fonts && frameDocument.fonts.ready) {
        reportStatus(options, '正在准备报告字体……');
        try {
          await waitForStage(
            frameDocument.fonts.ready,
            signal,
            options.fontLoadTimeoutMs || FONT_LOAD_TIMEOUT_MS,
            '报告字体载入',
            windowRef,
          );
          if (typeof frameDocument.fonts.load === 'function') {
            await waitForStage(
              frameDocument.fonts.load('15px "Zhishi Report Serif"'),
              signal,
              options.fontLoadTimeoutMs || FONT_LOAD_TIMEOUT_MS,
              '报告字体载入',
              windowRef,
            );
          }
        } catch (fontError) {
          if (isAbortError(fontError)) throw fontError;
          // 字体服务异常时继续使用系统宋体，不能让整份报告永久卡住。
        }
      }
      throwIfAborted(signal);

      Array.prototype.forEach.call(
        frameDocument.querySelectorAll('.no-print'),
        removeNode,
      );

      var blocks = Array.prototype.slice.call(
        frameDocument.querySelectorAll('.cover, .section, .footer'),
      );
      if (!blocks.length) throw new Error('未找到可导出的报告内容');

      throwIfAborted(signal);
      var pdf = new JsPdfCtor({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });
      var state = { hasImage: false };
      for (var index = 0; index < blocks.length; index += 1) {
        throwIfAborted(signal);
        var block = blocks[index];
        var scale = getRenderScale(block, windowRef);
        reportStatus(options, '正在生成报告（' + (index + 1) + '/' + blocks.length + '）……');
        var renderPromise = Promise.resolve(html2canvasImpl(blocks[index], {
            useCORS: true,
            backgroundColor: '#0d0f18',
            scale: scale,
            windowWidth: Math.max(820, block.scrollWidth || block.offsetWidth || 820),
            scrollX: 0,
            scrollY: 0,
          }));
        var canvas;
        try {
          canvas = await waitForStage(
            renderPromise,
            signal,
            options.blockRenderTimeoutMs || BLOCK_RENDER_TIMEOUT_MS,
            '第 ' + (index + 1) + ' 个报告区块生成',
            windowRef,
          );
        } catch (renderError) {
          // html2canvas 本身不支持取消。若它在超时/取消后才返回，仍及时释放画布。
          renderPromise.then(function (lateCanvas) {
            if (lateCanvas) {
              lateCanvas.width = 0;
              lateCanvas.height = 0;
            }
          }, function () {});
          throw renderError;
        }

        try {
          throwIfAborted(signal);
          addCanvasToPdf(pdf, canvas, documentRef, state, signal);
          throwIfAborted(signal);
        } finally {
          canvas.width = 0;
          canvas.height = 0;
        }

        throwIfAborted(signal);
        if (typeof options.onProgress === 'function') {
          options.onProgress(Math.round(((index + 1) / blocks.length) * 100));
        }
      }

      throwIfAborted(signal);
      var blob = pdf.output('blob');
      throwIfAborted(signal);
      var filename = options.filename || DEFAULT_FILENAME;
      var FileCtor = windowRef.File || global.File;
      if (typeof FileCtor === 'function') {
        return new FileCtor([blob], filename, { type: PDF_TYPE });
      }
      return blob;
    } catch (error) {
      if (signal && signal.aborted) throw createAbortError(signal);
      if (error && error.name === 'AbortError') throw error;
      throw new Error('PDF 生成失败：' + (error && error.message ? error.message : String(error)));
    } finally {
      removeNode(iframe);
    }
  }

  function download(file, filename) {
    var documentRef = global.document;
    var urlApi = global.URL;
    if (global.navigator && typeof global.navigator.msSaveOrOpenBlob === 'function') {
      global.navigator.msSaveOrOpenBlob(file, filename || DEFAULT_FILENAME);
      return 'native';
    }
    var objectUrl = urlApi.createObjectURL(file);
    var anchor;

    try {
      anchor = documentRef.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename || DEFAULT_FILENAME;
      anchor.target = '_blank';
      anchor.rel = 'noopener';
      documentRef.body.appendChild(anchor);
      anchor.click();
    } finally {
      removeNode(anchor);
      global.setTimeout(function () {
        urlApi.revokeObjectURL(objectUrl);
      }, 300000);
    }
    return 'download';
  }

  var ReportPdf = {
    prepare: prepare,
    download: download,
  };

  global.ReportPdf = ReportPdf;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportPdf;
  }
}(typeof window !== 'undefined' ? window : globalThis));
