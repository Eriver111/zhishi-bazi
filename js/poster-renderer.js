(function (global) {
  'use strict';

  var CANVAS_WIDTH = 1080;
  var CANVAS_HEIGHT = 1920;
  var CINNABAR = '#b6382e';
  var canvasModels = typeof WeakMap === 'function' ? new WeakMap() : null;

  function defaultLoadImage(url) {
    return new Promise(function (resolve, reject) {
      var image = new global.Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error('background image failed')); };
      image.src = url;
    });
  }

  function defaultWaitForFonts() {
    var document = global.document;
    return document && document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  }

  function getImageSize(image) {
    return {
      width: image.naturalWidth || image.videoWidth || image.width,
      height: image.naturalHeight || image.videoHeight || image.height,
    };
  }

  function drawCover(context, image) {
    var size = getImageSize(image);
    var scale = Math.max(CANVAS_WIDTH / size.width, CANVAS_HEIGHT / size.height);
    var sourceWidth = CANVAS_WIDTH / scale;
    var sourceHeight = CANVAS_HEIGHT / scale;
    var sourceX = (size.width - sourceWidth) / 2;
    var sourceY = (size.height - sourceHeight) / 2;

    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  function drawText(context, text, x, y, font, color) {
    context.font = font;
    context.fillStyle = color;
    context.fillText(text, x, y);
  }

  function drawSeal(context, text, x, y, width, height, font) {
    context.save();
    context.globalAlpha = 1;
    context.fillStyle = CINNABAR;
    context.fillRect(x, y, width, height);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    drawText(context, text, x + width / 2, y + height / 2, font, '#f6ead5');
    context.restore();
  }

  function drawPoster(context, image, model) {
    var copyLines = Array.isArray(model.copyLines) ? model.copyLines : [];
    var sealText = model.sealText || '知时';
    var footer = model.footer || '知天时，见自己';
    var gradient;

    drawCover(context, image);
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';

    context.save();
    context.globalAlpha = 0.16;
    context.filter = 'blur(12px)';
    drawText(context, model.dayGan, 540, 540, '260px ZhishiBrush, serif', '#241b16');
    context.restore();
    context.globalAlpha = 1;
    context.filter = 'none';
    drawText(context, model.dayGan, 540, 540, '260px ZhishiBrush, serif', '#241b16');
    drawText(context, model.dayMasterLabel, 540, 650, '52px ZhishiSerif, serif', '#241b16');
    drawText(context, model.subtitle, 540, 725, '42px ZhishiSerif, serif', '#3c3028');

    drawSeal(context, sealText, 888, 96, 112, 112, '42px ZhishiSerif, serif');
    drawSeal(context, model.patternName, 400, 820, 280, 100, '46px ZhishiSerif, serif');

    gradient = context.createLinearGradient(0, 1220, 0, 1640);
    gradient.addColorStop(0, 'rgba(28, 20, 16, 0)');
    gradient.addColorStop(0.24, 'rgba(28, 20, 16, 0.72)');
    gradient.addColorStop(1, 'rgba(28, 20, 16, 0.88)');
    context.fillStyle = gradient;
    context.fillRect(0, 1220, CANVAS_WIDTH, 420);
    drawText(context, copyLines[0] || '', 540, 1390, '48px ZhishiSerif, serif', '#f6ead5');
    drawText(context, copyLines[1] || '', 540, 1480, '48px ZhishiSerif, serif', '#f6ead5');
    drawText(context, footer, 540, 1835, '30px ZhishiSerif, serif', '#f6ead5');
  }

  function resolveDependencies(overrides) {
    var dependencies = overrides || {};
    return {
      loadImage: dependencies.loadImage || defaultLoadImage,
      waitForFonts: dependencies.waitForFonts || defaultWaitForFonts,
    };
  }

  async function render(options, overrides) {
    var input = options || {};
    var canvas = input.canvas;
    var dependencies = resolveDependencies(overrides);
    var backgroundResult;
    var fontResult;
    var image;
    var context;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    backgroundResult = Promise.resolve()
      .then(function () { return dependencies.loadImage(input.backgroundUrl); })
      .then(function (value) { return { ok: true, value: value }; }, function () { return { ok: false, error: 'BACKGROUND_LOAD_FAILED' }; });
    fontResult = Promise.resolve()
      .then(function () { return dependencies.waitForFonts(); })
      .then(function () { return { ok: true }; }, function () { return { ok: false, error: 'FONT_LOAD_FAILED' }; });

    backgroundResult = await backgroundResult;
    fontResult = await fontResult;
    if (!backgroundResult.ok) return { ok: false, error: backgroundResult.error };
    if (!fontResult.ok) return { ok: false, error: fontResult.error };

    image = backgroundResult.value;
    context = canvas.getContext('2d');
    drawPoster(context, image, input.model || {});
    if (canvasModels) canvasModels.set(canvas, input.model || {});
    return { ok: true };
  }

  function getBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      try {
        canvas.toBlob(resolve, type, quality);
      } catch (error) {
        reject(error);
      }
    });
  }

  function defaultFilename(model) {
    var data = model || {};
    return '知时-' + (data.dayMasterLabel || '命格') + '-' + (data.patternName || '海报') + '.webp';
  }

  async function download(options, overrides) {
    var input = options || {};
    var dependencies = overrides || {};
    var document = dependencies.document || global.document;
    var URL = dependencies.URL || global.URL;
    var model = input.model || (canvasModels && canvasModels.get(input.canvas));
    var blob;
    var url;
    var anchor;

    try {
      blob = await getBlob(input.canvas, 'image/webp', 0.92);
      if (!blob) blob = await getBlob(input.canvas, 'image/jpeg', 0.94);
      if (!blob) return { ok: false, error: 'EXPORT_FAILED' };

      url = URL.createObjectURL(blob);
      anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = input.filename || defaultFilename(model);
      anchor.style = 'display:none';
      (document.body || document.documentElement).appendChild(anchor);
      anchor.click();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: 'EXPORT_FAILED' };
    } finally {
      if (anchor) {
        if (typeof anchor.remove === 'function') anchor.remove();
        else if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
      }
      if (url) URL.revokeObjectURL(url);
    }
  }

  global.PosterRenderer = {
    render: render,
    download: download,
  };
})(window);
