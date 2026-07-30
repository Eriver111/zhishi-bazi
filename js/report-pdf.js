(function (global) {
  'use strict';

  var A4_HEIGHT_MM = 297;
  var MARGIN_MM = 10;
  var CONTENT_WIDTH_MM = 190;
  var CONTENT_HEIGHT_MM = A4_HEIGHT_MM - (MARGIN_MM * 2);
  var DEFAULT_FILENAME = '知时命理报告.pdf';
  var PDF_TYPE = 'application/pdf';

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

  function resolveJsPdf(options, windowRef) {
    return options.JsPdfCtor
      || windowRef.jsPDF
      || (windowRef.jspdf && windowRef.jspdf.jsPDF);
  }

  function addPdfImage(pdf, image, height, state) {
    if (state.hasImage) pdf.addPage();
    pdf.addImage(image, 'PNG', MARGIN_MM, MARGIN_MM, CONTENT_WIDTH_MM, height);
    state.hasImage = true;
  }

  function addCanvasToPdf(pdf, canvas, documentRef, state) {
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
      addPdfImage(pdf, canvas, fullHeightMm, state);
      return;
    }

    maxSliceHeight = Math.max(1, Math.floor(CONTENT_HEIGHT_MM * sourceWidth / CONTENT_WIDTH_MM));
    sourceY = 0;

    while (sourceY < sourceHeight) {
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
        addPdfImage(
          pdf,
          sliceCanvas,
          sliceHeight * CONTENT_WIDTH_MM / sourceWidth,
          state,
        );
      } finally {
        sliceCanvas.width = 0;
        sliceCanvas.height = 0;
      }
      sourceY += sliceHeight;
    }
  }

  async function prepare(options) {
    options = options || {};

    var windowRef = options.windowRef || global;
    var documentRef = options.documentRef || windowRef.document;
    var html2canvasImpl = options.html2canvasImpl || windowRef.html2canvas;
    var JsPdfCtor = resolveJsPdf(options, windowRef);
    var iframe;

    try {
      if (!documentRef || !documentRef.body) throw new Error('浏览器文档不可用');
      if (typeof html2canvasImpl !== 'function') throw new Error('html2canvas 不可用');
      if (typeof JsPdfCtor !== 'function') throw new Error('jsPDF 不可用');

      iframe = documentRef.createElement('iframe');
      iframe.setAttribute('data-report-pdf', '');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.setAttribute('sandbox', 'allow-same-origin');
      iframe.style.position = 'fixed';
      iframe.style.left = '-10000px';
      iframe.style.top = '0';
      iframe.style.width = '1280px';
      iframe.style.height = '1px';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.border = '0';
      documentRef.body.appendChild(iframe);

      await waitForIframe(iframe, options.html || '');

      var frameDocument = iframe.contentDocument
        || (iframe.contentWindow && iframe.contentWindow.document);
      if (!frameDocument) throw new Error('无法读取报告页面');
      if (frameDocument.fonts && frameDocument.fonts.ready) {
        await frameDocument.fonts.ready;
      }

      Array.prototype.forEach.call(
        frameDocument.querySelectorAll('.no-print'),
        removeNode,
      );

      var blocks = Array.prototype.slice.call(
        frameDocument.querySelectorAll('.cover, .section, .footer'),
      );
      if (!blocks.length) throw new Error('未找到可导出的报告内容');

      var pdf = new JsPdfCtor({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });
      var state = { hasImage: false };
      var scale = Math.min(1.6, windowRef.devicePixelRatio || 1);

      for (var index = 0; index < blocks.length; index += 1) {
        var canvas = await html2canvasImpl(blocks[index], {
          useCORS: true,
          backgroundColor: '#0d0f18',
          scale: scale,
        });

        try {
          addCanvasToPdf(pdf, canvas, documentRef, state);
        } finally {
          canvas.width = 0;
          canvas.height = 0;
        }

        if (typeof options.onProgress === 'function') {
          options.onProgress(Math.round(((index + 1) / blocks.length) * 100));
        }
      }

      var blob = pdf.output('blob');
      var filename = options.filename || DEFAULT_FILENAME;
      var FileCtor = windowRef.File || global.File;
      if (typeof FileCtor === 'function') {
        return new FileCtor([blob], filename, { type: PDF_TYPE });
      }
      return blob;
    } catch (error) {
      throw new Error('PDF 生成失败：' + (error && error.message ? error.message : String(error)));
    } finally {
      removeNode(iframe);
    }
  }

  function download(file, filename) {
    var documentRef = global.document;
    var urlApi = global.URL;
    var objectUrl = urlApi.createObjectURL(file);
    var anchor;

    try {
      anchor = documentRef.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename || DEFAULT_FILENAME;
      documentRef.body.appendChild(anchor);
      anchor.click();
    } finally {
      removeNode(anchor);
      global.setTimeout(function () {
        urlApi.revokeObjectURL(objectUrl);
      }, 60000);
    }
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
