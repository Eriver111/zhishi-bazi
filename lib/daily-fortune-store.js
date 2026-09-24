'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const PUBLIC_ROOT = path.resolve(__dirname, '..');

function chartIdentity(chart) {
  const b = chart.bazi;
  const birth = b.birthDate;
  // Labels, account IDs, URL parameter ordering, and code/model versions do not
  // create a second edition. Birth timing must remain distinct for Da Yun.
  return crypto.createHash('sha256').update(JSON.stringify({
    pillars:['year','month','day','hour'].map(key => b[key].gan + b[key].zhi),
    gender:chart.gender,
    birth:birth ? [birth.year,birth.month,birth.day,birth.hour,
      Number.isFinite(birth.clock) ? Math.round(birth.clock * 1e6) / 1e6 : null] : null
  })).digest('hex');
}

function createDailyStore(directory) {
  if (!path.isAbsolute(directory)) throw new Error('Daily snapshot path must be absolute');
  const root = path.resolve(directory);
  const pending = new Map();
  let checked;
  async function ensurePrivateDirectory() {
    if (!checked) checked = (async () => {
      const relative = path.relative(PUBLIC_ROOT, root);
      if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) {
        throw new Error('Daily snapshots must be outside the public web root');
      }
      await fs.mkdir(root, {recursive:true, mode:0o700});
      const actual = await fs.realpath(root);
      const publicActual = await fs.realpath(PUBLIC_ROOT);
      const rel = path.relative(publicActual, actual);
      if (!rel || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel))) {
        throw new Error('Daily snapshot directory resolves inside the public web root');
      }
    })().catch(error => {checked = null; throw error;});
    return checked;
  }
  function filename(date, identity) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[a-f0-9]{64}$/.test(identity)) throw new Error('Invalid daily snapshot key');
    return path.join(root, date + '-' + identity + '.json');
  }
  async function read(date, identity) {
    await ensurePrivateDirectory();
    let raw;
    try {raw = await fs.readFile(filename(date, identity), 'utf8');}
    catch (error) {if (error.code === 'ENOENT') return null; throw error;}
    // Corruption fails closed; never silently regenerate another visible edition.
    const row = JSON.parse(raw);
    if (row.schema !== 1 || row.date !== date || row.identity !== identity
      || !row.output || typeof row.output.tip !== 'string' || !row.output.tip
      || typeof row.output.headline !== 'string' || !Array.isArray(row.output.basis)) throw new Error('Invalid daily snapshot');
    return row.output;
  }
  async function publish(date, identity, output) {
    const destination = filename(date, identity);
    const temporary = destination + '.' + crypto.randomUUID() + '.tmp';
    try {
      const handle = await fs.open(temporary, 'wx', 0o600);
      try {
        await handle.writeFile(JSON.stringify({schema:1, date, identity, output}), 'utf8');
        await handle.sync();
      } finally {await handle.close();}
      // An atomic no-overwrite link publishes only a fully written file. Two
      // workers may finish generation, but BOTH must return the winning edition.
      try {await fs.link(temporary, destination);}
      catch (error) {if (error.code !== 'EEXIST') throw error;}
      const winner = await read(date, identity);
      if (!winner) throw new Error('Daily snapshot publication failed');
      return winner;
    } finally {await fs.unlink(temporary).catch(() => {});}
  }
  let cleanedDate;
  async function prune(date) {
    if (cleanedDate === date) return;
    cleanedDate = date;
    const threshold = new Date(Date.parse(date + 'T00:00:00Z') - 14 * 86400000).toISOString().slice(0,10);
    const names = await fs.readdir(root);
    for (const name of names) {
      // Only remove our old snapshots; never recurse into a directory or touch
      // the current day, unrelated files, or a path supplied by a request.
      if (/^\d{4}-\d{2}-\d{2}-[a-f0-9]{64}\.json$/.test(name) && name.slice(0,10) < threshold) {
        await fs.unlink(path.join(root,name)).catch(() => {});
      }
    }
  }
  async function getOrCreate(date, identity, generate) {
    const key = date + '-' + identity;
    if (pending.has(key)) return pending.get(key);
    const task = (async () => {
      const saved = await read(date, identity);
      if (saved) return {output:saved, cached:true};
      await prune(date);
      const output = await generate();
      return {output:await publish(date, identity, output), cached:false};
    })();
    pending.set(key, task);
    try {return await task;} finally {pending.delete(key);}
  }
  return {read, getOrCreate};
}

let defaultStore;
function getDailyStore() {
  if (!defaultStore) defaultStore = createDailyStore(process.env.FORTUNE_CACHE_DIR
    || path.resolve(PUBLIC_ROOT, '..', '.zhishi-private', 'daily-fortune'));
  return defaultStore;
}

module.exports = {chartIdentity, createDailyStore, getDailyStore};
