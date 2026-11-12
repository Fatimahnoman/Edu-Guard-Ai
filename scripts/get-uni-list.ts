import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || '');
async function q(text: string) {
  const strings = [text] as any;
  strings.raw = [text];
  return sql(strings);
}

async function main() {
  // Get all Pakistani universities without AI admission data
  const unis = await q(`SELECT id, name, city, sector, type FROM universities WHERE country = 'Pakistan' AND admission_process IS NULL ORDER BY name`);
  console.log(`Total without AI data: ${unis.length}\n`);
  for (const u of unis) {
    console.log(`${u.id}|${u.name}|${u.city}|${u.sector}|${u.type}`);
  }
}

main().catch(e => console.log('FATAL:', e.message));
