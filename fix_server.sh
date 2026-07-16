#!/bin/bash
# Remove the messed up block
head -n -14 server/index.js > server_temp.js
cat << 'INNER_EOF' >> server_temp.js
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
module.exports = app;

startKeepAlive();
runBackgroundInitialization().catch((err) => {
  console.error('Unexpected initialization error:', err);
});
INNER_EOF
mv server_temp.js server/index.js
