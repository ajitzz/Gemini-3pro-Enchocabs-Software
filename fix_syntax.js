const fs = require('fs');
let file = fs.readFileSync('server/index.js', 'utf8');
let changed = true;
let iters = 0;
while (changed && iters < 50) {
  changed = false;
  iters++;
  try {
    require('vm').createScript(file, { filename: 'server/index.js' });
  } catch (e) {
    if (e instanceof SyntaxError) {
      const match = e.stack.match(/server\/index.js:(\d+)/);
      if (match) {
        const line = parseInt(match[1]);
        const lines = file.split('\n');
        console.log(`Deleting line ${line}:`, lines[line - 1]);
        lines.splice(line - 1, 1);
        file = lines.join('\n');
        changed = true;
      }
    }
  }
}
fs.writeFileSync('server/index.js', file);
