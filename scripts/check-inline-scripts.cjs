const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const files = [
  'public/taotu.html',
  'public/zhutu.html',
  'public/changjing.html',
  'public/fba.html',
  'public/web/taotu.html',
  'public/web/zhutu.html',
  'public/web/changjing.html',
  'public/web/fba.html',
];

let failed = false;
for (const relativePath of files) {
  const fullPath = path.resolve(relativePath);
  const html = fs.readFileSync(fullPath, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim());
  scripts.forEach((source, index) => {
    try {
      new vm.Script(source, { filename: `${relativePath}#inline-${index + 1}` });
    } catch (error) {
      failed = true;
      console.error(error.stack || error);
    }
  });
  if (!failed) console.log(`OK ${relativePath} (${scripts.length} inline script${scripts.length === 1 ? '' : 's'})`);
}

if (failed) process.exitCode = 1;
