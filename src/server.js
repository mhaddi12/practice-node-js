const { createApp } = require('./app');
const { connectDB } = require('./config/db');
const env = require('./config/env');

async function start() {
  await connectDB();
  const app = createApp();

  app.listen(env.port, () => {
    console.log(`Server running at ${env.clientUrl}`);
    console.log(`API docs at ${env.clientUrl}/api-docs`);
  });
}

module.exports = { createApp, connectDB, start };
