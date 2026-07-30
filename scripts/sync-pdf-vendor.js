const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const vendorDir = path.join(root, 'js', 'vendor');

fs.mkdirSync(vendorDir, { recursive: true });

for (const [source, destination] of [
  ['node_modules/html2canvas/dist/html2canvas.min.js', 'html2canvas.min.js'],
  ['node_modules/jspdf/dist/jspdf.umd.min.js', 'jspdf.umd.min.js'],
]) {
  fs.copyFileSync(path.join(root, source), path.join(vendorDir, destination));
}
