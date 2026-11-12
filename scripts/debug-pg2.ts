const { Client } = require('pg');

async function main() {
  // Try with explicit SSL config
  const client = new Client({
    connectionString: process.env.DATABASE_URL || '',
    connectionTimeoutMillis: 10000,
    ssl: {
      rejectUnauthorized: false,
    },
  });
  
  try {
    console.log('Connecting with explicit SSL...');
    await client.connect();
    console.log('Connected!');
    const res = await client.query('SELECT count(*) FROM "Internship"');
    console.log('Internships:', res.rows[0].count);
  } catch (e: any) {
    console.log('Error:', e.message);
    
    // Try without SSL
    console.log('\nTrying with sslmode=disable...');
    const client2 = new Client({
      connectionString: process.env.DATABASE_URL || '',
      connectionTimeoutMillis: 10000,
    });
    try {
      await client2.connect();
      console.log('Connected without SSL!');
      const res2 = await client2.query('SELECT count(*) FROM "Internship"');
      console.log('Internships:', res2.rows[0].count);
    } catch (e2: any) {
      console.log('No SSL error:', e2.message);
    }
    await client2.end().catch(() => {});
  }
  
  await client.end().catch(() => {});
}

main();
