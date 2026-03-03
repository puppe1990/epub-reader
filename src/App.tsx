import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Download, FileText, Loader2, Search, Trash2, Upload } from 'lucide-react';
import {
  getBooks,
  saveBook,
  getBookData,
  deleteBook,
  getReadingProgress,
  saveReadingProgress,
  BookRecord,
} from './services/db';
import { ApiError } from './services/apiClient';
import type { ConversionMetrics, ConversionProgress } from './services/epubService';

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
  type ReaderTheme = 'light' | 'sepia' | 'dark';

  const [books, setBooks] = useState<Omit<BookRecord, 'data'>[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [activeBookData, setActiveBookData] = useState<ArrayBuffer | null>(null);
  const [openingBookId, setOpeningBookId] = useState<string | null>(null);
  const [location, setLocation] = useState<string | number>('');
  const [locationHref, setLocationHref] = useState<string>('');
  const [readerFontScale, setReaderFontScale] = useState<number>(() => {
    if (typeof window === 'undefined') return 100;
    const stored = Number(window.localStorage.getItem('reader-font-scale') || 100);
    return Number.isFinite(stored) ? Math.min(150, Math.max(85, stored)) : 100;
  });
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = window.localStorage.getItem('reader-theme');
    if (stored === 'sepia' || stored === 'dark' || stored === 'light') return stored;
    return 'light';
  });

  const [activeSection, setActiveSection] = useState<'reader' | 'converter'>('reader');
  const [markdownContent, setMarkdownContent] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<'all' | 'epub' | 'pdf'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'author'>('recent');
  const [conversionProgress, setConversionProgress] = useState<ConversionProgress>({
    phase: 'idle',
    progress: 0,
    message: 'Ready to convert.',
  });
  const [conversionMetrics, setConversionMetrics] = useState<ConversionMetrics | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [conversionDetails, setConversionDetails] = useState<string[]>([]);
  const progressSaveTimerRef = useRef<number | null>(null);
  const progressErrorShownRef = useRef(false);
  const isOpeningBook = openingBookId !== null;

  useEffect(() => {
    loadBooks().catch((error) => {
      console.error('Error loading books:', error);
      alert(error instanceof Error ? error.message : 'Failed to load your library from API.');
    });
  }, []);

  useEffect(() => {
    return () => {
      if (progressSaveTimerRef.current) {
        window.clearTimeout(progressSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem('reader-font-scale', String(readerFontScale));
  }, [readerFontScale]);

  useEffect(() => {
    window.localStorage.setItem('reader-theme', readerTheme);
  }, [readerTheme]);

  const loadBooks = async () => {
    setIsLoadingBooks(true);
    try {
      const loadedBooks = await getBooks();
      setBooks(loadedBooks);
    } finally {
      setIsLoadingBooks(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
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
      let selectedBookId: string | null = null;

      if (isEpub) {
        const { parseEpubMetadata } = await import('./services/epubService');
        const metadata = await parseEpubMetadata(file);
        title = metadata.title;
        author = metadata.author;
        coverUrl = metadata.coverUrl;
        const newBook = await saveBook(file, title, author, 'epub', coverUrl);
        selectedBookId = newBook.id;
      } else {
        const pdfBook = await saveBook(file, title, author, 'pdf');
        selectedBookId = pdfBook.id;

        try {
          const { convertPdfToEpubFile } = await import('./services/pdfToEpubService');
          const convertedEpubFile = await convertPdfToEpubFile(file, {
            title: `${title} (Converted)`,
            author,
          });
          const convertedBook = await saveBook(
            convertedEpubFile,
            `${title} (Converted)`,
            author,
            'epub',
          );
          selectedBookId = convertedBook.id;
        } catch (pdfConversionError) {
          console.error('Failed to convert PDF to EPUB:', pdfConversionError);
          alert('PDF uploaded, but automatic EPUB conversion failed for this file.');
        }
      }

      await loadBooks();
      if (selectedBookId) await handleSelectBook(selectedBookId);
    } catch (error) {
      console.error('Error uploading book:', error);
      if (error instanceof ApiError && error.status === 413) {
        alert('File too large. Maximum supported size is 25MB.');
      } else {
        alert(error instanceof Error ? error.message : 'Failed to upload file.');
      }
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSelectBook = async (id: string) => {
    if (isOpeningBook) return;
    setOpeningBookId(id);
    try {
      const [data, progress] = await Promise.all([getBookData(id), getReadingProgress(id)]);
      if (data) {
        setActiveBookId(id);
        setActiveBookData(data);
        setLocation(progress?.locationCfi || '');
        setLocationHref(progress?.href || '');
        setActiveSection('reader');
        setMarkdownContent('');
        progressErrorShownRef.current = false;
      }
    } catch (error) {
      console.error('Error selecting book:', error);
      alert(error instanceof Error ? error.message : 'Failed to open the selected book.');
    } finally {
      setOpeningBookId(null);
    }
  };

  const handleBackToLibrary = () => {
    setActiveBookId(null);
    setActiveBookData(null);
    setLocation('');
    setLocationHref('');
    setMarkdownContent('');
    setActiveSection('reader');
  };

  const handleDeleteBook = async (id: string) => {
    try {
      await deleteBook(id);
      if (activeBookId === id) {
        handleBackToLibrary();
      }
      await loadBooks();
    } catch (error) {
      console.error('Error deleting book:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete book.');
    }
  };

  useEffect(() => {
    const activeBookFormat = books.find((book) => book.id === activeBookId)?.format;

    if (!activeBookId || !activeBookData || typeof location !== 'string' || !location.trim()) {
      return;
    }

    if (activeBookFormat !== 'epub') {
      return;
    }

    if (progressSaveTimerRef.current) {
      window.clearTimeout(progressSaveTimerRef.current);
    }

    progressSaveTimerRef.current = window.setTimeout(async () => {
      try {
        await saveReadingProgress(activeBookId, location, locationHref || undefined);
        progressErrorShownRef.current = false;
      } catch (error) {
        console.error('Error saving reading progress:', error);
        if (!progressErrorShownRef.current) {
          alert(error instanceof Error ? error.message : 'Failed to save reading progress.');
          progressErrorShownRef.current = true;
        }
      }
    }, 1000);

    return () => {
      if (progressSaveTimerRef.current) {
        window.clearTimeout(progressSaveTimerRef.current);
      }
    };
  }, [activeBookData, activeBookId, books, location, locationHref]);

  const runBookConversion = async (mode: 'buffer' | 'blob-url') => {
    if (!activeBookData) throw new Error('Book file is not loaded.');
    const { default: ePub } = await import('epubjs');
    const { convertBookToMarkdownDetailed } = await import('./services/epubService');

    let bookToConvert: any;
    let tempUrl: string | null = null;
    if (mode === 'buffer') {
      bookToConvert = ePub(activeBookData);
    } else {
      const blob = new Blob([activeBookData], { type: 'application/epub+zip' });
      tempUrl = URL.createObjectURL(blob);
      bookToConvert = ePub(tempUrl);
    }

    try {
      await bookToConvert.ready;
      const result = await convertBookToMarkdownDetailed(bookToConvert, {
        onProgress: setConversionProgress,
      });

      if (result.metrics.convertedChapters === 0) {
        throw new Error(result.errors[0] || 'No readable chapters were found in this EPUB.');
      }

      setMarkdownContent(result.markdown.trim() ? result.markdown : 'No content extracted from this book.');
      setConversionMetrics(result.metrics);
      setConversionDetails(result.errors);
      setConversionError(null);
      return true;
    } finally {
      bookToConvert.destroy();
      if (tempUrl) URL.revokeObjectURL(tempUrl);
    }
  };

  const handleConvertBook = async () => {
    if (!activeBookData) return;
    setActiveSection('converter');
    setIsConverting(true);
    setConversionError(null);
    setConversionDetails([]);
    setConversionMetrics(null);
    setConversionProgress({
      phase: 'initializing',
      progress: 2,
      message: 'Preparing conversion...',
    });

    try {
      await runBookConversion('buffer');
    } catch (primaryError) {
      const primaryMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
      setConversionProgress({
        phase: 'loading-structure',
        progress: 35,
        message: 'Retrying with fallback parser...',
      });
      try {
        await runBookConversion('blob-url');
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        setConversionError(fallbackMessage);
        setMarkdownContent(`Error converting book to markdown.\n\n${fallbackMessage}`);
        setConversionDetails([`Primary attempt: ${primaryMessage}`, `Fallback attempt: ${fallbackMessage}`]);
        setConversionProgress({
          phase: 'error',
          progress: 100,
          message: 'Conversion failed after retry.',
        });
      }
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownloadSource = () => {
    if (!activeBook || !activeBookData) return;
    const extension = activeBook.format === 'pdf' ? 'pdf' : 'epub';
    const mime = activeBook.format === 'pdf' ? 'application/pdf' : 'application/epub+zip';
    const blob = new Blob([activeBookData], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeBook.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const activeBook = books.find((b) => b.id === activeBookId);
  const isActiveEpub = activeBook?.format !== 'pdf';
  const filteredBooks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const searched = books.filter((book) => {
      const matchQuery =
        query.length === 0 ||
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query);
      const matchFormat = formatFilter === 'all' || book.format === formatFilter;
      return matchQuery && matchFormat;
    });

    const sorted = [...searched];
    sorted.sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'author') return a.author.localeCompare(b.author);
      return b.addedAt - a.addedAt;
    });
    return sorted;
  }, [books, searchQuery, formatFilter, sortBy]);

  if (!activeBookId) {
    return (
      <div className="min-h-dvh bg-zinc-100 font-sans">
        <header className="bg-white border-b border-zinc-200 flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <h1 className="text-base sm:text-xl font-semibold text-zinc-900">Your Library</h1>
            <p className="text-[11px] sm:text-xs text-zinc-500">Search, filter and open your books</p>
          </div>
          <label className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {isUploading ? 'Processing...' : 'Upload EPUB/PDF'}
            <input
              type="file"
              accept=".epub,.pdf,application/epub+zip,application/pdf"
              className="hidden"
              onChange={handleUpload}
              disabled={isUploading}
            />
          </label>
        </header>

        <main className="p-4 sm:p-6">
          {isOpeningBook && (
            <div className="mb-4 p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center gap-2 text-indigo-700 text-sm">
              <Loader2 size={14} className="animate-spin" />
              Opening book...
            </div>
          )}
          {isLoadingBooks ? (
            <div className="h-[60vh] flex flex-col items-center justify-center text-zinc-500 text-center">
              <Loader2 size={28} className="animate-spin mb-3" />
              <p className="text-sm font-medium text-zinc-700">Loading your library...</p>
            </div>
          ) : books.length === 0 ? (
            <div className="h-[60vh] flex flex-col items-center justify-center text-zinc-500 text-center">
              <BookOpen size={56} className="mb-4 opacity-25" />
              <p className="text-xl font-semibold text-zinc-800">Sua biblioteca está vazia</p>
              <p className="text-sm mt-2 max-w-md">Faça upload de um EPUB ou PDF para começar a leitura e conversão.</p>
              <div className="mt-4 p-4 rounded-xl bg-white border border-zinc-200 text-left max-w-md w-full">
                <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Example output</p>
                <p className="text-sm text-zinc-700 font-mono"># Book Title{"\n"}## Chapter 1{"\n"}Converted markdown...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 p-3 rounded-xl bg-white border border-zinc-200 flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title or author..."
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
                <select
                  value={formatFilter}
                  onChange={(e) => setFormatFilter(e.target.value as 'all' | 'epub' | 'pdf')}
                  className="h-9 px-3 rounded-lg border border-zinc-300 text-sm bg-white"
                >
                  <option value="all">All formats</option>
                  <option value="epub">EPUB</option>
                  <option value="pdf">PDF</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'recent' | 'title' | 'author')}
                  className="h-9 px-3 rounded-lg border border-zinc-300 text-sm bg-white"
                >
                  <option value="recent">Most recent</option>
                  <option value="title">Title A-Z</option>
                  <option value="author">Author A-Z</option>
                </select>
              </div>

              {filteredBooks.length === 0 ? (
                <div className="h-[40vh] rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-500">
                  No books match your search/filter.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-5">
                  {filteredBooks.map((book) => (
                    <button
                      key={book.id}
                      disabled={isOpeningBook}
                      className={`group text-left bg-white rounded-xl border shadow-sm transition-all overflow-hidden ${
                        openingBookId === book.id
                          ? 'border-indigo-400 shadow-md ring-2 ring-indigo-200'
                          : 'border-zinc-200 hover:shadow-md hover:border-zinc-300'
                      } disabled:opacity-85 disabled:cursor-wait`}
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
                          disabled={isOpeningBook}
                          className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity disabled:opacity-40"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBook(book.id);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                        {openingBookId === book.id && (
                          <div className="absolute inset-0 bg-zinc-900/45 backdrop-blur-[1px] flex flex-col items-center justify-center text-white">
                            <Loader2 size={22} className="animate-spin mb-2" />
                            <span className="text-xs font-medium tracking-wide">Opening...</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="text-sm font-semibold text-zinc-900 line-clamp-2">{book.title}</h3>
                        <p className="text-xs text-zinc-500 mt-1 truncate">{book.author}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full bg-zinc-100 overflow-hidden font-sans">
      <div className="flex-1 flex flex-col h-full min-w-0">
        <header className="bg-white border-b border-zinc-200 flex items-center justify-between gap-2 px-3 py-2 sm:px-4 shadow-sm z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleBackToLibrary}
              className="p-2 text-zinc-600 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-semibold text-zinc-800 truncate max-w-[140px] sm:max-w-md">
                {activeBook ? activeBook.title : 'Reader'}
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-500">Reader and converter workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {activeSection === 'reader' && isActiveEpub && (
              <div className="hidden md:flex items-center gap-2 mr-1">
                <div className="flex items-center rounded-lg border border-zinc-200 bg-white overflow-hidden">
                  <button
                    onClick={() => setReaderFontScale((value) => Math.max(85, value - 5))}
                    className="px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                    aria-label="Diminuir tamanho da fonte"
                  >
                    A-
                  </button>
                  <span className="px-2 text-[11px] text-zinc-500 border-x border-zinc-200 min-w-[48px] text-center">
                    {readerFontScale}%
                  </span>
                  <button
                    onClick={() => setReaderFontScale((value) => Math.min(150, value + 5))}
                    className="px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                    aria-label="Aumentar tamanho da fonte"
                  >
                    A+
                  </button>
                </div>
                <div className="flex items-center rounded-lg border border-zinc-200 bg-white p-1 gap-1">
                  <button
                    onClick={() => setReaderTheme('light')}
                    className={`px-2 py-1 rounded text-[11px] font-medium ${
                      readerTheme === 'light' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    Claro
                  </button>
                  <button
                    onClick={() => setReaderTheme('sepia')}
                    className={`px-2 py-1 rounded text-[11px] font-medium ${
                      readerTheme === 'sepia' ? 'bg-amber-700 text-amber-50' : 'text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    Amarelado
                  </button>
                  <button
                    onClick={() => setReaderTheme('dark')}
                    className={`px-2 py-1 rounded text-[11px] font-medium ${
                      readerTheme === 'dark' ? 'bg-black text-zinc-100' : 'text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    Escuro
                  </button>
                </div>
              </div>
            )}

            <div className="flex bg-zinc-100 p-1 rounded-lg border border-zinc-200">
              <button
                onClick={() => setActiveSection('reader')}
                className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all ${
                  activeSection === 'reader'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                <BookOpen size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Reader</span>
              </button>
              {isActiveEpub && (
                <button
                  onClick={() => setActiveSection('converter')}
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all ${
                    activeSection === 'converter'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  <FileText size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Converter</span>
                </button>
              )}
            </div>

            {activeSection === 'converter' && isActiveEpub && (
              <div className="flex items-center gap-1 sm:gap-2 ml-1 sm:ml-2">
                <button
                  onClick={handleConvertBook}
                  disabled={isConverting}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isConverting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                  <span className="hidden sm:inline">Convert Full Book</span>
                  <span className="sm:hidden">Convert</span>
                </button>
              </div>
            )}
          </div>
        </header>

        <main className={`flex-1 relative overflow-hidden bg-zinc-50 ${activeSection === 'reader' ? 'pb-16 md:pb-0' : ''}`}>
          {activeSection === 'reader' && activeBookData && isActiveEpub ? (
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
                fontScale={readerFontScale}
                theme={readerTheme}
                onLocationChange={(loc, href) => {
                  setLocation(loc);
                  setLocationHref(href);
                }}
                onTocReady={() => {}}
                onBookReady={() => {}}
              />
            </Suspense>
          ) : activeSection === 'reader' && activeBookData ? (
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
          ) : activeSection === 'converter' && isActiveEpub ? (
            <div className="w-full h-full flex flex-col">
              <div className="px-3 py-2 sm:px-4 sm:py-3 border-b border-zinc-200 bg-white flex items-center justify-between gap-3">
                <p className="text-xs sm:text-sm text-zinc-700 font-medium">Convert the full book to Markdown.</p>
                <div className="flex md:hidden items-center gap-2">
                  <button
                    onClick={handleConvertBook}
                    disabled={isConverting}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {isConverting ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                    Convert Full Book
                  </button>
                </div>
              </div>
              <div className="p-3 sm:p-4 border-b border-zinc-200 bg-white">
                <div className="flex items-center justify-between text-xs sm:text-sm mb-2">
                  <span className="font-medium text-zinc-700">{conversionProgress.message}</span>
                  <span className="text-zinc-500">{Math.round(conversionProgress.progress)}%</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-200 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      conversionProgress.phase === 'error' ? 'bg-red-500' : 'bg-indigo-600'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, conversionProgress.progress))}%` }}
                  />
                </div>
                {conversionMetrics && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200">
                      <p className="text-zinc-500">Chapters</p>
                      <p className="font-semibold text-zinc-800">{conversionMetrics.totalChapters}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200">
                      <p className="text-zinc-500">Converted</p>
                      <p className="font-semibold text-zinc-800">{conversionMetrics.convertedChapters}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200">
                      <p className="text-zinc-500">Failed</p>
                      <p className="font-semibold text-zinc-800">{conversionMetrics.failedChapters}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200">
                      <p className="text-zinc-500">Time</p>
                      <p className="font-semibold text-zinc-800">{(conversionMetrics.durationMs / 1000).toFixed(1)}s</p>
                    </div>
                  </div>
                )}
                {conversionError && (
                  <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-sm font-medium text-red-700">Conversion failed</p>
                    <p className="text-xs text-red-700 mt-1">{conversionError}</p>
                    <button
                      onClick={handleConvertBook}
                      disabled={isConverting}
                      className="mt-2 px-3 py-1.5 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      Try again
                    </button>
                  </div>
                )}
                {conversionDetails.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-xs text-zinc-600 cursor-pointer">Conversion details</summary>
                    <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                      {conversionDetails.slice(0, 6).map((detail, idx) => (
                        <li key={`${detail}-${idx}`}>- {detail}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
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
            </div>
          ) : null}
        </main>

        {activeSection === 'reader' && activeBookData && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-zinc-200 px-3 py-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleBackToLibrary}
                className="h-10 rounded-lg border border-zinc-300 text-zinc-700 text-xs font-medium"
              >
                Back
              </button>
              <button
                onClick={() => setActiveSection('converter')}
                disabled={!isActiveEpub}
                className="h-10 rounded-lg bg-indigo-600 text-white text-xs font-medium disabled:opacity-50"
              >
                Converter
              </button>
              <button
                onClick={handleDownloadSource}
                className="h-10 rounded-lg border border-zinc-300 text-zinc-700 text-xs font-medium flex items-center justify-center gap-1"
              >
                <Download size={14} />
                Download
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
