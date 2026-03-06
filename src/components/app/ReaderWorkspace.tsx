import React, { Suspense, lazy } from 'react';
import { ArrowLeft, BookOpen, Download, FileText, Loader2, Sparkles } from 'lucide-react';
import { BookRecord } from '../../services/db';
import type { ConversionMetrics, ConversionProgress } from '../../services/epubService';
import { ReaderTheme, formatBytes } from './ui';

const EpubViewer = lazy(() =>
  import('../EpubViewer').then((module) => ({ default: module.EpubViewer })),
);
const MarkdownViewer = lazy(() =>
  import('../MarkdownViewer').then((module) => ({ default: module.MarkdownViewer })),
);
const PdfViewer = lazy(() =>
  import('../PdfViewer').then((module) => ({ default: module.PdfViewer })),
);

interface ReaderWorkspaceProps {
  activeBook?: Omit<BookRecord, 'data'>;
  activeBookData: ArrayBuffer;
  activeSection: 'reader' | 'converter';
  isActiveEpub: boolean;
  readerFontScale: number;
  readerTheme: ReaderTheme;
  location: string | number;
  markdownContent: string;
  isConverting: boolean;
  conversionProgress: ConversionProgress;
  conversionMetrics: ConversionMetrics | null;
  conversionError: string | null;
  conversionDetails: string[];
  syncStatus: 'idle' | 'saving' | 'saved' | 'error';
  onBackToLibrary: () => void;
  onSetActiveSection: (section: 'reader' | 'converter') => void;
  onSetReaderFontScale: React.Dispatch<React.SetStateAction<number>>;
  onSetReaderTheme: (theme: ReaderTheme) => void;
  onLocationChange: (location: string, href: string) => void;
  onDownloadSource: () => void;
  onConvertBook: () => void;
}

export const ReaderWorkspace = React.memo(function ReaderWorkspace({
  activeBook,
  activeBookData,
  activeSection,
  isActiveEpub,
  readerFontScale,
  readerTheme,
  location,
  markdownContent,
  isConverting,
  conversionProgress,
  conversionMetrics,
  conversionError,
  conversionDetails,
  syncStatus,
  onBackToLibrary,
  onSetActiveSection,
  onSetReaderFontScale,
  onSetReaderTheme,
  onLocationChange,
  onDownloadSource,
  onConvertBook,
}: ReaderWorkspaceProps) {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-transparent p-2 sm:p-3">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)] backdrop-blur">
        <header className="border-b border-[color:var(--border)] bg-[color:var(--surface-strong)]/90 px-3 py-3 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <button
                onClick={onBackToLibrary}
                className="rounded-2xl border border-[color:var(--border)] bg-white/80 p-2.5 text-[color:var(--text)] transition hover:border-[color:var(--border-strong)] hover:bg-white"
                aria-label="Voltar para biblioteca"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
                  Workspace de leitura
                </p>
                <h2
                  className="mt-1 truncate text-xl font-semibold text-[color:var(--text)] sm:text-2xl"
                  style={{ fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif' }}
                >
                  {activeBook?.title || 'Leitor'}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-muted)]">
                  <span className="rounded-full bg-[color:var(--surface-muted)] px-2.5 py-1">
                    {activeBook?.format?.toUpperCase()}
                  </span>
                  <span className="rounded-full bg-[color:var(--surface-muted)] px-2.5 py-1">
                    {activeBook ? formatBytes(activeBook.sizeBytes) : ''}
                  </span>
                  <span className="rounded-full bg-[color:var(--surface-muted)] px-2.5 py-1">
                    {activeBook?.author}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 ${
                      syncStatus === 'error'
                        ? 'bg-rose-100 text-rose-900'
                        : syncStatus === 'saved'
                          ? 'bg-emerald-100 text-emerald-900'
                          : syncStatus === 'saving'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]'
                    }`}
                  >
                    {syncStatus === 'error'
                      ? 'Falha ao salvar'
                      : syncStatus === 'saved'
                        ? 'Progresso salvo'
                        : syncStatus === 'saving'
                          ? 'Salvando progresso'
                          : 'Leitura local'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              {activeSection === 'reader' && isActiveEpub && (
                <div className="flex flex-col gap-2 md:flex-row">
                  <div className="flex items-center overflow-hidden rounded-2xl border border-[color:var(--border)] bg-white/80">
                    <button
                      onClick={() => onSetReaderFontScale((value) => Math.max(85, value - 5))}
                      className="px-3 py-2 text-xs font-semibold text-[color:var(--text)] transition hover:bg-[color:var(--surface-muted)]"
                      aria-label="Diminuir tamanho da fonte"
                    >
                      A-
                    </button>
                    <span className="min-w-[58px] border-x border-[color:var(--border)] px-3 text-center text-[11px] text-[color:var(--text-muted)]">
                      {readerFontScale}%
                    </span>
                    <button
                      onClick={() => onSetReaderFontScale((value) => Math.min(150, value + 5))}
                      className="px-3 py-2 text-xs font-semibold text-[color:var(--text)] transition hover:bg-[color:var(--surface-muted)]"
                      aria-label="Aumentar tamanho da fonte"
                    >
                      A+
                    </button>
                  </div>
                  <div className="flex items-center gap-1 rounded-2xl border border-[color:var(--border)] bg-white/80 p-1">
                    {[
                      ['light', 'Claro'],
                      ['sepia', 'Sépia'],
                      ['dark', 'Noturno'],
                    ].map(([themeValue, label]) => (
                      <button
                        key={themeValue}
                        onClick={() => onSetReaderTheme(themeValue as ReaderTheme)}
                        className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
                          readerTheme === themeValue
                            ? 'bg-[color:var(--text)] text-white'
                            : 'text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className="flex rounded-2xl border border-[color:var(--border)] bg-white/80 p-1">
                  <button
                    onClick={() => onSetActiveSection('reader')}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      activeSection === 'reader'
                        ? 'bg-[color:var(--accent)] text-white shadow-sm'
                        : 'text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)]'
                    }`}
                  >
                    <BookOpen size={15} />
                    Leitura
                  </button>
                  {isActiveEpub && (
                    <button
                      onClick={() => onSetActiveSection('converter')}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        activeSection === 'converter'
                          ? 'bg-[color:var(--accent)] text-white shadow-sm'
                          : 'text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)]'
                      }`}
                    >
                      <FileText size={15} />
                      Markdown
                    </button>
                  )}
                </div>

                <button
                  onClick={onDownloadSource}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-white/80 px-4 py-2.5 text-sm font-semibold text-[color:var(--text)] transition hover:border-[color:var(--border-strong)] hover:bg-white"
                >
                  <Download size={15} />
                  Baixar original
                </button>

                {activeSection === 'converter' && isActiveEpub && (
                  <button
                    onClick={onConvertBook}
                    disabled={isConverting}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isConverting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {isConverting ? 'Convertendo...' : 'Gerar Markdown'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className={`relative flex-1 overflow-hidden ${activeSection === 'reader' ? 'pb-20 md:pb-0' : ''}`}>
          {activeSection === 'reader' && isActiveEpub && (
            <div className="border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3 md:hidden">
              <div className="grid gap-2">
                <div className="flex items-center overflow-hidden rounded-2xl border border-[color:var(--border)] bg-white/80">
                  <button
                    onClick={() => onSetReaderFontScale((value) => Math.max(85, value - 5))}
                    className="flex-1 py-2 text-xs font-semibold text-[color:var(--text)]"
                  >
                    A-
                  </button>
                  <span className="min-w-[56px] border-x border-[color:var(--border)] px-2 text-center text-[11px] text-[color:var(--text-muted)]">
                    {readerFontScale}%
                  </span>
                  <button
                    onClick={() => onSetReaderFontScale((value) => Math.min(150, value + 5))}
                    className="flex-1 py-2 text-xs font-semibold text-[color:var(--text)]"
                  >
                    A+
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['light', 'Claro'],
                    ['sepia', 'Sépia'],
                    ['dark', 'Noturno'],
                  ].map(([themeValue, label]) => (
                    <button
                      key={themeValue}
                      onClick={() => onSetReaderTheme(themeValue as ReaderTheme)}
                      className={`h-9 rounded-xl border text-[11px] font-semibold transition ${
                        readerTheme === themeValue
                          ? 'border-transparent bg-[color:var(--text)] text-white'
                          : 'border-[color:var(--border)] bg-white/80 text-[color:var(--text-muted)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'reader' && isActiveEpub ? (
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center text-[color:var(--text-muted)]">
                  <Loader2 size={20} className="mr-2 animate-spin text-[color:var(--accent)]" />
                  Carregando leitor...
                </div>
              }
            >
              <EpubViewer
                bookData={activeBookData}
                location={location}
                fontScale={readerFontScale}
                theme={readerTheme}
                onLocationChange={onLocationChange}
                onTocReady={() => {}}
                onBookReady={() => {}}
              />
            </Suspense>
          ) : activeSection === 'reader' ? (
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center text-[color:var(--text-muted)]">
                  <Loader2 size={20} className="mr-2 animate-spin text-[color:var(--accent)]" />
                  Carregando PDF...
                </div>
              }
            >
              <PdfViewer fileData={activeBookData} />
            </Suspense>
          ) : (
            <div className="flex h-full flex-col bg-[color:var(--surface-muted)]">
              <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
                      Estação de exportação
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-[color:var(--text)]">
                      Converter o livro inteiro para Markdown
                    </h3>
                    <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                      Gere uma base editável para revisão, resumo ou republicação interna.
                    </p>
                  </div>
                  <button
                    onClick={onConvertBook}
                    disabled={isConverting}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isConverting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {isConverting ? 'Convertendo agora...' : 'Gerar Markdown completo'}
                  </button>
                </div>
              </div>

              <div className="border-b border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-[color:var(--text)]">{conversionProgress.message}</span>
                  <span className="text-[color:var(--text-muted)]">{Math.round(conversionProgress.progress)}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--surface-muted)]">
                  <div
                    className={`h-full transition-all duration-300 ${
                      conversionProgress.phase === 'error' ? 'bg-rose-500' : 'bg-[color:var(--accent)]'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, conversionProgress.progress))}%` }}
                  />
                </div>

                {conversionMetrics && (
                  <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                      ['Capítulos', conversionMetrics.totalChapters],
                      ['Convertidos', conversionMetrics.convertedChapters],
                      ['Falhas', conversionMetrics.failedChapters],
                      ['Duração', `${(conversionMetrics.durationMs / 1000).toFixed(1)}s`],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-[color:var(--border)] bg-white/80 p-3"
                      >
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                          {label}
                        </p>
                        <p className="mt-1 text-xl font-semibold text-[color:var(--text)]">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {conversionError && (
                  <div className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 p-4">
                    <p className="text-sm font-semibold text-rose-900">A conversão falhou.</p>
                    <p className="mt-1 text-sm text-rose-800">{conversionError}</p>
                  </div>
                )}

                {conversionDetails.length > 0 && (
                  <details className="mt-4 rounded-2xl border border-[color:var(--border)] bg-white/70 p-4">
                    <summary className="cursor-pointer text-sm font-medium text-[color:var(--text)]">
                      Ver detalhes técnicos
                    </summary>
                    <ul className="mt-3 space-y-1 text-sm text-[color:var(--text-muted)]">
                      {conversionDetails.slice(0, 6).map((detail, index) => (
                        <li key={`${detail}-${index}`}>- {detail}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>

              <Suspense
                fallback={
                  <div className="absolute inset-0 flex items-center justify-center text-[color:var(--text-muted)]">
                    <Loader2 size={20} className="mr-2 animate-spin text-[color:var(--accent)]" />
                    Carregando Markdown...
                  </div>
                }
              >
                <MarkdownViewer markdown={markdownContent} title={activeBook?.title || 'livro'} />
              </Suspense>
            </div>
          )}
        </main>

        <div className="fixed inset-x-2 bottom-2 z-20 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-strong)]/95 p-2 shadow-[var(--shadow-card)] backdrop-blur md:hidden">
          <div className={`grid gap-2 ${isActiveEpub ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <button
              onClick={onBackToLibrary}
              className="h-11 rounded-2xl border border-[color:var(--border)] bg-white/70 text-xs font-semibold text-[color:var(--text)]"
            >
              Biblioteca
            </button>
            {isActiveEpub && (
              <button
                onClick={() => onSetActiveSection('converter')}
                className="h-11 rounded-2xl bg-[color:var(--accent)] text-xs font-semibold text-white"
              >
                Markdown
              </button>
            )}
            <button
              onClick={onDownloadSource}
              className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-[color:var(--border)] bg-white/70 text-xs font-semibold text-[color:var(--text)]"
            >
              <Download size={14} />
              Baixar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
