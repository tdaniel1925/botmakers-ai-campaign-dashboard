import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!);

async function checkTables() {
  console.log('Checking database tables...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');

  try {
    // List all tables in public schema
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log('\nTables in public schema:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));

    // Check if users table exists
    const userTable = tables.find(t => t.table_name === 'users');
    if (userTable) {
      console.log('\n✓ Users table exists');

      // Count users
      const userCount = await sql`SELECT COUNT(*) as count FROM users`;
      console.log(`  User count: ${userCount[0].count}`);
    } else {
      console.log('\n✗ Users table does NOT exist');
    }

    // Check search_path
    const searchPath = await sql`SHOW search_path`;
    console.log('\nSearch path:', searchPath[0].search_path);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

checkTables().catch(console.error);
