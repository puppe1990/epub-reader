import type { Context, Config } from '@netlify/functions';
import { getPathSegments, handleError, json } from './_lib/http';
import { handleBooksList } from './books-list';
import { handleBooksCreate } from './books-create';
import { handleBooksData } from './books-data';
import { handleBooksDelete } from './books-delete';
import { handleProgressGet } from './progress-get';
import { handleProgressPut } from './progress-put';
import { handleUploadsInit } from './uploads-init';
import { handleUploadsChunk } from './uploads-chunk';
import { handleUploadsComplete } from './uploads-complete';

const methodNotAllowed = (): Response => {
  return json({ error: 'Method not allowed.' }, 405);
};

const notFound = (): Response => {
  return json({ error: 'Not found.' }, 404);
};

const readBookId = (segments: string[]): string | null => {
  if (segments.length < 3) return null;
  const id = segments[2]?.trim();
  if (!id) return null;
  return decodeURIComponent(id);
};

const route = async (req: Request): Promise<Response> => {
  const method = req.method.toUpperCase();
  const segments = getPathSegments(req);

  if (segments.length === 3 && segments[0] === 'api' && segments[1] === 'uploads' && segments[2] === 'init') {
    if (method === 'POST') return handleUploadsInit(req);
    return methodNotAllowed();
  }

  if (segments.length === 3 && segments[0] === 'api' && segments[1] === 'uploads' && segments[2] === 'complete') {
    if (method === 'POST') return handleUploadsComplete(req);
    return methodNotAllowed();
  }

  if (
    segments.length === 5 &&
    segments[0] === 'api' &&
    segments[1] === 'uploads' &&
    segments[3] === 'chunks'
  ) {
    if (method !== 'PUT') return methodNotAllowed();
    const uploadId = decodeURIComponent(segments[2]);
    const chunkIndex = Number.parseInt(segments[4], 10);
    return handleUploadsChunk(req, uploadId, chunkIndex);
  }

  if (segments.length === 2 && segments[0] === 'api' && segments[1] === 'books') {
    if (method === 'GET') return handleBooksList();
    if (method === 'POST') return handleBooksCreate(req);
    return methodNotAllowed();
  }

  const bookId = readBookId(segments);
  if (!bookId || segments[0] !== 'api' || segments[1] !== 'books') {
    return notFound();
  }

  if (segments.length === 3) {
    if (method === 'DELETE') return handleBooksDelete(bookId);
    return methodNotAllowed();
  }

  if (segments.length === 4 && segments[3] === 'data') {
    if (method === 'GET') return handleBooksData(bookId);
    return methodNotAllowed();
  }

  if (segments.length === 4 && segments[3] === 'progress') {
    if (method === 'GET') return handleProgressGet(bookId);
    if (method === 'PUT') return handleProgressPut(req, bookId);
    return methodNotAllowed();
  }

  return notFound();
};

export default async (req: Request, _context: Context): Promise<Response> => {
  try {
    return await route(req);
  } catch (error) {
    return handleError(error);
  }
};

export const config: Config = {
  path: '/api/*',
};
