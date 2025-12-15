import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!);

async function cleanupAdmin() {
  const userId = 'a69e5665-f7f1-4175-99ee-93c05363431c';

  console.log(`Deleting placeholder admin user with ID: ${userId}`);

  try {
    await sql`DELETE FROM users WHERE id = ${userId}`;
    console.log('Placeholder admin user deleted. The system will auto-create the user on next login.');
  } catch (error) {
    console.error('Failed to delete admin user:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

cleanupAdmin().catch(console.error);
