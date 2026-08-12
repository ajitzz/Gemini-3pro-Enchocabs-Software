const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

// Revert the wrong replacement in syncDriverBillingForWeek
code = code.replace(
  /client = await db\.pool\.connect\(\);\n\s*await client\.query\('BEGIN'\);\n\s*const lock1 = typeof e\.driver[^]+?await client\.query\('SELECT pg_advisory_xact_lock\(\$1, \$2\)', \[lock1, lock2\]\);/,
  `client = await db.pool.connect();\n      await client.query('BEGIN');`
);

// Apply correctly to daily-entries
code = code.replace(
  /app\.post\('\/api\/daily-entries', async \(req, res\) => \{\n\s*const e = req\.body;\n\s*let client;\n\s*try \{\n\s*client = await db\.pool\.connect\(\);\n\s*await client\.query\('BEGIN'\);/,
  `app.post('/api/daily-entries', async (req, res) => {
  const e = req.body;
  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    const lock1 = typeof e.driver === 'string' ? (function(str) { let hash = 0; for (let i = 0; i < str.length; i++) { hash = (hash << 5) - hash + str.charCodeAt(i); hash |= 0; } return hash; })(e.driver.toLowerCase()) : 0;
    const lock2 = typeof e.date === 'string' ? (function(str) { let hash = 0; for (let i = 0; i < str.length; i++) { hash = (hash << 5) - hash + str.charCodeAt(i); hash |= 0; } return hash; })(e.date) : 0;
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [lock1, lock2]);`
);

fs.writeFileSync('server/index.js', code);
