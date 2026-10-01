(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ReportCityCompare = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  var nextId = 0;
  var directions = { technology: '技术与研究', operations: '业务与运营', service: '服务与支持', creative: '设计与创作', 'hands-on': '技能与实务', education: '教育与培训', other: '其他方向' };
  var boundary = '以下是选城时需要查证的事项。尚未查询各城市的公开资料，不作城市优劣判断或匹配评分。';

  function cleanText(value) { return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim().slice(0, 80) : ''; }
  function choice(value, options) { return Object.prototype.hasOwnProperty.call(options, value) ? value : ''; }

  function buildPlan(input) {
    input = input || {};
    var workDirection = choice(input.workDirection, directions);
    var cities = [];
    (Array.isArray(input.cities) ? input.cities : []).slice(0, 2).forEach(function (value) {
      var name = cleanText(value);
      if (name && !cities.some(function (city) { return city.toLowerCase() === name.toLowerCase(); })) cities.push(name);
    });
    var items = {
      jobs: { key: 'jobs', label: '目标岗位是否合适', check: '对照近期招聘中的职责、技能要求和工作方式，看看是否适合自己的工作方向。', source: '近期招聘信息、岗位说明与招聘方答复' },
      choices: { key: 'choices', label: '同方向的机会是否多样', check: '查看同一工作方向是否有不同类型的岗位，区分长期招聘与短期项目，不凭城市名气判断。', source: '多个招聘渠道的近期岗位信息' },
      requirements: { key: 'requirements', label: '进入这个方向需要哪些准备', check: '核对岗位需要的资格、经验或作品，区分硬性要求与可以入职后学习的内容。', source: '岗位说明、公开资格要求与招聘方答复' }
    };
    var planningDirection = workDirection ? '围绕“' + directions[workDirection] + '”，比较目标岗位、机会类型和进入条件，再决定哪些城市值得进一步了解。' : '先从宽泛的工作或专业方向出发，比较目标岗位、机会类型和进入条件，再逐步缩小城市范围。';
    var order = ['jobs', 'choices', 'requirements'];
    var workChecks = {
      technology: '对照技术与研究岗位的专业要求、实际任务和协作方式，确认自己的技能能否衔接。',
      operations: '对照业务与运营岗位的服务对象、任务内容和协作方式，区分不同岗位的实际职责。',
      service: '对照服务与支持岗位的服务对象、轮班方式和资格要求，了解具体工作内容。',
      creative: '对照设计与创作岗位的作品要求、创作内容和协作方式，了解长期岗位与项目合作的区别。',
      'hands-on': '对照技能与实务岗位的技能要求、作业场所和排班方式，确认能否适应实际工作。',
      education: '对照教育与培训岗位的资格要求、服务对象和工作时间，确认是否适合自己的方向。'
    };
    if (workChecks[workDirection]) items.jobs.check = workChecks[workDirection];
    return { valid: true, workDirection: workDirection, workDirectionLabel: directions[workDirection] || '', cities: cities, planningDirection: planningDirection, checklist: order.map(function (key) { return items[key]; }), boundary: boundary };
  }

  function toText(result) {
    if (!result || !result.valid) return '';
    var lines = ['城市选择检查表', '工作 / 专业方向：' + (result.workDirectionLabel || '暂未填写'), '候选城市：' + (result.cities.join('、') || '暂未填写'), '', '规划方向：' + result.planningDirection, ''];
    result.checklist.forEach(function (item, index) {
      lines.push((index + 1) + '. ' + item.label, item.check, '可查资料：' + item.source);
      lines.push('');
    });
    lines.push(result.boundary); return lines.join('\n');
  }

  function installStyle(doc) {
    var style = doc.getElementById('report-city-compare-style');
    if (!style) { style = doc.createElement('style'); style.id = 'report-city-compare-style'; (doc.head || doc.documentElement).appendChild(style); }
    style.textContent = '.report-city-compare{min-width:0;overflow-wrap:anywhere}.report-city-compare__intro{line-height:1.7}.report-city-compare__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.report-city-compare__field{display:flex;flex-direction:column;gap:6px;margin:0 0 12px;min-width:0}.report-city-compare label{font-size:14px;line-height:1.5}.report-city-compare input,.report-city-compare select{box-sizing:border-box;width:100%;max-width:100%;min-width:0;min-height:44px;border:1px solid #b7a68f;border-radius:6px;padding:9px 10px;font:inherit;color:#332a22;background:#fffdf8}.report-city-compare button{min-height:44px;max-width:100%;padding:10px 16px;border:1px solid #9a5238;border-radius:6px;color:#fffaf0;background:#8f402b;font:inherit;cursor:pointer}.report-city-compare button:focus-visible,.report-city-compare input:focus-visible,.report-city-compare select:focus-visible,.report-city-compare summary:focus-visible{outline:3px solid #90652e;outline-offset:2px}.report-city-compare__status{margin:10px 0;line-height:1.6}.report-city-compare__status:empty{display:none}.report-city-compare__result h4{margin:18px 0 10px}.report-city-compare__result li{margin:12px 0;line-height:1.7}.report-city-compare__result p{line-height:1.7}.report-city-compare__table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:14px}.report-city-compare__table th,.report-city-compare__table td{padding:9px 7px;border:1px solid #d9c8ab;text-align:left;vertical-align:top;overflow-wrap:anywhere}.report-city-compare__table th:first-child{width:52%}.report-city-compare__table p{font-weight:400;margin:6px 0}.report-city-compare__source{font-size:12px;color:#685b4b}.report-city-compare__export{margin-top:14px}.report-city-compare__export pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.7}.report-city-compare summary{padding:12px 0;min-height:24px;cursor:pointer}.report-city-compare__fields{margin-top:8px}@media(max-width:620px){.report-city-compare__grid{grid-template-columns:minmax(0,1fr);gap:0}.report-city-compare button{width:100%}.report-city-compare__table th,.report-city-compare__table td{padding:8px 5px}}';
  }

  function mount(container) {
    var doc = container && container.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (typeof container === 'string' && doc) container = doc.querySelector(container);
    if (!container || !doc || typeof container.appendChild !== 'function') throw new TypeError('ReportCityCompare.mount requires a container element.');
    if (container.__reportCityCompare) container.__reportCityCompare.destroy();
    installStyle(doc);
    var prefix = 'report-city-compare-' + (++nextId) + '-', fields = {}, result = null, active = true;
    function el(tag, className, text) { var node = doc.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
    var article = el('article', 'deep-report-card report-city-compare');
    article.appendChild(el('h3', '', '城市选择：先看哪些条件'));
    article.appendChild(el('p', 'report-city-compare__intro', '可以补充宽泛的工作或专业方向，以及最多两座候选城市，生成一份客观比较清单。'));
    var disclosure = el('details', 'report-city-compare__form'); disclosure.appendChild(el('summary', '', '补充工作方向与候选城市（可跳过）'));
    var form = el('form', 'report-city-compare__fields'); form.noValidate = true;
    form.appendChild(el('p', '', '所有选项都可以跳过，不填也能生成基础清单。'));
    function field(parent, name, labelText, choices) {
      var wrap = el('div', 'report-city-compare__field'), id = prefix + name, label = el('label', '', labelText); label.htmlFor = id;
      var control = el(choices ? 'select' : 'input'); control.id = id; control.name = name;
      if (choices) {
        [['', '暂不选择']].concat(Object.keys(choices).map(function (key) { return [key, choices[key]]; })).forEach(function (item) { var option = el('option', '', item[1]); option.value = item[0]; control.appendChild(option); });
        control.value = '';
      } else { control.type = 'text'; control.autocomplete = 'off'; control.maxLength = 80; }
      wrap.appendChild(label); wrap.appendChild(control); parent.appendChild(wrap); fields[name] = control;
    }
    field(form, 'workDirection', '宽泛的工作 / 专业方向（可选）', directions);
    var cityGrid = el('div', 'report-city-compare__grid'); field(cityGrid, 'city0', '候选城市一（可选）'); field(cityGrid, 'city1', '候选城市二（可选）'); form.appendChild(cityGrid);
    var submit = el('button', '', '生成选择清单'); submit.type = 'submit'; form.appendChild(submit); disclosure.appendChild(form); article.appendChild(disclosure);
    var status = el('p', 'report-city-compare__status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); article.appendChild(status);
    var resultNode = el('section', 'report-city-compare__result'); resultNode.setAttribute('aria-label', '城市选择检查表'); article.appendChild(resultNode);
    var exportArea = el('div', 'report-city-compare__form report-city-compare__export'); exportArea.hidden = true;
    var download = el('button', '', '下载检查表文本'); download.type = 'button'; exportArea.appendChild(download);
    var details = el('details'); details.appendChild(el('summary', '', '查看可复制的纯文本'));
    var plain = el('pre'); details.appendChild(plain); exportArea.appendChild(details); article.appendChild(exportArea); container.appendChild(article);

    function clearResult() { result = null; resultNode.replaceChildren(); exportArea.hidden = true; plain.textContent = ''; }
    function renderResult(value) {
      resultNode.replaceChildren(); resultNode.appendChild(el('h4', '', '规划方向')); resultNode.appendChild(el('p', '', value.planningDirection));
      if (value.workDirectionLabel) resultNode.appendChild(el('p', '', '工作 / 专业方向：' + value.workDirectionLabel));
      resultNode.appendChild(el('h4', '', '需要比较的客观事项'));
      if (value.cities.length) resultNode.appendChild(el('p', '', '候选城市：' + value.cities.join('、')));
      var list = el('ul'); value.checklist.forEach(function (item) { var row = el('li'); row.appendChild(el('strong', '', item.label)); row.appendChild(el('p', '', item.check)); row.appendChild(el('p', 'report-city-compare__source', '可查资料：' + item.source)); list.appendChild(row); }); resultNode.appendChild(list);
      resultNode.appendChild(el('p', '', boundary)); plain.textContent = toText(value); exportArea.hidden = false;
    }
    function onSubmit(event) {
      event.preventDefault(); clearResult(); result = buildPlan({ workDirection: fields.workDirection.value, cities: [fields.city0.value, fields.city1.value] });
      renderResult(result); disclosure.open = false; status.textContent = '检查表已生成，所有选项仍可修改或跳过。';
    }
    function onEdit() { if (result) { clearResult(); status.textContent = '工作方向或候选城市已修改，可以重新生成清单。'; } }
    function onDownload() {
      if (!result) return; var view = doc.defaultView;
      if (!view || !view.Blob || !view.URL || !view.URL.createObjectURL) { details.open = true; status.textContent = '请从下方纯文本中复制检查表。'; return; }
      var url = view.URL.createObjectURL(new view.Blob(['\ufeff' + toText(result)], { type: 'text/plain;charset=utf-8' }));
      var link = el('a'); link.href = url; link.download = '城市选择检查表.txt'; link.hidden = true; article.appendChild(link); link.click(); link.remove(); view.setTimeout(function () { view.URL.revokeObjectURL(url); }, 1000);
    }
    form.addEventListener('submit', onSubmit); form.addEventListener('input', onEdit); form.addEventListener('change', onEdit); download.addEventListener('click', onDownload);
    var api = {
      getResult: function () { return result ? JSON.parse(JSON.stringify(result)) : null; }, exportText: function () { return toText(result); },
      destroy: function () {
        if (!active) return; active = false; form.removeEventListener('submit', onSubmit); form.removeEventListener('input', onEdit); form.removeEventListener('change', onEdit); download.removeEventListener('click', onDownload);
        article.remove(); result = null; if (container.__reportCityCompare === api) delete container.__reportCityCompare;
      }
    };
    container.__reportCityCompare = api; return api;
  }
  return { version: '1.2.0', mount: mount, buildPlan: buildPlan, toText: toText };
});
