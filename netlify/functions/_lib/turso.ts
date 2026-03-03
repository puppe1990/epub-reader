import { createClient, type Client } from '@libsql/client/web';

declare const Netlify: {
  env: {
    get: (key: string) => string | undefined;
  };
};

let client: Client | null = null;

const getEnv = (key: string): string => {
  const value = Netlify.env.get(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const getDb = (): Client => {
  if (client) return client;

  client = createClient({
    url: getEnv('TURSO_DATABASE_URL'),
    authToken: getEnv('TURSO_AUTH_TOKEN'),
  });

  return client;
};
