const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const vendorDir = path.join(root, 'js', 'vendor');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));

for (const dependency of [
  {
    packageName: 'html2canvas',
    version: '1.4.1',
    filename: 'html2canvas.min.js',
    installedBundle: 'node_modules/html2canvas/dist/html2canvas.min.js',
  },
  {
    packageName: 'jspdf',
    version: '4.2.1',
    filename: 'jspdf.umd.min.js',
    installedBundle: 'node_modules/jspdf/dist/jspdf.umd.min.js',
  },
]) {
  test(`${dependency.packageName} stays exactly pinned and its local bundle matches installed bytes`, () => {
    const vendorBytes = fs.readFileSync(path.join(vendorDir, dependency.filename));
    const installedBytes = fs.readFileSync(path.join(root, dependency.installedBundle));

    assert.equal(packageJson.dependencies[dependency.packageName], dependency.version);
    assert.equal(
      packageLock.packages[`node_modules/${dependency.packageName}`].version,
      dependency.version,
    );
    assert.ok(vendorBytes.length > 50_000, `${dependency.filename} must be a real browser bundle`);
    assert.equal(
      vendorBytes.equals(installedBytes),
      true,
      `${dependency.filename} must match ${dependency.installedBundle} byte-for-byte`,
    );
  });
}
