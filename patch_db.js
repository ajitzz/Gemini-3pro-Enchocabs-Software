const fs = require('fs');
let code = fs.readFileSync('server/db.js', 'utf8');
code = code.replace(
  "ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false",
  "ssl: { rejectUnauthorized: false }"
);
fs.writeFileSync('server/db.js', code);
