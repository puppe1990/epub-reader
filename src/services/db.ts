import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';

export interface BookRecord {
  id: string;
  title: string;
  author: string;
  format: 'epub' | 'pdf';
  coverUrl?: string;
  addedAt: number;
  data: ArrayBuffer;
}

const db = localforage.createInstance({
  name: 'epub-reader',
  storeName: 'books',
});

export const saveBook = async (
  file: File,
  title: string,
  author: string,
  format: 'epub' | 'pdf',
  coverUrl?: string,
): Promise<BookRecord> => {
  const data = await file.arrayBuffer();
  const record: BookRecord = {
    id: uuidv4(),
    title,
    author,
    format,
    coverUrl,
    addedAt: Date.now(),
    data,
  };
  await db.setItem(record.id, record);
  return record;
};

export const getBooks = async (): Promise<Omit<BookRecord, 'data'>[]> => {
  const books: Omit<BookRecord, 'data'>[] = [];
  await db.iterate((value: BookRecord, key: string) => {
    books.push({
      id: value.id,
      title: value.title,
      author: value.author,
      format: value.format || 'epub',
      coverUrl: value.coverUrl,
      addedAt: value.addedAt,
    });
  });
  return books.sort((a, b) => b.addedAt - a.addedAt);
};

export const getBookData = async (id: string): Promise<ArrayBuffer | null> => {
  const record = await db.getItem<BookRecord>(id);
  return record ? record.data : null;
};

export const deleteBook = async (id: string): Promise<void> => {
  await db.removeItem(id);
};
