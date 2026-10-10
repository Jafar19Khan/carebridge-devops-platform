import pg from 'pg';
import bcrypt from 'bcryptjs';
const {Pool}=pg; const pool=new Pool({connectionString:process.env.DATABASE_URL});
if(process.env.SEED_INITIAL_DATA !== 'true'){console.log('Initial data seeding disabled');process.exit(0);}
const required=['BOOTSTRAP_ADMIN_EMAIL','BOOTSTRAP_ADMIN_PASSWORD','BOOTSTRAP_RECEPTION_EMAIL','BOOTSTRAP_RECEPTION_PASSWORD','BOOTSTRAP_PATIENT_EMAIL','BOOTSTRAP_PATIENT_PASSWORD','BOOTSTRAP_DOCTOR_PASSWORD'];
for(const key of required){if(!process.env[key]){console.error(`${key} is required when SEED_INITIAL_DATA=true`);process.exit(1)}}
const days=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()+i);return d.toISOString().slice(0,10)});
async function run(){
 const accounts=[
  ['Admin User',process.env.BOOTSTRAP_ADMIN_EMAIL,process.env.BOOTSTRAP_ADMIN_PASSWORD,'ADMIN'],
  ['Reception User',process.env.BOOTSTRAP_RECEPTION_EMAIL,process.env.BOOTSTRAP_RECEPTION_PASSWORD,'RECEPTION'],
  ['Dr. Sarah Johnson','sarah.johnson@carebridge.local',process.env.BOOTSTRAP_DOCTOR_PASSWORD,'DOCTOR'],
  ['Dr. Michael Chen','michael.chen@carebridge.local',process.env.BOOTSTRAP_DOCTOR_PASSWORD,'DOCTOR'],
  ['Dr. Priya Sharma','priya.sharma@carebridge.local',process.env.BOOTSTRAP_DOCTOR_PASSWORD,'DOCTOR'],
  ['Dr. Arjun Mehta','arjun.mehta@carebridge.local',process.env.BOOTSTRAP_DOCTOR_PASSWORD,'DOCTOR'],
  ['Dr. Ananya Rao','ananya.rao@carebridge.local',process.env.BOOTSTRAP_DOCTOR_PASSWORD,'DOCTOR'],
  ['Dr. Neha Kapoor','neha.kapoor@carebridge.local',process.env.BOOTSTRAP_DOCTOR_PASSWORD,'DOCTOR'],
  ['Bootstrap Patient',process.env.BOOTSTRAP_PATIENT_EMAIL,process.env.BOOTSTRAP_PATIENT_PASSWORD,'PATIENT']
 ];
 for(const [name,email,password,role] of accounts){const hash=await bcrypt.hash(password,12);await pool.query(`INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash,role=EXCLUDED.role`,[name,email.toLowerCase(),hash,role]);}
 await pool.query(`INSERT INTO clinics(name,address,city) VALUES('CareBridge Medical Centre','14 Lakeview Avenue, Andheri East','Mumbai') ON CONFLICT DO NOTHING`);
 const clinic=(await pool.query(`SELECT id FROM clinics WHERE name='CareBridge Medical Centre' LIMIT 1`)).rows[0].id;
 const docs=[
  ['Dr. Sarah Johnson','Cardiology','sarah.johnson@carebridge.local','12','4.9','184',850,750,'English,Hindi,Marathi','Heart health, preventive cardiology and hypertension care.'],
  ['Dr. Michael Chen','Dermatology','michael.chen@carebridge.local','9','4.8','126',700,650,'English,Hindi','Clinical dermatology, acne, eczema and skin health.'],
  ['Dr. Priya Sharma','General Medicine','priya.sharma@carebridge.local','11','4.9','241',600,550,'English,Hindi,Marathi','Primary care, preventive medicine and chronic condition management.'],
  ['Dr. Arjun Mehta','Orthopedics','arjun.mehta@carebridge.local','14','4.8','98',900,800,'English,Hindi','Sports injuries, joint pain and evidence-based rehabilitation.'],
  ['Dr. Ananya Rao','Pediatrics','ananya.rao@carebridge.local','8','4.9','157',650,600,'English,Hindi,Marathi','Child wellness, vaccinations and common pediatric conditions.'],
  ['Dr. Neha Kapoor','Mental Health','neha.kapoor@carebridge.local','10','4.9','203',800,700,'English,Hindi','Support for anxiety, stress, sleep and emotional wellbeing.']
 ];
 for(const [name,specialty,email,exp,rating,reviews,fee,online,languages,bio] of docs){
  const uid=(await pool.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id;
  await pool.query(`INSERT INTO doctors(user_id,name,specialty,email,experience_years,rating,review_count,consultation_fee,online_fee,languages,bio,clinic_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,specialty=EXCLUDED.specialty,user_id=EXCLUDED.user_id,experience_years=EXCLUDED.experience_years,rating=EXCLUDED.rating,review_count=EXCLUDED.review_count,consultation_fee=EXCLUDED.consultation_fee,online_fee=EXCLUDED.online_fee,languages=EXCLUDED.languages,bio=EXCLUDED.bio,clinic_id=EXCLUDED.clinic_id`,[uid,name,specialty,email,Number(exp),Number(rating),Number(reviews),fee,online,languages,bio,clinic]);
 }
 const doctorRows=(await pool.query('SELECT id FROM doctors ORDER BY id')).rows;
 for(const d of doctorRows){for(const date of days){for(const time of ['09:30','10:30','11:30','14:00','15:30','17:00']) await pool.query(`INSERT INTO doctor_slots(doctor_id,slot_date,slot_time,mode) VALUES($1,$2,$3,'BOTH') ON CONFLICT DO NOTHING`,[d.id,date,time]);}}
 const patient=(await pool.query('SELECT id FROM users WHERE email=$1',[process.env.BOOTSTRAP_PATIENT_EMAIL])).rows[0];
 const doctor=doctorRows[0];
 const existing=await pool.query('SELECT id FROM appointments WHERE patient_id=$1 LIMIT 1',[patient.id]);
 if(!existing.rows.length){const date=days[1];const ap=await pool.query(`INSERT INTO appointments(patient_id,doctor_id,clinic_id,appointment_date,appointment_time,reason,mode,status,payment_status) VALUES($1,$2,$3,$4,'10:30','Routine follow-up','CLINIC','CONFIRMED','PAY_AT_CLINIC') RETURNING id`,[patient.id,doctor.id,clinic,date]);await pool.query(`INSERT INTO payments(appointment_id,amount,method,status,reference) VALUES($1,850,'PAY_AT_CLINIC','PENDING',$2)`,[ap.rows[0].id,`CB-BOOTSTRAP-${Date.now()}`]);}
 await pool.query(`INSERT INTO notifications(user_id,title,message) SELECT id,'Welcome to CareBridge','Your account is ready. You can now discover verified doctors and book appointments.' FROM users WHERE email=$1 AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=users.id AND n.title='Welcome to CareBridge')`,[process.env.BOOTSTRAP_PATIENT_EMAIL]);
 console.log('CareBridge seed complete'); await pool.end();
}
run().catch(e=>{console.error(e);process.exit(1)});
