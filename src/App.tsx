import React, { Suspense, lazy, useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { getBooks, saveBook, getBookData, deleteBook, BookRecord } from './services/db';
import type { Book } from 'epubjs';

const EpubViewer = lazy(() =>
  import('./components/EpubViewer').then((module) => ({ default: module.EpubViewer })),
);
const MarkdownViewer = lazy(() =>
  import('./components/MarkdownViewer').then((module) => ({ default: module.MarkdownViewer })),
);
const PdfViewer = lazy(() =>
  import('./components/PdfViewer').then((module) => ({ default: module.PdfViewer })),
);

export default function App() {
  const [books, setBooks] = useState<Omit<BookRecord, 'data'>[]>([]);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [activeBookData, setActiveBookData] = useState<ArrayBuffer | null>(null);
  const [activeBookInstance, setActiveBookInstance] = useState<Book | null>(null);
  const [location, setLocation] = useState<string | number>('');
  const [currentHref, setCurrentHref] = useState<string>('');

  const [viewMode, setViewMode] = useState<'reader' | 'markdown'>('reader');
  const [markdownContent, setMarkdownContent] = useState('');
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    const loadedBooks = await getBooks();
    setBooks(loadedBooks);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isEpub = file.type === 'application/epub+zip' || file.name.toLowerCase().endsWith('.epub');

      if (!isPdf && !isEpub) {
        alert('Unsupported file type. Please upload an EPUB or PDF.');
        return;
      }

      let title = file.name.replace(/\.[^.]+$/, '');
      let author = isPdf ? 'PDF Document' : 'Unknown Author';
      let coverUrl: string | undefined;

      if (isEpub) {
        const { parseEpubMetadata } = await import('./services/epubService');
        const metadata = await parseEpubMetadata(file);
        title = metadata.title;
        author = metadata.author;
        coverUrl = metadata.coverUrl;
      }

      const newBook = await saveBook(file, title, author, isPdf ? 'pdf' : 'epub', coverUrl);
      await loadBooks();
      handleSelectBook(newBook.id);
    } catch (error) {
      console.error('Error uploading book:', error);
      alert('Failed to upload EPUB file.');
    }
  };

  const handleSelectBook = async (id: string) => {
    const data = await getBookData(id);
    if (data) {
      setActiveBookId(id);
      setActiveBookData(data);
      setLocation('');
      setCurrentHref('');
      setViewMode('reader');
      setMarkdownContent('');
    }
  };

  const handleBackToLibrary = () => {
    setActiveBookId(null);
    setActiveBookData(null);
    setActiveBookInstance(null);
    setLocation('');
    setCurrentHref('');
    setMarkdownContent('');
    setViewMode('reader');
  };

  const handleDeleteBook = async (id: string) => {
    await deleteBook(id);
    if (activeBookId === id) {
      handleBackToLibrary();
    }
    await loadBooks();
  };

  const handleConvertChapter = async () => {
    if (!activeBookInstance || !currentHref) return;
    setIsConverting(true);
    try {
      const { convertChapterToMarkdown } = await import('./services/epubService');
      const md = await convertChapterToMarkdown(activeBookInstance, currentHref);
      setMarkdownContent(md);
      setViewMode('markdown');
    } catch (e) {
      console.error(e);
      alert('Error converting chapter.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleConvertBook = async () => {
    if (!activeBookInstance) return;
    setIsConverting(true);
    try {
      const { convertBookToMarkdown } = await import('./services/epubService');
      const md = await convertBookToMarkdown(activeBookInstance);
      setMarkdownContent(md);
      setViewMode('markdown');
    } catch (e) {
      console.error(e);
      alert('Error converting book.');
    } finally {
      setIsConverting(false);
    }
  };

  const activeBook = books.find((b) => b.id === activeBookId);
  const isActiveEpub = activeBook?.format !== 'pdf';

  if (!activeBookId) {
    return (
      <div className="min-h-screen bg-zinc-100 font-sans">
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-4 sm:px-6">
          <h1 className="text-lg sm:text-xl font-semibold text-zinc-900">Your Library</h1>
          <label className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors">
            <Upload size={16} />
            Upload EPUB/PDF
            <input type="file" accept=".epub,.pdf,application/epub+zip,application/pdf" className="hidden" onChange={handleUpload} />
          </label>
        </header>

        <main className="p-4 sm:p-6">
          {books.length === 0 ? (
            <div className="h-[60vh] flex flex-col items-center justify-center text-zinc-500 text-center">
              <BookOpen size={56} className="mb-4 opacity-30" />
              <p className="text-lg font-medium text-zinc-700">Sua biblioteca está vazia</p>
              <p className="text-sm mt-1">Faça upload de um EPUB ou PDF para começar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
              {books.map((book) => (
                <button
                  key={book.id}
                  className="group text-left bg-white rounded-xl border border-zinc-200 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all overflow-hidden"
                  onClick={() => handleSelectBook(book.id)}
                >
                  <div className="aspect-[3/4] bg-zinc-200 overflow-hidden relative">
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500">
                        <BookOpen size={36} />
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-[10px] uppercase tracking-wide">
                      {book.format || 'epub'}
                    </span>
                    <button
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBook(book.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-zinc-900 line-clamp-2">{book.title}</h3>
                    <p className="text-xs text-zinc-500 mt-1 truncate">{book.author}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-zinc-100 overflow-hidden font-sans">
      <div className="flex-1 flex flex-col h-full min-w-0">
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-4 shadow-sm z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleBackToLibrary}
              className="p-2 text-zinc-600 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold text-zinc-800 truncate max-w-[200px] md:max-w-md">
              {activeBook ? activeBook.title : 'Reader'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex bg-zinc-100 p-1 rounded-lg border border-zinc-200">
              <button
                onClick={() => setViewMode('reader')}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  viewMode === 'reader'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                <BookOpen size={16} /> Reader
              </button>
              {isActiveEpub && (
                <button
                  onClick={() => setViewMode('markdown')}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    viewMode === 'markdown'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  <FileText size={16} /> Markdown
                </button>
              )}
            </div>

            {viewMode === 'reader' && isActiveEpub && (
              <div className="flex items-center gap-2 ml-2">
                <button
                  onClick={handleConvertChapter}
                  disabled={isConverting}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
                >
                  {isConverting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                  Convert Chapter
                </button>
                <button
                  onClick={handleConvertBook}
                  disabled={isConverting}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isConverting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                  <span className="hidden sm:inline">Convert Book</span>
                  <span className="sm:hidden">Convert</span>
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 relative overflow-hidden bg-zinc-50">
          {viewMode === 'reader' && activeBookData && isActiveEpub ? (
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                  <Loader2 size={20} className="animate-spin mr-2" />
                  Loading reader...
                </div>
              }
            >
              <EpubViewer
                bookData={activeBookData}
                location={location}
                onLocationChange={(loc, href) => {
                  setLocation(loc);
                  setCurrentHref(href);
                }}
                onTocReady={() => {}}
                onBookReady={setActiveBookInstance}
              />
            </Suspense>
          ) : viewMode === 'reader' && activeBookData ? (
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                  <Loader2 size={20} className="animate-spin mr-2" />
                  Loading PDF...
                </div>
              }
            >
              <PdfViewer fileData={activeBookData} />
            </Suspense>
          ) : viewMode === 'markdown' ? (
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                  <Loader2 size={20} className="animate-spin mr-2" />
                  Loading markdown...
                </div>
              }
            >
              <MarkdownViewer markdown={markdownContent} title={activeBook?.title || 'book'} />
            </Suspense>
          ) : null}
        </main>
      </div>
    </div>
  );
}
