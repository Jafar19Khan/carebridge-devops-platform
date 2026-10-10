import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import crypto from 'node:crypto';

const { Pool } = pg;
const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || '';

if (JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
const query = (sql, params = []) => pool.query(sql, params);
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const emailOk = (v) => typeof v === 'string' && /^\S+@\S+\.\S+$/.test(v);
const dateOk = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const timeOk = (v) => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);
const roles = (...allowed) => (req, res, next) => allowed.includes(req.user.role) ? next() : res.status(403).json({ message: 'Forbidden' });

app.disable('x-powered-by');
app.use((req, res, next) => {
  const id = req.get('X-Request-ID') || crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
const origins = (process.env.CORS_ORIGIN || 'http://localhost').split(',').map((x) => x.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => !origin || origins.includes(origin) ? cb(null, true) : cb(new Error('CORS origin denied')),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));
app.use(express.json({ limit: '1mb', strict: true }));

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ message: 'Invalid or expired token' }); }
}
function publicUser(user) { return { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone || '' }; }
function signUser(user) { return jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role, jti: crypto.randomUUID() }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }); }
async function login(req, res, allowedRoles) {
  const { email, password } = req.body || {};
  if (!emailOk(email) || typeof password !== 'string' || !password) return res.status(400).json({ message: 'Email and password are required' });
  const result = await query('SELECT * FROM users WHERE email=$1', [email.toLowerCase().trim()]);
  const user = result.rows[0];
  if (!user || !allowedRoles.includes(user.role) || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ message: 'Invalid email or password' });
  return res.json({ token: signUser(user), user: publicUser(user) });
}

app.get('/health', asyncRoute(async (_req, res) => { await query('SELECT 1'); res.json({ status: 'ok', service: 'carebridge-api', database: 'ok', timestamp: new Date().toISOString() }); }));
app.get('/ready', asyncRoute(async (_req, res) => { await query('SELECT 1'); res.json({ ready: true }); }));

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const { name, email, password, phone = '' } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || !emailOk(email) || typeof password !== 'string' || password.length < 8) return res.status(400).json({ message: 'Name, valid email and password of at least 8 characters are required' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await query("INSERT INTO users(name,email,password_hash,role,phone) VALUES($1,$2,$3,'PATIENT',$4) RETURNING id,name,email,role,phone", [name.trim(), email.toLowerCase().trim(), hash, phone]);
    res.status(201).json(publicUser(result.rows[0]));
  } catch (e) { if (e.code === '23505') return res.status(409).json({ message: 'An account with this email already exists' }); throw e; }
}));
app.post('/api/auth/login', asyncRoute((req, res) => login(req, res, ['PATIENT'])));
app.post('/api/auth/admin-login', asyncRoute((req, res) => login(req, res, ['ADMIN', 'RECEPTION'])));
app.post('/api/auth/doctor-login', asyncRoute((req, res) => login(req, res, ['DOCTOR'])));
app.post('/api/auth/logout', auth, (_req, res) => res.json({ success: true }));
app.get('/api/me', auth, (req, res) => res.json({ user: req.user }));

app.get('/api/specialties', asyncRoute(async (_req, res) => {
  const result = await query('SELECT DISTINCT specialty FROM doctors WHERE available=true ORDER BY specialty');
  res.json(result.rows.map((r) => r.specialty));
}));
app.get('/api/doctors', auth, asyncRoute(async (req, res) => {
  const { q: term = '', specialty = '', city = '', mode = '' } = req.query;
  const params = [];
  const where = [];
  if (term) { params.push(`%${term}%`); where.push(`(d.name ILIKE $${params.length} OR d.specialty ILIKE $${params.length})`); }
  if (specialty) { params.push(specialty); where.push(`d.specialty=$${params.length}`); }
  if (city) { params.push(`%${city}%`); where.push(`c.city ILIKE $${params.length}`); }
  if (mode) where.push(`EXISTS (SELECT 1 FROM doctor_slots sx WHERE sx.doctor_id=d.id AND sx.mode IN ($${params.push(mode)}, 'BOTH'))`);
  const result = await query(`SELECT d.id,d.name,d.specialty,d.email,d.bio,d.experience_years,d.rating,d.review_count,d.consultation_fee,d.online_fee,d.languages,d.available,d.verified,c.name clinic_name,c.address clinic_address,c.city FROM doctors d LEFT JOIN clinics c ON c.id=d.clinic_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY d.rating DESC,d.review_count DESC,d.name`, params);
  res.json(result.rows);
}));
app.get('/api/doctors/:id', auth, asyncRoute(async (req, res) => {
  const result = await query('SELECT d.*,c.name clinic_name,c.address clinic_address,c.city FROM doctors d LEFT JOIN clinics c ON c.id=d.clinic_id WHERE d.id=$1', [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ message: 'Doctor not found' });
  res.json(result.rows[0]);
}));
app.get('/api/doctors/:id/slots', auth, asyncRoute(async (req, res) => {
  if (!dateOk(req.query.date)) return res.status(400).json({ message: 'Valid date is required' });
  const result = await query(`SELECT s.id,s.slot_time,s.mode,CASE WHEN a.id IS NULL THEN true ELSE false END available FROM doctor_slots s LEFT JOIN appointments a ON a.doctor_id=s.doctor_id AND a.appointment_date=s.slot_date AND a.appointment_time=s.slot_time AND a.status<>'CANCELLED' WHERE s.doctor_id=$1 AND s.slot_date=$2 ORDER BY s.slot_time`, [req.params.id, req.query.date]);
  res.json(result.rows);
}));

app.post('/api/appointments', auth, asyncRoute(async (req, res) => {
  if (req.user.role !== 'PATIENT') return res.status(403).json({ message: 'Only patients can create appointments' });
  const { doctor_id, appointment_date, appointment_time, reason = '', mode = 'CLINIC', payment_method = 'PAY_AT_CLINIC' } = req.body || {};
  if (!doctor_id || !dateOk(appointment_date) || !timeOk(appointment_time) || !['CLINIC', 'ONLINE'].includes(mode) || !['ONLINE', 'PAY_AT_CLINIC'].includes(payment_method)) return res.status(400).json({ message: 'Please complete all booking details' });
  if (appointment_date < new Date().toISOString().slice(0, 10)) return res.status(400).json({ message: 'Appointments cannot be booked in the past' });
  const slotResult = await query(`SELECT s.id,s.mode,d.id doctor_id,d.clinic_id,d.name,d.consultation_fee,d.online_fee FROM doctor_slots s JOIN doctors d ON d.id=s.doctor_id WHERE s.doctor_id=$1 AND s.slot_date=$2 AND s.slot_time=$3 AND d.available=true`, [doctor_id, appointment_date, appointment_time]);
  const slot = slotResult.rows[0];
  if (!slot) return res.status(409).json({ message: 'That slot is no longer available' });
  if (slot.mode !== 'BOTH' && slot.mode !== mode) return res.status(409).json({ message: `This slot is available only for ${slot.mode === 'ONLINE' ? 'online consultation' : 'clinic visit'}` });
  const amount = mode === 'ONLINE' ? slot.online_fee : slot.consultation_fee;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const appointment = await client.query(`INSERT INTO appointments(patient_id,doctor_id,clinic_id,appointment_date,appointment_time,reason,mode,status,payment_status) VALUES($1,$2,$3,$4,$5,$6,$7,'CONFIRMED',$8) RETURNING *`, [req.user.id, doctor_id, slot.clinic_id, appointment_date, appointment_time, reason.trim(), mode, payment_method === 'PAY_AT_CLINIC' ? 'PAY_AT_CLINIC' : 'PENDING']);
    await client.query(`INSERT INTO payments(appointment_id,amount,method,status,reference) VALUES($1,$2,$3,'PENDING',$4)`, [appointment.rows[0].id, amount, payment_method, `CB-${Date.now()}`]);
    await client.query(`INSERT INTO notifications(user_id,title,message) VALUES($1,'Appointment confirmed',$2)`, [req.user.id, `Your ${mode === 'ONLINE' ? 'online consultation' : 'clinic visit'} with ${slot.name} is confirmed for ${appointment_date} at ${appointment_time}.`]);
    await client.query('COMMIT');
    res.status(201).json({ appointment: appointment.rows[0], amount });
  } catch (e) { await client.query('ROLLBACK'); if (e.code === '23505') return res.status(409).json({ message: 'That slot was just booked by another patient' }); throw e; }
  finally { client.release(); }
}));
app.get('/api/appointments', auth, asyncRoute(async (req, res) => {
  const params = []; let where = '';
  if (req.user.role === 'PATIENT') { params.push(req.user.id); where = 'WHERE a.patient_id=$1'; }
  else if (req.user.role === 'DOCTOR') { const d = await query('SELECT id FROM doctors WHERE user_id=$1', [req.user.id]); if (!d.rows[0]) return res.json([]); params.push(d.rows[0].id); where = 'WHERE a.doctor_id=$1'; }
  const result = await query(`SELECT a.*,d.name doctor_name,d.specialty,u.name patient_name,u.email patient_email,c.name clinic_name FROM appointments a JOIN doctors d ON d.id=a.doctor_id JOIN users u ON u.id=a.patient_id LEFT JOIN clinics c ON c.id=a.clinic_id ${where} ORDER BY a.appointment_date ASC,a.appointment_time ASC`, params);
  res.json(result.rows);
}));
app.put('/api/appointments/:id/status', auth, asyncRoute(async (req, res) => {
  const next = req.body?.status; if (!['BOOKED','CONFIRMED','COMPLETED','CANCELLED'].includes(next)) return res.status(400).json({ message: 'Invalid appointment status' });
  let result;
  if (req.user.role === 'PATIENT') {
    if (next !== 'CANCELLED') return res.status(403).json({ message: 'Patients can only cancel appointments' });
    result = await query("UPDATE appointments SET status='CANCELLED' WHERE id=$1 AND patient_id=$2 AND status IN ('BOOKED','CONFIRMED') RETURNING *", [req.params.id, req.user.id]);
  } else if (req.user.role === 'DOCTOR') {
    const d = await query('SELECT id FROM doctors WHERE user_id=$1', [req.user.id]); if (!d.rows[0]) return res.status(403).json({ message: 'Provider profile not found' });
    result = await query('UPDATE appointments SET status=$1 WHERE id=$2 AND doctor_id=$3 RETURNING *', [next, req.params.id, d.rows[0].id]);
  } else {
    result = await query('UPDATE appointments SET status=$1 WHERE id=$2 RETURNING *', [next, req.params.id]);
  }
  if (!result.rows[0]) return res.status(404).json({ message: 'Appointment not found or action not permitted' });
  res.json(result.rows[0]);
}));

app.get('/api/payments', auth, roles('ADMIN','RECEPTION'), asyncRoute(async (_req, res) => { const r = await query(`SELECT p.*,a.appointment_date,a.appointment_time,u.name patient_name,d.name doctor_name FROM payments p JOIN appointments a ON a.id=p.appointment_id JOIN users u ON u.id=a.patient_id JOIN doctors d ON d.id=a.doctor_id ORDER BY p.created_at DESC`); res.json(r.rows); }));
app.put('/api/payments/:id/status', auth, roles('ADMIN','RECEPTION'), asyncRoute(async (req, res) => { const status = req.body?.status; if (!['PAID','FAILED','REFUNDED'].includes(status)) return res.status(400).json({ message: 'Invalid payment status' }); const r = await query('UPDATE payments SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]); if (!r.rows[0]) return res.status(404).json({ message: 'Payment not found' }); await query('UPDATE appointments SET payment_status=$1 WHERE id=$2', [status === 'PAID' ? 'PAID' : status, r.rows[0].appointment_id]); res.json(r.rows[0]); }));
app.post('/api/payments/local-settle/:appointmentId', auth, roles('PATIENT'), asyncRoute(async (req, res) => { if (process.env.PAYMENT_MODE !== 'local') return res.status(404).json({ message: 'Online payment provider is not configured' }); const r = await query(`SELECT p.id FROM payments p JOIN appointments a ON a.id=p.appointment_id WHERE p.appointment_id=$1 AND a.patient_id=$2`, [req.params.appointmentId, req.user.id]); if (!r.rows[0]) return res.status(404).json({ message: 'Payment not found' }); await query("UPDATE payments SET status='PAID',reference=$1 WHERE id=$2", [`CB-LOCAL-${Date.now()}`, r.rows[0].id]); await query("UPDATE appointments SET payment_status='PAID' WHERE id=$1", [req.params.appointmentId]); res.json({ status: 'PAID' }); }));

app.get('/api/notifications', auth, asyncRoute(async (req, res) => { const r = await query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [req.user.id]); res.json(r.rows); }));
app.get('/api/dashboard', auth, roles('ADMIN','RECEPTION'), asyncRoute(async (_req, res) => { const [d,a,p,u,paid] = await Promise.all([query("SELECT COUNT(*)::int count FROM doctors WHERE available"),query('SELECT COUNT(*)::int count FROM appointments'),query("SELECT COUNT(*)::int count FROM users WHERE role='PATIENT'"),query("SELECT COUNT(*)::int count FROM appointments WHERE appointment_date>=CURRENT_DATE AND status IN ('BOOKED','CONFIRMED')"),query("SELECT COALESCE(SUM(amount),0)::int total FROM payments WHERE status='PAID'")]); res.json({ doctors:d.rows[0].count, appointments:a.rows[0].count, patients:p.rows[0].count, upcoming:u.rows[0].count, revenue:paid.rows[0].total }); }));
app.get('/api/users', auth, roles('ADMIN','RECEPTION'), asyncRoute(async (_req, res) => { const r = await query('SELECT id,name,email,role,phone,created_at FROM users ORDER BY created_at DESC'); res.json(r.rows); }));

app.post('/api/doctors', auth, roles('ADMIN','RECEPTION'), asyncRoute(async (req, res) => {
  const { name, specialty, email, password, experience_years=5, consultation_fee=500, online_fee=500, bio='', phone='', languages='English,Hindi' } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || typeof specialty !== 'string' || !specialty.trim() || !emailOk(email) || typeof password !== 'string' || password.length < 8) return res.status(400).json({ message: 'Name, specialty, valid email and password of at least 8 characters are required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query("INSERT INTO users(name,email,password_hash,role,phone) VALUES($1,$2,$3,'DOCTOR',$4) RETURNING id,name,email,role,phone", [name.trim(), email.toLowerCase().trim(), await bcrypt.hash(password, 12), phone]);
    const doctor = await client.query(`INSERT INTO doctors(user_id,name,specialty,email,experience_years,consultation_fee,online_fee,bio,phone,languages) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [user.rows[0].id,name.trim(),specialty.trim(),email.toLowerCase().trim(),Number(experience_years),Number(consultation_fee),Number(online_fee),bio,phone,languages]);
    await client.query('COMMIT'); res.status(201).json({ ...doctor.rows[0], login_email: user.rows[0].email });
  } catch (e) { await client.query('ROLLBACK'); if (e.code === '23505') return res.status(409).json({ message: 'A user or doctor with this email already exists' }); throw e; } finally { client.release(); }
}));
app.post('/api/doctors/:id/slots', auth, roles('ADMIN','RECEPTION','DOCTOR'), asyncRoute(async (req, res) => {
  const { slot_date, slot_time, mode='BOTH' } = req.body || {};
  if (!dateOk(slot_date) || !timeOk(slot_time) || !['CLINIC','ONLINE','BOTH'].includes(mode)) return res.status(400).json({ message: 'Valid date, time and mode are required' });
  if (req.user.role === 'DOCTOR') { const d = await query('SELECT id FROM doctors WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]); if (!d.rows[0]) return res.status(403).json({ message: 'You can manage only your own availability' }); }
  try { const r = await query('INSERT INTO doctor_slots(doctor_id,slot_date,slot_time,mode) VALUES($1,$2,$3,$4) RETURNING *', [req.params.id,slot_date,slot_time,mode]); res.status(201).json(r.rows[0]); } catch (e) { if (e.code === '23505') return res.status(409).json({ message: 'That availability slot already exists' }); throw e; }
}));
app.delete('/api/doctors/:id/slots/:slotId', auth, roles('ADMIN','RECEPTION','DOCTOR'), asyncRoute(async (req, res) => {
  if (req.user.role === 'DOCTOR') { const d = await query('SELECT id FROM doctors WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]); if (!d.rows[0]) return res.status(403).json({ message: 'Forbidden' }); }
  const r = await query('DELETE FROM doctor_slots WHERE id=$1 AND doctor_id=$2 RETURNING id', [req.params.slotId, req.params.id]); if (!r.rows[0]) return res.status(404).json({ message: 'Slot not found' }); res.json({ success:true });
}));
app.patch('/api/doctors/:id', auth, roles('ADMIN','RECEPTION','DOCTOR'), asyncRoute(async (req, res) => {
  if (req.user.role === 'DOCTOR') { const d = await query('SELECT id FROM doctors WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]); if (!d.rows[0]) return res.status(403).json({ message: 'Forbidden' }); }
  const { available } = req.body || {}; if (typeof available !== 'boolean') return res.status(400).json({ message: 'available must be boolean' }); const r = await query('UPDATE doctors SET available=$1 WHERE id=$2 RETURNING *',[available,req.params.id]); if(!r.rows[0]) return res.status(404).json({message:'Doctor not found'}); res.json(r.rows[0]);
}));
app.delete('/api/doctors/:id', auth, roles('ADMIN'), asyncRoute(async (req, res) => { const r = await query('DELETE FROM doctors WHERE id=$1 RETURNING user_id',[req.params.id]); if (!r.rows[0]) return res.status(404).json({ message: 'Doctor not found' }); if (r.rows[0].user_id) await query('DELETE FROM users WHERE id=$1',[r.rows[0].user_id]); res.json({ message: 'Doctor deleted' }); }));

app.use((err, req, res, _next) => { console.error(JSON.stringify({ requestId:req.requestId, error:err?.message, method:req.method, path:req.path })); res.status(err?.message === 'CORS origin denied' ? 403 : 500).json({ success:false, error:{ code:err?.message === 'CORS origin denied' ? 'CORS_DENIED' : 'INTERNAL_ERROR', message:err?.message === 'CORS origin denied' ? 'Origin not allowed' : 'An unexpected error occurred.', requestId:req.requestId } }); });

async function start() { for (let i=0;i<20;i++) { try { await query('SELECT 1'); break; } catch (e) { if (i===19) throw e; await new Promise(r=>setTimeout(r,1200)); } } app.listen(PORT,()=>console.log(`CareBridge API listening on ${PORT}`)); }
start().catch(e=>{console.error('Startup failed',e);process.exit(1)});
process.on('SIGTERM',async()=>{await pool.end();process.exit(0)});
