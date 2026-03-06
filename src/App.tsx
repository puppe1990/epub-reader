import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from './services/apiClient';
import {
  BookRecord,
  convertPdfBook,
  deleteBook,
  getBookData,
  getBooks,
  LibraryTaskStatus,
  getReadingProgress,
  saveBook,
  saveReadingProgress,
} from './services/db';
import type { ConversionMetrics, ConversionProgress } from './services/epubService';
import { LibraryView } from './components/app/LibraryView';
import { NoticeStack } from './components/app/NoticeStack';
import { ReaderWorkspace } from './components/app/ReaderWorkspace';
import { Notice, NoticeTone, ReaderTheme } from './components/app/ui';

export default function App() {
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
    message: 'Pronto para converter.',
  });
  const [conversionMetrics, setConversionMetrics] = useState<ConversionMetrics | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [conversionDetails, setConversionDetails] = useState<string[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [libraryTaskStatus, setLibraryTaskStatus] = useState<LibraryTaskStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const progressSaveTimerRef = useRef<number | null>(null);
  const progressErrorShownRef = useRef(false);
  const noticeIdRef = useRef(0);
  const isOpeningBook = openingBookId !== null;

  const dismissNotice = (id: number) => {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  };

  const pushNotice = (message: string, tone: NoticeTone = 'info') => {
    const id = noticeIdRef.current + 1;
    noticeIdRef.current = id;
    setNotices((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      dismissNotice(id);
    }, 4200);
  };

  const loadBooks = async () => {
    setIsLoadingBooks(true);
    try {
      const loadedBooks = await getBooks();
      setBooks(loadedBooks);
    } finally {
      setIsLoadingBooks(false);
    }
  };

  useEffect(() => {
    loadBooks().catch((error) => {
      console.error('Error loading books:', error);
      pushNotice(error instanceof Error ? error.message : 'Falha ao carregar a biblioteca.', 'error');
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

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setLibraryTaskStatus({ tone: 'info', message: 'Preparando envio do arquivo...' });
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isEpub = file.type === 'application/epub+zip' || file.name.toLowerCase().endsWith('.epub');

      if (!isPdf && !isEpub) {
        pushNotice('Formato inválido. Envie um arquivo EPUB ou PDF.', 'error');
        return;
      }

      let title = file.name.replace(/\.[^.]+$/, '');
      let author = isPdf ? 'Documento PDF' : 'Autor desconhecido';
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
        setLibraryTaskStatus({ tone: 'success', message: 'EPUB enviado e pronto para leitura.' });
        pushNotice('EPUB enviado para a biblioteca.', 'success');
      } else {
        const pdfBook = await saveBook(file, title, author, 'pdf');
        selectedBookId = pdfBook.id;
        setLibraryTaskStatus({ tone: 'info', message: 'PDF salvo. Convertendo no servidor para EPUB...' });
        pushNotice('PDF enviado. Vou tentar gerar uma versão EPUB.', 'info');

        try {
          const convertedBook = await convertPdfBook(pdfBook.id);
          selectedBookId = convertedBook.id;
          setLibraryTaskStatus({ tone: 'success', message: 'PDF convertido no servidor e pronto como EPUB.' });
          pushNotice('Versão EPUB criada automaticamente.', 'success');
        } catch (pdfConversionError) {
          console.error('Failed to convert PDF to EPUB:', pdfConversionError);
          setLibraryTaskStatus({
            tone: 'error',
            message: 'O PDF foi salvo, mas a conversão automática no servidor falhou.',
          });
          pushNotice('O PDF foi salvo, mas a conversão automática para EPUB falhou.', 'error');
        }
      }

      await loadBooks();
      if (selectedBookId) await handleSelectBook(selectedBookId);
    } catch (error) {
      console.error('Error uploading book:', error);
      if (error instanceof ApiError && error.status === 413) {
        setLibraryTaskStatus({ tone: 'error', message: 'Arquivo grande demais. O limite atual é 25 MB.' });
        pushNotice('Arquivo grande demais. O limite atual é 25 MB.', 'error');
      } else {
        setLibraryTaskStatus({ tone: 'error', message: 'Falha ao enviar o arquivo para a biblioteca.' });
        pushNotice(error instanceof Error ? error.message : 'Falha ao enviar o arquivo.', 'error');
      }
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleSelectBook = async (id: string) => {
    if (isOpeningBook) return;
    setOpeningBookId(id);
    try {
      const [data, progress] = await Promise.all([getBookData(id), getReadingProgress(id)]);
      if (!data) {
        pushNotice('Não foi possível carregar o livro selecionado.', 'error');
        return;
      }

      setActiveBookId(id);
      setActiveBookData(data);
      setLocation(progress?.locationCfi || '');
      setLocationHref(progress?.href || '');
      setActiveSection('reader');
      setMarkdownContent('');
      setSyncStatus(progress ? 'saved' : 'idle');
      progressErrorShownRef.current = false;
    } catch (error) {
      console.error('Error selecting book:', error);
      pushNotice(error instanceof Error ? error.message : 'Falha ao abrir o livro.', 'error');
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
      pushNotice('Livro removido da biblioteca.', 'success');
    } catch (error) {
      console.error('Error deleting book:', error);
      pushNotice(error instanceof Error ? error.message : 'Falha ao remover o livro.', 'error');
    }
  };

  useEffect(() => {
    const activeBookFormat = books.find((book) => book.id === activeBookId)?.format;
    if (!activeBookId || !activeBookData || typeof location !== 'string' || !location.trim()) return;
    if (activeBookFormat !== 'epub') return;

    if (progressSaveTimerRef.current) {
      window.clearTimeout(progressSaveTimerRef.current);
    }

    progressSaveTimerRef.current = window.setTimeout(async () => {
      setSyncStatus('saving');
      try {
        await saveReadingProgress(activeBookId, location, locationHref || undefined);
        progressErrorShownRef.current = false;
        setSyncStatus('saved');
      } catch (error) {
        console.error('Error saving reading progress:', error);
        setSyncStatus('error');
        if (!progressErrorShownRef.current) {
          pushNotice(
            error instanceof Error ? error.message : 'Falha ao salvar o progresso de leitura.',
            'error',
          );
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
    if (!activeBookData) throw new Error('O arquivo do livro não está carregado.');
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
        throw new Error(result.errors[0] || 'Nenhum capítulo legível foi encontrado neste EPUB.');
      }

      setMarkdownContent(result.markdown.trim() ? result.markdown : 'Nenhum conteúdo foi extraído do livro.');
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
      message: 'Preparando a conversão...',
    });

    try {
      await runBookConversion('buffer');
      pushNotice('Markdown gerado com sucesso.', 'success');
    } catch (primaryError) {
      const primaryMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
      setConversionProgress({
        phase: 'loading-structure',
        progress: 35,
        message: 'Tentando um parser alternativo...',
      });
      try {
        await runBookConversion('blob-url');
        pushNotice('Markdown gerado com parser alternativo.', 'success');
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        setConversionError(fallbackMessage);
        setMarkdownContent(`Erro ao converter o livro para Markdown.\n\n${fallbackMessage}`);
        setConversionDetails([`Tentativa principal: ${primaryMessage}`, `Fallback: ${fallbackMessage}`]);
        setConversionProgress({
          phase: 'error',
          progress: 100,
          message: 'A conversão falhou.',
        });
        pushNotice('A conversão não foi concluída.', 'error');
      }
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownloadSource = () => {
    const activeBook = books.find((book) => book.id === activeBookId);
    if (!activeBook || !activeBookData) return;
    const extension = activeBook.format === 'pdf' ? 'pdf' : 'epub';
    const mime = activeBook.format === 'pdf' ? 'application/pdf' : 'application/epub+zip';
    const blob = new Blob([activeBookData], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${activeBook.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const activeBook = books.find((book) => book.id === activeBookId);
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

  return (
    <>
      {activeBookId && activeBookData ? (
        <ReaderWorkspace
          activeBook={activeBook}
          activeBookData={activeBookData}
          activeSection={activeSection}
          isActiveEpub={isActiveEpub}
          readerFontScale={readerFontScale}
          readerTheme={readerTheme}
          location={location}
          markdownContent={markdownContent}
          isConverting={isConverting}
          conversionProgress={conversionProgress}
          conversionMetrics={conversionMetrics}
          conversionError={conversionError}
          conversionDetails={conversionDetails}
          syncStatus={syncStatus}
          onBackToLibrary={handleBackToLibrary}
          onSetActiveSection={setActiveSection}
          onSetReaderFontScale={setReaderFontScale}
          onSetReaderTheme={setReaderTheme}
          onLocationChange={(loc, href) => {
            setLocation(loc);
            setLocationHref(href);
          }}
          onDownloadSource={handleDownloadSource}
          onConvertBook={handleConvertBook}
        />
      ) : (
        <LibraryView
          books={books}
          filteredBooks={filteredBooks}
          isLoadingBooks={isLoadingBooks}
          isOpeningBook={isOpeningBook}
          openingBookId={openingBookId}
          isUploading={isUploading}
          searchQuery={searchQuery}
          formatFilter={formatFilter}
          sortBy={sortBy}
          onSearchQueryChange={setSearchQuery}
          onFormatFilterChange={setFormatFilter}
          onSortByChange={setSortBy}
          onUpload={handleUpload}
          onSelectBook={handleSelectBook}
          onDeleteBook={handleDeleteBook}
          libraryTaskStatus={libraryTaskStatus}
        />
      )}

      <NoticeStack notices={notices} onDismiss={dismissNotice} />
    </>
  );
}
