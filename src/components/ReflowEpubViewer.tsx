import React, { useEffect, useMemo, useState } from 'react';
import type { ExtractedReflowSection } from '../services/epubService';

interface ReflowEpubViewerProps {
  bookData: ArrayBuffer;
  bookId: string;
  sectionIndex: number;
  fontScale: number;
  theme: 'light' | 'sepia' | 'dark';
  onSectionChange: (sectionIndex: number, href: string) => void;
  initialScrollTop?: number;
  initialAnchorId?: string;
  onProgressSnapshotChange?: (snapshot: { sectionIndex: number; href: string; scrollTop: number; anchorId?: string }) => void;
}

type ReflowScrollMap = Record<string, number>;

type SectionMeta = {
  section: ExtractedReflowSection;
  text: string;
  blockCount: number;
  isFrontMatter: boolean;
};

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, index));
}

function normalizeSectionText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeHrefBase(href: string): string {
  return href.split('#')[0].trim();
}

function getHrefHash(href: string): string | null {
  const hashIndex = href.indexOf('#');
  if (hashIndex < 0 || hashIndex === href.length - 1) return null;
  return href.slice(hashIndex + 1).trim() || null;
}

function detectFrontMatter(section: ExtractedReflowSection, index: number, total: number): boolean {
  if (index > Math.min(5, total - 1)) return false;

  const title = section.title.toLowerCase();
  const text = normalizeSectionText(section.html);
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const shortWords = words.length <= 90;
  const mentionsCopyright =
    /\bcopyright\b|\ball rights reserved\b|\bisbn\b|\bpublished\b|\bpublisher\b/.test(lower);
  const mentionsContents = /\bcontents\b|\bsum[aá]rio\b|\btable of contents\b/.test(lower);
  const titleLike = /\bcover\b|\bcapa\b|\btitle\b|\bt[íi]tulo\b|\backnowledg/.test(title);
  const mostlyMetadata =
    /@\w+/.test(text) ||
    /\bv\d+(?:\.\d+)*\b/i.test(text) ||
    (shortWords && !/[.!?…:;]/.test(text));

  return mentionsCopyright || mentionsContents || titleLike || mostlyMetadata;
}

export const ReflowEpubViewer: React.FC<ReflowEpubViewerProps> = ({
  bookData,
  bookId,
  sectionIndex,
  fontScale,
  theme,
  onSectionChange,
  initialScrollTop,
  initialAnchorId,
  onProgressSnapshotChange,
}) => {
  const [sections, setSections] = useState<ExtractedReflowSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMobileTocOpen, setIsMobileTocOpen] = useState(false);
  const [tocQuery, setTocQuery] = useState('');
  const articleScrollRef = React.useRef<HTMLDivElement | null>(null);
  const restorationFrameRef = React.useRef<number | null>(null);
  const pendingAnchorRef = React.useRef<string | null>(null);
  const scrollPersistTimerRef = React.useRef<number | null>(null);
  const activeNoteElementRef = React.useRef<HTMLElement | null>(null);
  const activeNoteTimerRef = React.useRef<number | null>(null);

  const highlightAnchor = React.useCallback((anchorId: string | null) => {
    if (activeNoteTimerRef.current !== null) {
      window.clearTimeout(activeNoteTimerRef.current);
      activeNoteTimerRef.current = null;
    }
    if (activeNoteElementRef.current) {
      activeNoteElementRef.current.removeAttribute('data-reflow-active-note');
      activeNoteElementRef.current = null;
    }
    if (!anchorId) return;

    const node = articleScrollRef.current;
    if (!node) return;

    const escapedId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(anchorId)
      : anchorId.replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, '\\$1');
    const target = node.querySelector<HTMLElement>(
      `[data-reflow-note-block][id="${escapedId}"], [data-reflow-note-block][data-reflow-anchor="${escapedId}"], #${escapedId}[data-reflow-note-block]`,
    );
    if (!target) return;

    target.setAttribute('data-reflow-active-note', 'true');
    activeNoteElementRef.current = target;
    activeNoteTimerRef.current = window.setTimeout(() => {
      target.removeAttribute('data-reflow-active-note');
      if (activeNoteElementRef.current === target) {
        activeNoteElementRef.current = null;
      }
      activeNoteTimerRef.current = null;
    }, 2200);
  }, []);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setLoadError(null);

    import('../services/epubService')
      .then(({ extractBookReflowSectionsFromBuffer }) => extractBookReflowSectionsFromBuffer(bookData))
      .then((nextSections) => {
        if (cancelled) return;
        setSections(nextSections);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : 'Falha ao extrair capítulos do EPUB.');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bookData]);

  const sectionMetas = useMemo<SectionMeta[]>(() => {
    return sections.map((section, index) => {
      const text = normalizeSectionText(section.html);
      const blockCount = (section.html.match(/<(p|li|blockquote|h1|h2|h3|h4|h5|h6)\b/gi) || []).length;
      return {
        section,
        text,
        blockCount,
        isFrontMatter: detectFrontMatter(section, index, sections.length),
      };
    });
  }, [sections]);

  const firstMainSectionIndex = useMemo(() => {
    const found = sectionMetas.findIndex((meta) => !meta.isFrontMatter && meta.text.length > 240);
    return found >= 0 ? found : 0;
  }, [sectionMetas]);

  const filteredSectionMetas = useMemo(() => {
    const query = tocQuery.trim().toLowerCase();
    if (!query) return sectionMetas;
    return sectionMetas.filter((meta, index) => {
      const prefix = meta.isFrontMatter ? 'abertura' : `capítulo ${index + 1}`;
      return (
        meta.section.title.toLowerCase().includes(query) ||
        prefix.includes(query)
      );
    });
  }, [sectionMetas, tocQuery]);

  const requestedIndex = clampIndex(sectionIndex, sections.length);
  const safeIndex =
    requestedIndex === 0 && firstMainSectionIndex > 0 ? firstMainSectionIndex : requestedIndex;
  const currentMeta = sectionMetas[safeIndex] || null;
  const currentSection = currentMeta?.section || null;
  const progressPercent =
    currentSection && sections.length > 0 ? Math.round(((safeIndex + 1) / sections.length) * 100) : 0;
  const scrollStorageKey = `reflow-scroll:${bookId}`;

  useEffect(() => {
    if (!currentSection) return;
    onSectionChange(safeIndex, currentSection.href);
  }, [currentSection, onSectionChange, safeIndex]);

  useEffect(() => {
    setIsMobileTocOpen(false);
  }, [safeIndex]);

  useEffect(() => {
    if (!currentSection) return;
    const node = articleScrollRef.current;
    if (!node) return;

    let nextScrollTop = typeof initialScrollTop === 'number' && Number.isFinite(initialScrollTop) ? initialScrollTop : 0;
    try {
      const stored = window.localStorage.getItem(scrollStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as ReflowScrollMap;
        const raw = parsed[currentSection.href];
        if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
          nextScrollTop = raw;
        }
      }
    } catch {
      nextScrollTop = typeof initialScrollTop === 'number' && Number.isFinite(initialScrollTop) ? initialScrollTop : 0;
    }

    if (restorationFrameRef.current !== null) {
      window.cancelAnimationFrame(restorationFrameRef.current);
    }
    restorationFrameRef.current = window.requestAnimationFrame(() => {
      node.scrollTop = nextScrollTop;
      const anchorId = pendingAnchorRef.current || initialAnchorId;
      if (anchorId) {
        const escapedId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(anchorId)
          : anchorId.replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, '\\$1');
        const target = node.querySelector<HTMLElement>(`[data-reflow-anchor="${escapedId}"], #${escapedId}, a[name="${anchorId}"]`);
        if (target) {
          target.scrollIntoView({ block: 'start' });
          highlightAnchor(anchorId);
        }
        pendingAnchorRef.current = null;
      }
      restorationFrameRef.current = null;
    });
  }, [currentSection, fontScale, highlightAnchor, initialAnchorId, initialScrollTop, scrollStorageKey, theme]);

  useEffect(() => {
    const node = articleScrollRef.current;
    if (!node || !currentSection) return;

    const onScroll = (): void => {
      const currentScrollTop = node.scrollTop;
      const anchors = Array.from(
        node.querySelectorAll('[data-reflow-anchor]'),
      ) as HTMLElement[];
      let currentAnchor: HTMLElement | null = null;
      for (const element of anchors) {
        if (element.offsetTop >= currentScrollTop - 24) {
          currentAnchor = element;
          break;
        }
        if (element.offsetTop <= currentScrollTop + 24) {
          currentAnchor = element;
        }
      }
      const anchorId = currentAnchor?.getAttribute('data-reflow-anchor') || undefined;
      try {
        const stored = window.localStorage.getItem(scrollStorageKey);
        const parsed = stored ? (JSON.parse(stored) as ReflowScrollMap) : {};
        parsed[currentSection.href] = currentScrollTop;
        window.localStorage.setItem(scrollStorageKey, JSON.stringify(parsed));
      } catch {
        // Best-effort persistence only.
      }

      if (scrollPersistTimerRef.current !== null) {
        window.clearTimeout(scrollPersistTimerRef.current);
      }
      scrollPersistTimerRef.current = window.setTimeout(() => {
        onProgressSnapshotChange?.({
          sectionIndex: safeIndex,
          href: currentSection.href,
          scrollTop: currentScrollTop,
          anchorId,
        });
      }, 250);
    };

    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, [currentSection, onProgressSnapshotChange, safeIndex, scrollStorageKey]);

  useEffect(() => {
    const node = articleScrollRef.current;
    if (!node || !currentSection) return;

    const hrefIndex = new Map<string, number>();
    sectionMetas.forEach((meta, index) => {
      hrefIndex.set(normalizeHrefBase(meta.section.href), index);
    });

    const onClick = (event: MouseEvent): void => {
      const target = event.target as Element | null;
      const link = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!link) return;
      const rawHref = link.getAttribute('href') || '';
      if (!rawHref) return;

      if (rawHref.startsWith('#')) {
        event.preventDefault();
        const anchorId = rawHref.slice(1);
        const escapedId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(anchorId)
          : anchorId.replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, '\\$1');
        const element = node.querySelector<HTMLElement>(`#${escapedId}, a[name="${anchorId}"]`);
        element?.scrollIntoView({ block: 'start' });
        highlightAnchor(anchorId);
        return;
      }

      if (/^(https?:\/\/|mailto:|tel:)/i.test(rawHref)) return;

      const nextBase = normalizeHrefBase(rawHref);
      const nextIndex = hrefIndex.get(nextBase);
      if (nextIndex === undefined) return;

      event.preventDefault();
      const nextAnchor = getHrefHash(rawHref);
      pendingAnchorRef.current = nextAnchor;
      highlightAnchor(nextBase === normalizeHrefBase(currentSection.href) ? nextAnchor : null);
      goToSection(nextIndex);
    };

    node.addEventListener('click', onClick);
    return () => node.removeEventListener('click', onClick);
  }, [currentSection, highlightAnchor, sectionMetas]);

  useEffect(() => {
    return () => {
      if (restorationFrameRef.current !== null) {
        window.cancelAnimationFrame(restorationFrameRef.current);
      }
      if (scrollPersistTimerRef.current !== null) {
        window.clearTimeout(scrollPersistTimerRef.current);
      }
      if (activeNoteTimerRef.current !== null) {
        window.clearTimeout(activeNoteTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!currentSection) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        const nextIndex = clampIndex(safeIndex + 1, sections.length);
        onSectionChange(nextIndex, sections[nextIndex]?.href || currentSection.href);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        const nextIndex = clampIndex(safeIndex - 1, sections.length);
        onSectionChange(nextIndex, sections[nextIndex]?.href || currentSection.href);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentSection, onSectionChange, safeIndex, sections]);

  const palette = useMemo(() => {
    if (theme === 'dark') {
      return {
        shell: 'border-white/8 bg-[rgba(9,9,9,0.64)] text-white/90 shadow-[0_32px_90px_rgba(0,0,0,0.55)]',
        page: 'linear-gradient(180deg, rgba(28,28,28,0.98), rgba(20,20,20,0.98))',
        meta: 'text-white/48',
        accent: 'bg-white/10',
        button: 'border-white/10 bg-white/4 text-white hover:bg-white/10',
      };
    }

    if (theme === 'sepia') {
      return {
        shell: 'border-[rgba(110,86,55,0.18)] bg-[rgba(255,248,238,0.76)] text-[#402f20] shadow-[0_30px_70px_rgba(114,88,57,0.16)]',
        page: 'linear-gradient(180deg, rgba(255,252,246,0.98), rgba(244,233,212,0.98))',
        meta: 'text-[#7f694f]',
        accent: 'bg-[#8e6640]/18',
        button: 'border-[rgba(71,57,40,0.1)] bg-white/72 text-[#332418] hover:bg-white',
      };
    }

    return {
      shell: 'border-[rgba(71,57,40,0.12)] bg-[rgba(255,253,249,0.78)] text-[#2f2418] shadow-[0_28px_68px_rgba(91,67,39,0.12)]',
      page: 'linear-gradient(180deg, rgba(255,255,253,0.98), rgba(247,240,231,0.98))',
      meta: 'text-[#7c6550]',
      accent: 'bg-[#7e5634]/14',
      button: 'border-[rgba(71,57,40,0.1)] bg-white/72 text-[#2f2418] hover:bg-white',
    };
  }, [theme]);

  const readerSurfaceClass =
    theme === 'dark'
      ? 'bg-[#0d0d0d]'
      : theme === 'sepia'
        ? 'bg-[#eadfc9]'
        : 'bg-[#ebe1d2]';

  const goToSection = (nextIndex: number): void => {
    const normalized = clampIndex(nextIndex, sections.length);
    const nextSection = sections[normalized];
    onSectionChange(normalized, nextSection?.href || currentSection?.href || '');
  };

  const renderTocButton = (
    meta: SectionMeta,
    index: number,
    compact = false,
  ): React.ReactElement => {
    const active = index === safeIndex;
    return (
      <button
        key={meta.section.id}
        type="button"
        onClick={() => {
          goToSection(index);
          setIsMobileTocOpen(false);
        }}
        className={`block w-full rounded-2xl px-3 py-2.5 text-left transition ${
          active
            ? 'bg-[color:var(--accent)] text-white'
            : 'hover:bg-black/4'
        }`}
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
          {meta.isFrontMatter ? 'Abertura' : `Capítulo ${index + 1}`}
        </div>
        <div className={`mt-1 font-medium ${compact ? 'line-clamp-1 text-[13px]' : 'line-clamp-2 text-sm'}`}>
          {meta.section.title}
        </div>
      </button>
    );
  };

  return (
    <div className={`relative flex h-full w-full items-center justify-center overflow-hidden ${readerSurfaceClass}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.14),_transparent_34%),radial-gradient(circle_at_bottom,_rgba(0,0,0,0.08),_transparent_38%)]" />

      <div className={`relative mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden border ${palette.shell} my-4 rounded-[32px] sm:my-6`}>
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm">Preparando modo reflow...</div>
        ) : loadError ? (
          <div className="flex h-full items-center justify-center px-8 text-center text-sm text-rose-700">{loadError}</div>
        ) : !currentSection ? (
          <div className="flex h-full items-center justify-center px-8 text-center text-sm">
            Nenhum capítulo legível foi encontrado neste EPUB.
          </div>
        ) : (
          <>
            <header className="relative z-[1] flex flex-wrap items-end justify-between gap-4 border-b border-black/6 px-5 py-4 sm:px-8 sm:py-5">
              <div className="min-w-0">
                <p className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${palette.meta}`}>Modo reflow</p>
                <h3
                  className="mt-2 truncate text-lg font-semibold sm:text-xl"
                  style={{ fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif' }}
                >
                  {currentSection.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsMobileTocOpen((value) => !value)}
                  className={`mt-3 inline-flex items-center rounded-full border border-black/8 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] xl:hidden ${palette.button}`}
                >
                  {isMobileTocOpen ? 'Fechar capítulos' : 'Abrir capítulos'}
                </button>
              </div>
              <div className="flex flex-col items-stretch gap-3 sm:items-end">
                <label className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${palette.meta}`}>
                  Capítulo
                </label>
                <select
                  value={safeIndex}
                  onChange={(event) => goToSection(Number.parseInt(event.target.value, 10))}
                  className={`min-w-[220px] rounded-2xl border border-black/8 px-3 py-2 text-sm font-medium outline-none ${palette.button}`}
                >
                  {sectionMetas.map((meta, index) => (
                    <option key={meta.section.id} value={index}>
                      {meta.isFrontMatter ? `Abertura ${index + 1}. ${meta.section.title}` : `${index + 1}. ${meta.section.title}`}
                    </option>
                  ))}
                </select>
                <div className={`flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] ${palette.meta}`}>
                  <div className={`h-px w-10 ${palette.accent}`} />
                  <span>{safeIndex + 1} / {sections.length}</span>
                  <span>{progressPercent}% lido</span>
                </div>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-8 sm:py-7">
              {isMobileTocOpen && (
                <div className={`mb-4 overflow-auto rounded-[28px] border border-black/6 p-3 xl:hidden ${palette.button}`}>
                  <div className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] ${palette.meta}`}>Capítulos</div>
                  <input
                    value={tocQuery}
                    onChange={(event) => setTocQuery(event.target.value)}
                    placeholder="Buscar capítulo"
                    className="mb-3 w-full rounded-2xl border border-black/8 bg-white/60 px-3 py-2 text-sm outline-none"
                  />
                  <div className="grid gap-1 sm:grid-cols-2">
                    {filteredSectionMetas.map((meta) => {
                      const index = sectionMetas.findIndex((candidate) => candidate.section.id === meta.section.id);
                      return renderTocButton(meta, index, true);
                    })}
                  </div>
                </div>
              )}
              <div className="mx-auto flex h-full max-w-6xl gap-5">
                <aside className={`hidden w-72 shrink-0 overflow-auto rounded-[28px] border border-black/6 p-4 xl:block ${palette.button}`}>
                <div className={`mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] ${palette.meta}`}>Navegação</div>
                  <input
                    value={tocQuery}
                    onChange={(event) => setTocQuery(event.target.value)}
                    placeholder="Buscar capítulo"
                    className="mb-3 w-full rounded-2xl border border-black/8 bg-white/60 px-3 py-2 text-sm outline-none"
                  />
                  <div className="space-y-1">
                    {filteredSectionMetas.map((meta) => {
                      const index = sectionMetas.findIndex((candidate) => candidate.section.id === meta.section.id);
                      return renderTocButton(meta, index);
                    })}
                  </div>
                </aside>

                <div ref={articleScrollRef} className="min-w-0 flex-1 overflow-auto">
                  <article
                    className="mx-auto max-w-3xl rounded-[30px] border border-black/6 px-5 py-6 sm:px-10 sm:py-10"
                    style={{
                      background: palette.page,
                      fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
                      fontSize: `${Math.round(18 * (fontScale / 100))}px`,
                      lineHeight: String(1.78),
                    }}
                  >
                    <style>{`
                  .reflow-epub h1,
                  .reflow-epub h2,
                  .reflow-epub h3,
                  .reflow-epub h4,
                  .reflow-epub h5,
                  .reflow-epub h6 {
                    font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
                    line-height: 1.2;
                    margin: 1.5em 0 0.65em;
                    letter-spacing: -0.01em;
                  }
                  .reflow-epub h1 { font-size: 1.9em; }
                  .reflow-epub h2 { font-size: 1.55em; }
                  .reflow-epub h3 { font-size: 1.28em; }
                  .reflow-epub p,
                  .reflow-epub li,
                  .reflow-epub blockquote,
                  .reflow-epub pre,
                  .reflow-epub table,
                  .reflow-epub aside {
                    margin: 0 0 1.05em;
                  }
                  .reflow-epub figure,
                  .reflow-epub [data-reflow-figure="true"] {
                    margin: 1.6em 0;
                  }
                  .reflow-epub img,
                  .reflow-epub svg,
                  .reflow-epub video,
                  .reflow-epub canvas {
                    display: block;
                    max-width: 100%;
                    height: auto;
                    margin: 0 auto;
                    border-radius: 18px;
                  }
                  .reflow-epub figcaption {
                    margin-top: 0.8em;
                    text-align: center;
                    font-size: 0.82em;
                    line-height: 1.5;
                    opacity: 0.72;
                  }
                  .reflow-epub ul,
                  .reflow-epub ol {
                    padding-left: 1.35em;
                    margin: 0 0 1.05em;
                  }
                  .reflow-epub blockquote {
                    border-left: 3px solid rgba(138, 61, 31, 0.28);
                    padding-left: 1em;
                    opacity: 0.92;
                    font-style: italic;
                  }
                  .reflow-epub a {
                    color: inherit;
                    text-decoration-thickness: 1px;
                    text-underline-offset: 0.14em;
                  }
                  .reflow-epub a[data-reflow-note-ref="true"] {
                    font-size: 0.72em;
                    vertical-align: super;
                    text-decoration: none;
                    padding: 0.12em 0.38em;
                    border-radius: 999px;
                    background: rgba(122, 90, 52, 0.12);
                    margin-left: 0.1em;
                  }
                  .reflow-epub a[data-reflow-note-backlink="true"] {
                    font-size: 0.86em;
                    opacity: 0.75;
                  }
                  .reflow-epub hr {
                    border: 0;
                    border-top: 1px solid rgba(0,0,0,0.1);
                    margin: 2em 0;
                  }
                  .reflow-epub [data-reflow-table="true"] {
                    margin: 1.4em 0;
                    overflow-x: auto;
                    border: 1px solid rgba(0,0,0,0.08);
                    border-radius: 20px;
                    background: rgba(255,255,255,0.52);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.55);
                  }
                  .reflow-epub table {
                    width: 100%;
                    border-collapse: collapse;
                    min-width: 100%;
                    margin: 0;
                  }
                  .reflow-epub th,
                  .reflow-epub td {
                    border: 1px solid rgba(0,0,0,0.12);
                    padding: 0.45em 0.6em;
                  }
                  .reflow-epub th {
                    background: rgba(0,0,0,0.05);
                    font-weight: 700;
                  }
                  .reflow-epub code,
                  .reflow-epub pre {
                    font-family: "SFMono-Regular", "SF Mono", Menlo, Consolas, monospace;
                    font-size: 0.92em;
                  }
                  .reflow-epub pre {
                    overflow-x: auto;
                    padding: 1em;
                    border-radius: 18px;
                    background: rgba(0,0,0,0.06);
                  }
                  .reflow-epub > :first-child {
                    margin-top: 0;
                  }
                  .reflow-epub [data-reflow-anchor] {
                    scroll-margin-top: 24px;
                  }
                  .reflow-epub [data-reflow-note-block="true"] {
                    margin-top: 1.5em;
                    padding: 1em 1.1em;
                    border-radius: 20px;
                    border: 1px solid rgba(122, 90, 52, 0.14);
                    background: rgba(122, 90, 52, 0.06);
                  }
                  .reflow-epub [data-reflow-active-note="true"] {
                    outline: 2px solid rgba(172, 112, 52, 0.34);
                    background: rgba(172, 112, 52, 0.12);
                    transition: background 180ms ease, outline-color 180ms ease;
                  }
                `}</style>
                    <div className="reflow-epub" dangerouslySetInnerHTML={{ __html: currentSection.html }} />
                  </article>
                </div>
              </div>
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-black/6 px-4 py-3 sm:px-8 sm:py-4">
              <button
                type="button"
                onClick={() => goToSection(safeIndex - 1)}
                disabled={safeIndex === 0}
                className={`inline-flex h-11 items-center justify-center rounded-full border px-4 text-[11px] font-semibold uppercase tracking-[0.2em] transition disabled:cursor-not-allowed disabled:opacity-35 ${palette.button}`}
              >
                Capítulo anterior
              </button>
              <div className={`text-center text-[11px] uppercase tracking-[0.22em] ${palette.meta}`}>
                {currentSection.title}
              </div>
              <button
                type="button"
                onClick={() => goToSection(safeIndex + 1)}
                disabled={safeIndex >= sections.length - 1}
                className={`inline-flex h-11 items-center justify-center rounded-full border px-4 text-[11px] font-semibold uppercase tracking-[0.2em] transition disabled:cursor-not-allowed disabled:opacity-35 ${palette.button}`}
              >
                Próximo capítulo
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
};
