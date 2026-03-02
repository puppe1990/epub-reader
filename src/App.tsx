import React, { useEffect, useState } from 'react';
import { Menu, BookOpen, FileText, Loader2 } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { EpubViewer } from './components/EpubViewer';
import { MarkdownViewer } from './components/MarkdownViewer';
import { getBooks, saveBook, getBookData, deleteBook, BookRecord } from './services/db';
import { parseEpubMetadata, convertBookToMarkdown, convertChapterToMarkdown } from './services/epubService';
import { Book } from 'epubjs';

export default function App() {
  const [books, setBooks] = useState<Omit<BookRecord, 'data'>[]>([]);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [activeBookData, setActiveBookData] = useState<ArrayBuffer | null>(null);
  const [activeBookInstance, setActiveBookInstance] = useState<Book | null>(null);
  const [toc, setToc] = useState<any[]>([]);
  const [location, setLocation] = useState<string | number>('');
  const [currentHref, setCurrentHref] = useState<string>('');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
      const metadata = await parseEpubMetadata(file);
      const newBook = await saveBook(file, metadata.title, metadata.author, metadata.coverUrl);
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
      setToc([]);
      setLocation('');
      setCurrentHref('');
      setViewMode('reader');
      setMarkdownContent('');
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    }
  };

  const handleDeleteBook = async (id: string) => {
    await deleteBook(id);
    if (activeBookId === id) {
      setActiveBookId(null);
      setActiveBookData(null);
      setActiveBookInstance(null);
      setToc([]);
      setLocation('');
      setCurrentHref('');
      setMarkdownContent('');
    }
    await loadBooks();
  };

  const handleConvertChapter = async () => {
    if (!activeBookInstance || !currentHref) return;
    setIsConverting(true);
    try {
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

  return (
    <div className="flex h-screen w-full bg-zinc-100 overflow-hidden font-sans">
      <Sidebar
        books={books}
        activeBookId={activeBookId}
        onSelectBook={handleSelectBook}
        onDeleteBook={handleDeleteBook}
        onUpload={handleUpload}
        toc={toc}
        onSelectToc={(href) => {
          setLocation(href);
          setCurrentHref(href);
          setViewMode('reader');
          if (window.innerWidth < 768) setIsSidebarOpen(false);
        }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-4 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-semibold text-zinc-800 truncate max-w-[200px] md:max-w-md">
              {activeBook ? activeBook.title : 'No book selected'}
            </h2>
          </div>

          {activeBookId && (
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
              </div>

              {viewMode === 'reader' && (
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
          )}
        </header>

        {/* Main Viewer Area */}
        <main className="flex-1 relative overflow-hidden bg-zinc-50">
          {!activeBookId ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 p-8 text-center">
              <BookOpen size={64} className="mb-4 opacity-20" />
              <h2 className="text-xl font-medium text-zinc-600 mb-2">Welcome to EPUB Reader</h2>
              <p className="max-w-md">
                Select a book from your library or upload a new EPUB file to start reading and converting to Markdown.
              </p>
            </div>
          ) : viewMode === 'reader' && activeBookData ? (
            <EpubViewer
              bookData={activeBookData}
              location={location}
              onLocationChange={(loc, href) => {
                setLocation(loc);
                setCurrentHref(href);
              }}
              onTocReady={setToc}
              onBookReady={setActiveBookInstance}
            />
          ) : viewMode === 'markdown' ? (
            <MarkdownViewer markdown={markdownContent} title={activeBook?.title || 'book'} />
          ) : null}
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
