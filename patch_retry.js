const fs = require('fs');
let file = fs.readFileSync('server/index.js', 'utf8');
file = file.replace(/console\.error\('Initialization retry failed:', retryErr\);/g, "console.error('Initialization retry failed. Please verify your Neon database password in the DATABASE_URL.');");
file = file.replace(/console\.error\('Initialization failed:', err\);/g, "console.error('Initialization failed. Please verify your Neon database password in the DATABASE_URL.');");
fs.writeFileSync('server/index.js', file);
