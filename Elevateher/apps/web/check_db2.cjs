const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.connect().then(async (client) => {
    const res = await client.query('SELECT * FROM auth_accounts WHERE "userId" = (SELECT id FROM auth_users WHERE email = \'dewi.mentor@demo.elevateher.app\')');
    console.log(res.rows); pool.end(); client.release();
  })
  .catch(err => { console.error(err); pool.end(); });
