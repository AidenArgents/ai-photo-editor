const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  const targetEn = /enFull:parsed\[i\]\.en\|\|''/g;
  const replacementEn = "enFull:(parsed[i].en||'') + (typeof arLabel !== 'undefined' && arLabel !== 'keep original' && arLabel !== 'auto' ? '\\n\\nAspect Ratio: ' + arLabel : '')";
  
  content = content.replace(targetEn, replacementEn);
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

const dirs = [
  path.join(__dirname, 'public'),
  path.join(__dirname, 'public', 'web')
];

for (const dir of dirs) {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
    for (const file of files) {
      replaceInFile(path.join(dir, file));
    }
  }
}
