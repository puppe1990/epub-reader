export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const json = (body: unknown, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const noContent = (): Response => {
  return new Response(null, { status: 204 });
};

export const readJson = async <T>(req: Request): Promise<T> => {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
};

export const getPathSegments = (req: Request): string[] => {
  const pathname = new URL(req.url).pathname;
  return pathname.split('/').filter(Boolean);
};

export const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};

export const handleError = (error: unknown): Response => {
  if (error instanceof HttpError) {
    return json({ error: error.message }, error.status);
  }

  console.error(error);
  return json({ error: 'Internal server error.' }, 500);
};
