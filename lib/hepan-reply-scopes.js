// Resolve ownership before auditing a claim. Never assign a whole comparison
// line to the person mentioned on the preceding line.
function hepanReplyScopes(reply, people) {
  const aliases = new Map([['甲方', ['甲方']], ['乙方', ['乙方']], ['P1', ['甲方']], ['P2', ['乙方']]]);
  const both = ['甲方', '乙方'];
  function unique(predicate) {
    const matches = people.filter(predicate);
    return matches.length === 1 ? [matches[0].role] : [];
  }
  const male = unique(p => p.data.gender === 'male');
  const female = unique(p => p.data.gender === 'female');
  const self = unique(p => /^(我|本人|自己)$/.test(String(p.data.name || '')));
  [['男方', male], ['女方', female], ['他', male], ['她', female], ['你', self], ['您', self],
    ['对方', self.length ? both.filter(role => role !== self[0]) : []],
    ['双方', both], ['两人', both], ['你们', both], ['他们', both], ['她们', both]
  ].forEach(([alias, roles]) => aliases.set(alias, roles));
  people.forEach(person => {
    const name = String(person.data.name || '').trim();
    if (name.length < 2 || aliases.has(name)) return;
    aliases.set(name, unique(p => String(p.data.name || '').trim() === name));
  });
  const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tokens = [...aliases.keys()].sort((a, b) => b.length - a.length).map(escape).join('|');
  const tokenRe = new RegExp(tokens, 'g');
  const scopes = [];
  let active = [];
  String(reply).split(/\n/).forEach(line => {
    const matches = [...line.matchAll(tokenRe)].filter(match => {
      const token = match[0];
      const before = line.slice(0, match.index);
      const after = line.slice(match.index + token.length);
      if (/^P[12]$/.test(token) && (/[A-Za-z0-9_]$/.test(before) || /^[A-Za-z0-9_]/.test(after))) return false;
      // “其他”“他人”“你们” are not a singular person's identity.
      return !(/^[他她你您]$/.test(token) && (/其$/.test(before) || /^(人|们)/.test(after)));
    });
    let start = 0;
    let previousToken = false;
    function emit(text) {
      active.forEach(role => scopes.push({ role, text }));
    }
    matches.forEach(match => {
      const between = line.slice(start, match.index);
      const roles = aliases.get(match[0]);
      // In “甲方和乙方都是…”, the subsequent assertion applies to both.
      const joint = previousToken && /^[\s、与和及跟/]*(?:以及)?[\s、与和及跟/]*$/.test(between);
      if (!joint) emit(between);
      active = joint ? [...new Set(active.concat(roles))] : roles;
      previousToken = true;
      start = match.index + match[0].length;
    });
    emit(line.slice(start));
  });
  return scopes;
}

module.exports = { hepanReplyScopes };
