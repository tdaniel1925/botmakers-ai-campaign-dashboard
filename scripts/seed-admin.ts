import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!);

async function seedAdmin() {
  // This ID should match the Supabase Auth user ID
  const userId = 'a69e5665-f7f1-4175-99ee-93c05363431c';

  // Get the email from command line args, or use a default
  const email = process.argv[2] || 'admin@example.com';

  console.log(`Creating admin user with ID: ${userId}`);
  console.log(`Email: ${email}`);

  try {
    // Check if user already exists
    const existing = await sql`SELECT id FROM users WHERE id = ${userId}`;

    if (existing.length > 0) {
      console.log('User already exists, updating to admin role...');
      await sql`
        UPDATE users
        SET role = 'admin', is_active = true
        WHERE id = ${userId}
      `;
    } else {
      console.log('Creating new admin user...');
      await sql`
        INSERT INTO users (id, email, full_name, role, is_active)
        VALUES (${userId}, ${email}, 'Admin', 'admin', true)
      `;
    }

    console.log('Admin user created/updated successfully!');
  } catch (error) {
    console.error('Failed to create admin user:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

seedAdmin().catch(console.error);
