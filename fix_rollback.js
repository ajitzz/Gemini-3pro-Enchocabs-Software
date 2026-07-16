const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

code = code.replace(/await client\.query\('ROLLBACK'\);/g, 
  'if (client) await client.query(\'ROLLBACK\');');

fs.writeFileSync('server/index.js', code);
console.log('Fixed client.query ROLLBACK.');
