import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL || '');
async function q(text: string) { const s = [text] as any; s.raw = [text]; return sql(s); }
async function main() {
  const r = await q(`SELECT id, name, city FROM universities WHERE name ILIKE '%UET%' OR name ILIKE '%University of Engineering%'`);
  for (const u of r) console.log(`"${u.name}" (${u.city}) [${u.id}]`);
}
main().catch(e => console.log(e.message));
