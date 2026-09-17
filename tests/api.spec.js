const { test, expect } = require('@playwright/test');

const future = days => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0,10); };
const past = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0,10); };

async function reset(request) {
  const r = await request.post('/api/test/reset');
  expect(r.ok()).toBeTruthy();
}
async function register(request, name, email, role='patient') {
  const r = await request.post('/api/auth/register', { data: { name, email, password: 'Pass123!', role } });
  expect(r.status()).toBe(201);
  return (await r.json()).token;
}
async function login(request, email, password='Pass123!') {
  const r = await request.post('/api/auth/login', { data: { email, password } });
  return r;
}
async function book(request, token, date=future(1), reason='Checkup', doctor='Dr. Uwase') {
  return request.post('/api/appointments', { headers: { Authorization: `Bearer ${token}` }, data: { date, reason, doctor } });
}

 test.describe('QueueCare API', () => {
  test.beforeEach(async ({ request }) => reset(request));

  test('register -> login returns a valid token', async ({ request }) => {
    await register(request, 'Alice', 'alice@test.local');
    const response = await login(request, 'alice@test.local');
    expect(response.status()).toBe(200);
    expect((await response.json()).token).toBeTruthy();
  });

  test('creates an appointment and assigns a queue number', async ({ request }) => {
    const token = await register(request, 'Alice', 'alice@test.local');
    const response = await book(request, token);
    expect(response.status()).toBe(201);
    expect((await response.json()).queueNumber).toBe(1);
  });

  test('patient sees only their appointments', async ({ request }) => {
    const alice = await register(request, 'Alice', 'alice@test.local');
    const bob = await register(request, 'Bob', 'bob@test.local');
    await book(request, alice); await book(request, bob, future(2));
    const response = await request.get('/api/appointments', { headers: { Authorization: `Bearer ${alice}` } });
    const items = await response.json();
    expect(items).toHaveLength(1); expect(items[0].patient.email).toBe('alice@test.local');
  });

  test('staff can fetch all appointments and serve a patient', async ({ request }) => {
    const patient = await register(request, 'Alice', 'alice@test.local');
    const appointment = await book(request, patient);
    const staff = (await login(request, 'staff@queuecare.test', 'Staff123!')).json ? (await (await login(request, 'staff@queuecare.test', 'Staff123!')).json()).token : null;
    const all = await request.get('/api/appointments', { headers: { Authorization: `Bearer ${staff}` } });
    expect((await all.json())).toHaveLength(1);
    const served = await request.patch(`/api/appointments/${(await appointment.json()).id}/serve`, { headers: { Authorization: `Bearer ${staff}` } });
    expect(served.status()).toBe(200); expect((await served.json()).status).toBe('served');
  });

  test('fetches a single appointment by id', async ({ request }) => {
    const token = await register(request, 'Alice', 'alice@test.local');
    const appointment = await book(request, token);
    const id = (await appointment.json()).id;
    const response = await request.get(`/api/appointments/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(response.status()).toBe(200); expect((await response.json()).id).toBe(id);
  });

  test('wrong password returns 401', async ({ request }) => {
    await register(request, 'Alice', 'alice@test.local');
    expect((await login(request, 'alice@test.local', 'wrong')).status()).toBe(401);
  });

  test('non-existent email returns 401', async ({ request }) => {
    expect((await login(request, 'missing@test.local')).status()).toBe(401);
  });

  test('missing appointment fields returns 400', async ({ request }) => {
    const token = await register(request, 'Alice', 'alice@test.local');
    const response = await request.post('/api/appointments', { headers: { Authorization: `Bearer ${token}` }, data: { date: future(1) } });
    expect(response.status()).toBe(400);
  });

  test('protected endpoints reject missing and invalid tokens', async ({ request }) => {
    expect((await request.get('/api/appointments')).status()).toBe(401);
    expect((await request.get('/api/appointments', { headers: { Authorization: 'Bearer bad-token' } })).status()).toBe(401);
  });

  test('patient cannot access another patient appointment or serve', async ({ request }) => {
    const alice = await register(request, 'Alice', 'alice@test.local');
    const bob = await register(request, 'Bob', 'bob@test.local');
    const appointment = await book(request, bob);
    const id = (await appointment.json()).id;
    expect((await request.get(`/api/appointments/${id}`, { headers: { Authorization: `Bearer ${alice}` } })).status()).toBe(403);
    expect((await request.patch(`/api/appointments/${id}/serve`, { headers: { Authorization: `Bearer ${alice}` } })).status()).toBe(403);
  });

  test('missing appointment id returns 404', async ({ request }) => {
    const token = await register(request, 'Alice', 'alice@test.local');
    expect((await request.get('/api/appointments/a-missing', { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(404);
  });

  test('past dates and invalid date format are rejected', async ({ request }) => {
    const token = await register(request, 'Alice', 'alice@test.local');
    expect((await book(request, token, past())).status()).toBe(400);
    expect((await book(request, token, 'tomorrow')).status()).toBe(400);
  });

  test('duplicate same-day booking is rejected', async ({ request }) => {
    const token = await register(request, 'Alice', 'alice@test.local');
    await book(request, token, future(2));
    expect((await book(request, token, future(2))).status()).toBe(409);
  });

  test('rescheduling to a past date is rejected', async ({ request }) => {
    const token = await register(request, 'Alice', 'alice@test.local');
    const created = await book(request, token); const id = (await created.json()).id;
    const response = await request.put(`/api/appointments/${id}`, { headers: { Authorization: `Bearer ${token}` }, data: { date: past(), reason: 'Updated', doctor: 'Dr. New' } });
    expect(response.status()).toBe(400);
  });

  test('cancel twice is handled and same-day rebooking is allowed', async ({ request }) => {
    const token = await register(request, 'Alice', 'alice@test.local');
    const created = await book(request, token, future(3)); const id = (await created.json()).id;
    expect((await request.delete(`/api/appointments/${id}`, { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(200);
    expect((await request.delete(`/api/appointments/${id}`, { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(409);
    expect((await book(request, token, future(3))).status()).toBe(201);
  });

  test('serving an appointment twice is handled gracefully', async ({ request }) => {
    const patient = await register(request, 'Alice', 'alice@test.local');
    const created = await book(request, patient); const id = (await created.json()).id;
    const staffLogin = await login(request, 'staff@queuecare.test', 'Staff123!');
    const staff = (await staffLogin.json()).token;
    expect((await request.patch(`/api/appointments/${id}/serve`, { headers: { Authorization: `Bearer ${staff}` } })).status()).toBe(200);
    expect((await request.patch(`/api/appointments/${id}/serve`, { headers: { Authorization: `Bearer ${staff}` } })).status()).toBe(409);
  });
});
