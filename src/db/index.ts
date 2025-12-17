import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// For serverless environments (Vercel), use minimal connections
// The connection string should use Supabase's pooler (port 6543) with ?pgbouncer=true
const client = postgres(connectionString, {
  max: 1, // Serverless: use 1 connection per function instance
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false, // Required for pgbouncer/transaction mode
});

export const db = drizzle(client, { schema });

export type DbClient = typeof db;
