const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));

const missing = [];
for (const page of appJson.pages) {
  for (const ext of ['js', 'wxml', 'json', 'wxss']) {
    const file = path.join(root, 'miniprogram', `${page}.${ext}`);
    if (!fs.existsSync(file)) missing.push(path.relative(root, file));
  }
}

const wxmlFiles = appJson.pages.map((page) => path.join(root, 'miniprogram', `${page}.wxml`));
const invalidWxml = wxmlFiles.filter((file) => {
  const text = fs.readFileSync(file, 'utf8');
  return /\{\{(?:money|dateText)\(/.test(text);
});

const requiredFiles = [
  'project.config.json',
  'miniprogram/app.js',
  'miniprogram/app.wxss',
  'miniprogram/common/api.js',
  'miniprogram/common/domain.js',
  'miniprogram/common/store.js',
  'cloudfunctions/api/index.js',
  'docs/launch-checklist.md',
  'docs/cloud-database-seed.json'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) missing.push(file);
}

if (missing.length || invalidWxml.length) {
  if (missing.length) {
    console.error('Missing files:');
    missing.forEach((file) => console.error(`- ${file}`));
  }
  if (invalidWxml.length) {
    console.error('WXML still uses unsupported formatter calls:');
    invalidWxml.forEach((file) => console.error(`- ${path.relative(root, file)}`));
  }
  process.exit(1);
}

console.log('✅ All project files verified.');
