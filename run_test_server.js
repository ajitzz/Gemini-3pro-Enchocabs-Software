require('dotenv').config();
const app = require('./server/index');
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});
