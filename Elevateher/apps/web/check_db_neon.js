import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
async function check() {
  const res = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`;
  console.log(res.map(r => r.table_name));
}
check().catch(console.error);
