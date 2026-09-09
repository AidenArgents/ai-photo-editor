const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  // Replace EXACT strings in the template literals
  content = content.replace(/\\n比例：\$\{arLabel\}/g, '');
  content = content.replace(/比例：\$\{arLabel\}\\n/g, '');
  content = content.replace(/比例：\$\{arLabel\}/g, '');
  
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
