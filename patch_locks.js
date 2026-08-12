const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

// Patch daily-entries
code = code.replace(
  /client = await db\.pool\.connect\(\);\n\s*await client\.query\('BEGIN'\);/,
  `client = await db.pool.connect();
    await client.query('BEGIN');
    const lock1 = typeof e.driver === 'string' ? (function(str) { let hash = 0; for (let i = 0; i < str.length; i++) { hash = (hash << 5) - hash + str.charCodeAt(i); hash |= 0; } return hash; })(e.driver.toLowerCase()) : 0;
    const lock2 = typeof e.date === 'string' ? (function(str) { let hash = 0; for (let i = 0; i < str.length; i++) { hash = (hash << 5) - hash + str.charCodeAt(i); hash |= 0; } return hash; })(e.date) : 0;
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [lock1, lock2]);`
);

// Patch weekly-wallets
code = code.replace(
  /client = await db\.pool\.connect\(\);\n\s*await client\.query\('BEGIN'\);\n\s*const startISO = toISODate\(w\.weekStartDate\);/,
  `client = await db.pool.connect();
    await client.query('BEGIN');
    const startISO = toISODate(w.weekStartDate);
    const lock1w = typeof w.driver === 'string' ? (function(str) { let hash = 0; for (let i = 0; i < str.length; i++) { hash = (hash << 5) - hash + str.charCodeAt(i); hash |= 0; } return hash; })(w.driver.toLowerCase()) : 0;
    const lock2w = typeof startISO === 'string' ? (function(str) { let hash = 0; for (let i = 0; i < str.length; i++) { hash = (hash << 5) - hash + str.charCodeAt(i); hash |= 0; } return hash; })(startISO) : 0;
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [lock1w, lock2w]);`
);

fs.writeFileSync('server/index.js', code);
