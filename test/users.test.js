const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');

const { createApp, connectDB } = require('../src/server');
const User = require('../src/models/User');

let server;
let baseUrl;

test.before(async () => {
  await connectDB();
  await mongoose.connection.dropDatabase();

  const app = createApp();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test.beforeEach(async () => {
  await User.deleteMany({});
});

function requestJson(path, method, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data ? JSON.parse(data) : {} }));
    });

    req.on('error', reject);
    req.write(body ? JSON.stringify(body) : '');
    req.end();
  });
}

async function createAndLogin({ username, email, password = 'secret123', role = 'user' }) {
  await User.create({ username, email, password, role });
  return requestJson('/api/auth/login', 'POST', { username, password });
}

test('GET /api/users lists users for an admin and is forbidden for a normal user', async () => {
  await createAndLogin({ username: 'alice', email: 'alice@example.com' });
  const adminLogin = await createAndLogin({ username: 'root', email: 'root@example.com', role: 'admin' });

  const forbidden = await requestJson('/api/users', 'GET');
  assert.equal(forbidden.statusCode, 401);

  const allowed = await requestJson('/api/users', 'GET', null, adminLogin.body.accessToken);
  assert.equal(allowed.statusCode, 200);
  assert.equal(allowed.body.users.length, 2);
});

test('GET /api/users/:id returns a user for an admin, 404 for unknown id', async () => {
  const userLogin = await createAndLogin({ username: 'alice', email: 'alice@example.com' });
  const adminLogin = await createAndLogin({ username: 'root', email: 'root@example.com', role: 'admin' });
  const alice = await User.findOne({ username: 'alice' });

  const found = await requestJson(`/api/users/${alice._id}`, 'GET', null, adminLogin.body.accessToken);
  assert.equal(found.statusCode, 200);
  assert.equal(found.body.user.username, 'alice');

  const missing = await requestJson('/api/users/000000000000000000000000', 'GET', null, adminLogin.body.accessToken);
  assert.equal(missing.statusCode, 404);

  const forbidden = await requestJson(`/api/users/${alice._id}`, 'GET', null, userLogin.body.accessToken);
  assert.equal(forbidden.statusCode, 403);
});

test('PATCH /api/users/:id/role updates a role and rejects invalid roles', async () => {
  const adminLogin = await createAndLogin({ username: 'root', email: 'root@example.com', role: 'admin' });
  await createAndLogin({ username: 'alice', email: 'alice@example.com' });
  const alice = await User.findOne({ username: 'alice' });

  const invalid = await requestJson(`/api/users/${alice._id}/role`, 'PATCH', { role: 'superadmin' }, adminLogin.body.accessToken);
  assert.equal(invalid.statusCode, 400);

  const promoted = await requestJson(`/api/users/${alice._id}/role`, 'PATCH', { role: 'admin' }, adminLogin.body.accessToken);
  assert.equal(promoted.statusCode, 200);
  assert.equal(promoted.body.user.role, 'admin');
});

test('DELETE /api/users/:id removes a user', async () => {
  const adminLogin = await createAndLogin({ username: 'root', email: 'root@example.com', role: 'admin' });
  await createAndLogin({ username: 'alice', email: 'alice@example.com' });
  const alice = await User.findOne({ username: 'alice' });

  const deleted = await requestJson(`/api/users/${alice._id}`, 'DELETE', null, adminLogin.body.accessToken);
  assert.equal(deleted.statusCode, 200);

  const remaining = await User.findById(alice._id);
  assert.equal(remaining, null);
});
