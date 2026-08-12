const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

code = code.replace(
  /const walletId = toUuidOrNull\(w\.id\);\n\s*const duplicateCheck = await client\.query\(\n\s*`SELECT id FROM daily_entries/,
  `const duplicateCheck = await client.query(\n      \`SELECT id FROM daily_entries`
);

fs.writeFileSync('server/index.js', code);
