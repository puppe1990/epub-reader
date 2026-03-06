import React from 'react';
import { BookMarked, Loader2, Search, Sparkles, Trash2, Upload } from 'lucide-react';
import { BookRecord, LibraryTaskStatus } from '../../services/db';
import { formatAddedAt, formatBytes } from './ui';

interface LibraryViewProps {
  books: Omit<BookRecord, 'data'>[];
  filteredBooks: Omit<BookRecord, 'data'>[];
  isLoadingBooks: boolean;
  isOpeningBook: boolean;
  openingBookId: string | null;
  isUploading: boolean;
  searchQuery: string;
  formatFilter: 'all' | 'epub' | 'pdf';
  sortBy: 'recent' | 'title' | 'author';
  onSearchQueryChange: (value: string) => void;
  onFormatFilterChange: (value: 'all' | 'epub' | 'pdf') => void;
  onSortByChange: (value: 'recent' | 'title' | 'author') => void;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectBook: (id: string) => void;
  onDeleteBook: (id: string) => void;
  libraryTaskStatus: LibraryTaskStatus | null;
}

export const LibraryView = React.memo(function LibraryView({
  books,
  filteredBooks,
  isLoadingBooks,
  isOpeningBook,
  openingBookId,
  isUploading,
  searchQuery,
  formatFilter,
  sortBy,
  onSearchQueryChange,
  onFormatFilterChange,
  onSortByChange,
  onUpload,
  onSelectBook,
  onDeleteBook,
  libraryTaskStatus,
}: LibraryViewProps) {
  const totalLibraryBytes = books.reduce((sum, book) => sum + book.sizeBytes, 0);

  return (
    <div className="min-h-dvh px-4 py-4 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="relative overflow-hidden rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)] backdrop-blur sm:p-8">
          <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-[color:var(--accent-soft)] to-transparent lg:block" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
                <Sparkles size={14} className="text-[color:var(--accent)]" />
                Estante editorial
              </p>
              <h1
                className="max-w-xl text-3xl font-semibold tracking-tight text-[color:var(--text)] sm:text-5xl"
                style={{ fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif' }}
              >
                Leitura limpa, biblioteca enxuta, conversão sem ruído.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[color:var(--text-muted)] sm:text-base">
                Envie EPUBs e PDFs, organize a biblioteca e volte direto para o ponto onde parou. O
                foco aqui é leitura, não interface gritando.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
              <div className="rounded-2xl border border-[color:var(--border)] bg-white/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Títulos</p>
                <p className="mt-2 text-3xl font-semibold text-[color:var(--text)]">{books.length}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-white/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Formatos</p>
                <p className="mt-2 text-3xl font-semibold text-[color:var(--text)]">
                  {new Set(books.map((book) => book.format)).size || 0}
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-white/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Acervo</p>
                <p className="mt-2 text-3xl font-semibold text-[color:var(--text)]">
                  {formatBytes(totalLibraryBytes || 0)}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_0.85fr]">
          <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-card)] backdrop-blur sm:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]"
                />
                <input
                  value={searchQuery}
                  onChange={(event) => onSearchQueryChange(event.target.value)}
                  placeholder="Buscar por título ou autor"
                  className="h-11 w-full rounded-2xl border border-[color:var(--border)] bg-white/90 pl-10 pr-4 text-sm text-[color:var(--text)] outline-none transition focus:border-[color:var(--border-strong)] focus:ring-4 focus:ring-[color:var(--accent-soft)]"
                />
              </div>
              <select
                value={formatFilter}
                onChange={(event) => onFormatFilterChange(event.target.value as 'all' | 'epub' | 'pdf')}
                className="h-11 rounded-2xl border border-[color:var(--border)] bg-white/90 px-4 text-sm text-[color:var(--text)] outline-none"
              >
                <option value="all">Todos os formatos</option>
                <option value="epub">Só EPUB</option>
                <option value="pdf">Só PDF</option>
              </select>
              <select
                value={sortBy}
                onChange={(event) => onSortByChange(event.target.value as 'recent' | 'title' | 'author')}
                className="h-11 rounded-2xl border border-[color:var(--border)] bg-white/90 px-4 text-sm text-[color:var(--text)] outline-none"
              >
                <option value="recent">Mais recentes</option>
                <option value="title">Título A-Z</option>
                <option value="author">Autor A-Z</option>
              </select>
            </div>
          </div>

          <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-card)] backdrop-blur sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
              Entrada rápida
            </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row lg:flex-col">
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)]">
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {isUploading ? 'Enviando...' : 'Adicionar EPUB ou PDF'}
                <input
                  type="file"
                  accept=".epub,.pdf,application/epub+zip,application/pdf"
                  className="hidden"
                  onChange={onUpload}
                  disabled={isUploading}
                />
              </label>
                <div className="rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-white/60 px-4 py-3 text-sm text-[color:var(--text-muted)]">
                  Limite atual de 25 MB por arquivo. PDFs tentam gerar uma cópia EPUB automaticamente.
                </div>
                {libraryTaskStatus && (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      libraryTaskStatus.tone === 'error'
                        ? 'border-rose-300 bg-rose-50 text-rose-900'
                        : libraryTaskStatus.tone === 'success'
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                          : 'border-[color:var(--border)] bg-white/70 text-[color:var(--text)]'
                    }`}
                  >
                    {libraryTaskStatus.message}
                  </div>
                )}
              </div>
            </div>
          </section>

        {isOpeningBook && (
          <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-4 py-3 text-sm text-[color:var(--text)] shadow-[var(--shadow-card)]">
            <Loader2 size={16} className="animate-spin text-[color:var(--accent)]" />
            Abrindo o livro selecionado...
          </div>
        )}

        {isLoadingBooks ? (
          <div className="flex min-h-[46vh] flex-col items-center justify-center rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] text-center shadow-[var(--shadow-soft)]">
            <Loader2 size={30} className="animate-spin text-[color:var(--accent)]" />
            <p className="mt-4 text-sm font-medium text-[color:var(--text)]">Carregando sua biblioteca...</p>
          </div>
        ) : books.length === 0 ? (
          <div className="grid min-h-[46vh] gap-6 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-soft)] lg:grid-cols-[1.05fr_0.95fr] lg:p-10">
            <div className="flex flex-col justify-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
                Biblioteca vazia
              </p>
              <h2
                className="mt-3 text-3xl font-semibold text-[color:var(--text)] sm:text-4xl"
                style={{ fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif' }}
              >
                Sua estante ainda está em branco.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-[color:var(--text-muted)] sm:text-base">
                Faça upload do primeiro EPUB ou PDF para destravar leitura, progresso remoto e
                conversão para Markdown.
              </p>
            </div>

            <div className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5 shadow-[var(--shadow-card)]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
                Exemplo de saída
              </p>
              <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-[color:var(--surface-muted)] p-4 font-mono text-sm leading-7 text-[color:var(--text)]">
{`# Título do livro

## Capítulo 1

Texto convertido para Markdown com estrutura pronta para copiar, baixar ou revisar.`}
              </pre>
            </div>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="flex min-h-[34vh] items-center justify-center rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] px-6 text-center text-sm text-[color:var(--text-muted)] shadow-[var(--shadow-card)]">
            Nenhum livro corresponde aos filtros atuais.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {filteredBooks.map((book) => {
              const isOpening = openingBookId === book.id;
              return (
                <article
                  key={book.id}
                  className="group relative overflow-hidden rounded-[26px] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-card)] transition duration-300 hover:-translate-y-1 hover:border-[color:var(--border-strong)]"
                >
                  <button
                    type="button"
                    disabled={isOpeningBook}
                    onClick={() => onSelectBook(book.id)}
                    className="block w-full text-left disabled:cursor-wait"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-[color:var(--surface-muted)]">
                      {book.coverUrl ? (
                        <img
                          src={book.coverUrl}
                          alt={book.title}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(138,61,31,0.12),_transparent_60%)] text-[color:var(--text-muted)]">
                          <BookMarked size={44} />
                        </div>
                      )}

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent px-4 pb-4 pt-10">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white">
                            {book.format}
                          </span>
                          <span className="text-[11px] text-white/80">{formatBytes(book.sizeBytes)}</span>
                        </div>
                      </div>

                      {isOpening && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white backdrop-blur-[2px]">
                          <Loader2 size={24} className="animate-spin" />
                          <span className="mt-2 text-xs font-semibold uppercase tracking-[0.22em]">
                            Abrindo
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 p-4">
                      <div>
                        <h3 className="line-clamp-2 text-lg font-semibold text-[color:var(--text)]">
                          {book.title}
                        </h3>
                        <p className="mt-1 truncate text-sm text-[color:var(--text-muted)]">{book.author}</p>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                        <span className="rounded-full bg-[color:var(--surface-muted)] px-2.5 py-1">
                          {formatAddedAt(book.addedAt)}
                        </span>
                        <span className="rounded-full bg-[color:var(--surface-muted)] px-2.5 py-1">
                          {book.format === 'pdf' ? 'Leitura PDF' : 'Reader + Markdown'}
                        </span>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    aria-label={`Remover ${book.title}`}
                    disabled={isOpeningBook}
                    onClick={() => onDeleteBook(book.id)}
                    className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/45 p-2 text-white/90 opacity-100 transition hover:bg-black/70 sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
