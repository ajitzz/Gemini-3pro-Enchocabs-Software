import { Client } from 'pg';

export interface Env {
  HYPERDRIVE: {
    connectionString: string;
  };
  ALLOWED_ORIGINS?: string;
  SUPER_ADMIN_EMAIL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_IDS?: string;
}

const defaultOptions = { ssl: { rejectUnauthorized: false } };

const createClient = (env: Env) => new Client({
  connectionString: env.HYPERDRIVE.connectionString,
  ...defaultOptions,
});

export const query = async <T = any>(env: Env, text: string, params: any[] = []) => {
  const client = createClient(env);
  await client.connect();
  try {
    const result = await client.query<T>(text, params);
    return result;
  } finally {
    await client.end();
  }
};

export const withTransaction = async <T>(env: Env, fn: (client: Client) => Promise<T>) => {
  const client = createClient(env);
  await client.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
};
