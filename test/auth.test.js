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

async function registerAndLogin(overrides = {}) {
  const user = {
    username: 'alice',
    email: 'alice@example.com',
    password: 'secret123',
    ...overrides
  };
  await requestJson('/api/auth/register', 'POST', user);
  return requestJson('/api/auth/login', 'POST', { username: user.username, password: user.password });
}

test('register creates an unverified user', async () => {
  const res = await requestJson('/api/auth/register', 'POST', {
    username: 'alice',
    email: 'alice@example.com',
    password: 'secret123'
  });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.user.username, 'alice');
  assert.equal(res.body.user.isEmailVerified, false);
  assert.ok(res.body.devVerificationToken, 'expected dev verification token in test mode');
});

test('register rejects a weak password', async () => {
  const res = await requestJson('/api/auth/register', 'POST', {
    username: 'bob',
    email: 'bob@example.com',
    password: 'short'
  });

  assert.equal(res.statusCode, 400);
});

test('register rejects duplicate username', async () => {
  await requestJson('/api/auth/register', 'POST', { username: 'alice', email: 'a1@example.com', password: 'secret123' });
  const res = await requestJson('/api/auth/register', 'POST', { username: 'alice', email: 'a2@example.com', password: 'secret123' });

  assert.equal(res.statusCode, 409);
});

test('verify-email marks the account verified', async () => {
  const registerRes = await requestJson('/api/auth/register', 'POST', {
    username: 'alice',
    email: 'alice@example.com',
    password: 'secret123'
  });

  const verifyRes = await requestJson(`/api/auth/verify-email/${registerRes.body.devVerificationToken}`, 'GET');
  assert.equal(verifyRes.statusCode, 200);

  const user = await User.findOne({ username: 'alice' });
  assert.equal(user.isEmailVerified, true);
});

test('login succeeds with correct credentials and fails with wrong password', async () => {
  const loginRes = await registerAndLogin();
  assert.equal(loginRes.statusCode, 200);
  assert.ok(loginRes.body.accessToken);
  assert.ok(loginRes.body.refreshToken);

  const badLogin = await requestJson('/api/auth/login', 'POST', { username: 'alice', password: 'wrongpass' });
  assert.equal(badLogin.statusCode, 401);
});

test('GET /api/users/me requires a valid access token', async () => {
  const unauthenticated = await requestJson('/api/users/me', 'GET');
  assert.equal(unauthenticated.statusCode, 401);

  const loginRes = await registerAndLogin();
  const authenticated = await requestJson('/api/users/me', 'GET', null, loginRes.body.accessToken);
  assert.equal(authenticated.statusCode, 200);
  assert.equal(authenticated.body.user.username, 'alice');
});

test('refresh token rotates and old refresh token becomes invalid', async () => {
  const loginRes = await registerAndLogin();
  const oldRefreshToken = loginRes.body.refreshToken;

  const refreshRes = await requestJson('/api/auth/refresh', 'POST', { refreshToken: oldRefreshToken });
  assert.equal(refreshRes.statusCode, 200);
  assert.ok(refreshRes.body.accessToken);
  assert.notEqual(refreshRes.body.refreshToken, oldRefreshToken);

  const reuseRes = await requestJson('/api/auth/refresh', 'POST', { refreshToken: oldRefreshToken });
  assert.equal(reuseRes.statusCode, 401);
});

test('logout revokes the refresh token', async () => {
  const loginRes = await registerAndLogin();

  const logoutRes = await requestJson('/api/auth/logout', 'POST', { refreshToken: loginRes.body.refreshToken });
  assert.equal(logoutRes.statusCode, 200);

  const refreshRes = await requestJson('/api/auth/refresh', 'POST', { refreshToken: loginRes.body.refreshToken });
  assert.equal(refreshRes.statusCode, 401);
});

test('forgot-password + reset-password lets a user set a new password', async () => {
  await registerAndLogin();

  const forgotRes = await requestJson('/api/auth/forgot-password', 'POST', { email: 'alice@example.com' });
  assert.equal(forgotRes.statusCode, 200);
  assert.ok(forgotRes.body.devResetToken);

  const resetRes = await requestJson(`/api/auth/reset-password/${forgotRes.body.devResetToken}`, 'POST', {
    password: 'newpassword123'
  });
  assert.equal(resetRes.statusCode, 200);

  const oldLogin = await requestJson('/api/auth/login', 'POST', { username: 'alice', password: 'secret123' });
  assert.equal(oldLogin.statusCode, 401);

  const newLogin = await requestJson('/api/auth/login', 'POST', { username: 'alice', password: 'newpassword123' });
  assert.equal(newLogin.statusCode, 200);
});

test('role-based access: admin-only route rejects a normal user and allows an admin', async () => {
  const userLogin = await registerAndLogin();
  const forbidden = await requestJson('/api/users/admin-only', 'GET', null, userLogin.body.accessToken);
  assert.equal(forbidden.statusCode, 403);

  await User.create({ username: 'root', email: 'root@example.com', password: 'secret123', role: 'admin' });
  const adminLogin = await requestJson('/api/auth/login', 'POST', { username: 'root', password: 'secret123' });

  const allowed = await requestJson('/api/users/admin-only', 'GET', null, adminLogin.body.accessToken);
  assert.equal(allowed.statusCode, 200);
});
