import sql from "@/app/api/utils/sql";
export async function GET() {
  try {
    const res = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`;
    return Response.json({ tables: res.map(r => r.table_name) });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
