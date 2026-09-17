const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'queuecare-assessment-secret-change-me';

function createStore() {
  const staffPassword = bcrypt.hashSync('Staff123!', 10);
  return {
    users: [
      { id: 'u-staff', name: 'QueueCare Staff', email: 'staff@queuecare.test', passwordHash: staffPassword, role: 'staff' }
    ],
    appointments: [],
    nextUser: 1,
    nextAppointment: 1
  };
}

function createApp(store = createStore()) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(__dirname, 'public')));

  const today = () => new Date().toISOString().slice(0, 10);
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
  const isPast = value => value < today();
  const sign = user => jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '2h' });

  function auth(req, res, next) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET);
      if (!store.users.some(u => u.id === req.user.id)) throw new Error('unknown user');
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  function staffOnly(req, res, next) {
    if (!['staff', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'Staff access required' });
    next();
  }

  function publicAppointment(a) {
    const patient = store.users.find(u => u.id === a.patientId);
    return { ...a, patient: patient ? { id: patient.id, name: patient.name, email: patient.email } : null };
  }

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, role = 'patient' } = req.body || {};
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'name, email, password and role are required' });
    if (!['patient', 'staff', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const normalized = String(email).trim().toLowerCase();
    if (store.users.some(u => u.email === normalized)) return res.status(409).json({ error: 'Email already registered' });
    const user = { id: `u-${store.nextUser++}`, name: String(name).trim(), email: normalized, passwordHash: await bcrypt.hash(password, 10), role };
    store.users.push(user);
    res.status(201).json({ token: sign(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    const user = store.users.find(u => u.email === String(email || '').trim().toLowerCase());
    if (!user || !password || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: sign(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });

  app.get('/api/me', auth, (req, res) => {
    const user = store.users.find(u => u.id === req.user.id);
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  });

  app.post('/api/appointments', auth, (req, res) => {
    const { date, reason, doctor } = req.body || {};
    if (!date || !reason || !doctor) return res.status(400).json({ error: 'date, reason and doctor are required' });
    if (!validDate(date)) return res.status(400).json({ error: 'date must use YYYY-MM-DD format' });
    if (isPast(date)) return res.status(400).json({ error: 'Appointment date cannot be in the past' });
    const duplicate = store.appointments.some(a => a.patientId === req.user.id && a.date === date && a.status !== 'cancelled');
    if (duplicate) return res.status(409).json({ error: 'Patient already has an appointment on this date' });
    const queueNumber = store.appointments.filter(a => a.date === date && a.status !== 'cancelled').length + 1;
    const appointment = { id: `a-${store.nextAppointment++}`, patientId: req.user.id, date, reason: String(reason).trim(), doctor: String(doctor).trim(), queueNumber, status: 'scheduled', createdAt: new Date().toISOString() };
    store.appointments.push(appointment);
    res.status(201).json(publicAppointment(appointment));
  });

  app.get('/api/appointments', auth, (req, res) => {
    const items = req.user.role === 'patient' ? store.appointments.filter(a => a.patientId === req.user.id) : store.appointments;
    res.json(items.map(publicAppointment));
  });

  app.get('/api/appointments/today', auth, (req, res) => {
    if (req.user.role === 'patient') return res.status(403).json({ error: 'Staff access required' });
    res.json(store.appointments.filter(a => a.date === today() && a.status !== 'cancelled').sort((a, b) => a.queueNumber - b.queueNumber).map(publicAppointment));
  });

  app.get('/api/appointments/:id', auth, (req, res) => {
    const appointment = store.appointments.find(a => a.id === req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    if (req.user.role === 'patient' && appointment.patientId !== req.user.id) return res.status(403).json({ error: 'You can only access your own appointments' });
    res.json(publicAppointment(appointment));
  });

  app.put('/api/appointments/:id', auth, (req, res) => {
    const appointment = store.appointments.find(a => a.id === req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    if (req.user.role === 'patient' && appointment.patientId !== req.user.id) return res.status(403).json({ error: 'You can only update your own appointments' });
    if (appointment.status === 'cancelled') return res.status(409).json({ error: 'Cancelled appointment cannot be updated' });
    const date = req.body.date ?? appointment.date;
    const reason = req.body.reason ?? appointment.reason;
    const doctor = req.body.doctor ?? appointment.doctor;
    if (!date || !reason || !doctor) return res.status(400).json({ error: 'date, reason and doctor are required' });
    if (!validDate(date)) return res.status(400).json({ error: 'date must use YYYY-MM-DD format' });
    if (isPast(date)) return res.status(400).json({ error: 'Appointment date cannot be in the past' });
    if (date !== appointment.date && store.appointments.some(a => a.id !== appointment.id && a.patientId === appointment.patientId && a.date === date && a.status !== 'cancelled')) return res.status(409).json({ error: 'Patient already has an appointment on this date' });
    appointment.date = date;
    appointment.reason = String(reason).trim();
    appointment.doctor = String(doctor).trim();
    if (date !== appointment.date) appointment.queueNumber = store.appointments.filter(a => a.date === date && a.status !== 'cancelled').length;
    res.json(publicAppointment(appointment));
  });

  app.delete('/api/appointments/:id', auth, (req, res) => {
    const appointment = store.appointments.find(a => a.id === req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    if (req.user.role === 'patient' && appointment.patientId !== req.user.id) return res.status(403).json({ error: 'You can only cancel your own appointments' });
    if (appointment.status === 'cancelled') return res.status(409).json({ error: 'Appointment is already cancelled' });
    appointment.status = 'cancelled';
    res.json(publicAppointment(appointment));
  });

  app.patch('/api/appointments/:id/serve', auth, staffOnly, (req, res) => {
    const appointment = store.appointments.find(a => a.id === req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    if (appointment.status === 'served') return res.status(409).json({ error: 'Appointment is already served' });
    if (appointment.status === 'cancelled') return res.status(409).json({ error: 'Cancelled appointment cannot be served' });
    appointment.status = 'served';
    res.json(publicAppointment(appointment));
  });

  if (process.env.NODE_ENV === 'test') {
    app.post('/api/test/reset', (req, res) => {
      const fresh = createStore();
      store.users = fresh.users;
      store.appointments = fresh.appointments;
      store.nextUser = fresh.nextUser;
      store.nextAppointment = fresh.nextAppointment;
      res.json({ status: 'reset' });
    });
  }

  app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, () => console.log(`QueueCare running on http://localhost:${port}`));
}

module.exports = { createApp, createStore };
