const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

code = code.replace(/const client = await db\.pool\.connect\(\);\s+try \{/g, 
  'let client;\n  try {\n    client = await db.pool.connect();');

code = code.replace(/} finally \{\s+client\.release\(\);\s+\}/g,
  '} finally {\n    if (client) client.release();\n  }');

fs.writeFileSync('server/index.js', code);
console.log('Fixed db.pool.connect try-catch pattern.');
