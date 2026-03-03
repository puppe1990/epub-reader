import { apiFetch, request } from './apiClient';

export interface BookRecord {
  id: string;
  title: string;
  author: string;
  format: 'epub' | 'pdf';
  coverUrl?: string;
  addedAt: number;
  sizeBytes: number;
  data: ArrayBuffer;
}

export interface ReadingProgress {
  locationCfi: string;
  href?: string;
  updatedAt: number;
}

const MAX_UPLOAD_BYTES_CLIENT = 25 * 1024 * 1024;

const fromBase64 = (encoded: string): ArrayBuffer => {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

export const saveBook = async (
  file: File,
  title: string,
  author: string,
  format: 'epub' | 'pdf',
  coverUrl?: string,
): Promise<BookRecord> => {
  if (file.size > MAX_UPLOAD_BYTES_CLIENT) {
    throw new Error(
      `This deployment currently supports files up to ${(MAX_UPLOAD_BYTES_CLIENT / (1024 * 1024)).toFixed(0)}MB.`,
    );
  }

  const data = await file.arrayBuffer();
  const sizeBytes = data.byteLength;
  const init = await request<{ uploadId: string; chunkSize: number }>('/uploads/init', {
    method: 'POST',
    body: JSON.stringify({ sizeBytes }),
  });

  const totalChunks = Math.ceil(sizeBytes / init.chunkSize);
  for (let index = 0; index < totalChunks; index += 1) {
    const start = index * init.chunkSize;
    const end = Math.min(start + init.chunkSize, sizeBytes);
    const chunk = data.slice(start, end);
    await apiFetch(`/uploads/${encodeURIComponent(init.uploadId)}/chunks/${index}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: chunk,
    });
  }

  const created = await request<Omit<BookRecord, 'data'>>('/uploads/complete', {
    method: 'POST',
    body: JSON.stringify({
      uploadId: init.uploadId,
      title,
      author,
      format,
      coverUrl,
      mimeType: file.type || (format === 'pdf' ? 'application/pdf' : 'application/epub+zip'),
      sizeBytes,
      chunkCount: totalChunks,
    }),
  });

  return {
    ...created,
    data,
  };
};

export const getBooks = async (): Promise<Omit<BookRecord, 'data'>[]> => {
  return request<Omit<BookRecord, 'data'>[]>('/books');
};

export const getBookData = async (id: string): Promise<ArrayBuffer | null> => {
  const payload = await request<{ mimeType: string; fileBase64: string }>(`/books/${encodeURIComponent(id)}/data`);
  return fromBase64(payload.fileBase64);
};

export const deleteBook = async (id: string): Promise<void> => {
  await request<void>(`/books/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
};

export const getReadingProgress = async (bookId: string): Promise<ReadingProgress | null> => {
  return request<ReadingProgress | null>(`/books/${encodeURIComponent(bookId)}/progress`);
};

export const saveReadingProgress = async (
  bookId: string,
  locationCfi: string,
  href?: string,
): Promise<ReadingProgress> => {
  return request<ReadingProgress>(`/books/${encodeURIComponent(bookId)}/progress`, {
    method: 'PUT',
    body: JSON.stringify({
      locationCfi,
      href,
      updatedAtClient: Date.now(),
    }),
  });
};
