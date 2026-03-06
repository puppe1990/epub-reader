import React, { useEffect, useRef, useState } from 'react';
import ePub, { Book, Rendition } from 'epubjs';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface EpubViewerProps {
  bookData: ArrayBuffer;
  location: string | number;
  fontScale: number;
  theme: 'light' | 'sepia' | 'dark';
  onLocationChange: (location: string, href: string) => void;
  onTocReady: (toc: any[]) => void;
  onBookReady: (book: Book) => void;
}

export const EpubViewer: React.FC<EpubViewerProps> = ({
  bookData,
  location,
  fontScale,
  theme,
  onLocationChange,
  onTocReady,
  onBookReady,
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [pageInfo, setPageInfo] = useState<{ current: number; total: number } | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);
  const lastRelocatedCfiRef = useRef<string>('');
  const bookRef = useRef<Book | null>(null);
  const pageTurnLockedRef = useRef(false);
  const pageTurnUnlockTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const updateGlobalPageInfo = (book: Book, loc: any) => {
    const locations = (book as any).locations;
    if (!locations || typeof locations.total !== 'number') return;

    const total = locations.total + 1;
    let currentLocation = loc?.start?.location;

    if (
      (typeof currentLocation !== 'number' || currentLocation < 0) &&
      loc?.start?.cfi &&
      typeof locations.locationFromCfi === 'function'
    ) {
      currentLocation = locations.locationFromCfi(loc.start.cfi);
    }

    if (typeof currentLocation === 'number' && currentLocation >= 0) {
      setPageInfo({
        current: Math.min(currentLocation + 1, total),
        total,
      });
    }
  };

  const regenerateLocations = async (book: Book, cfi?: string) => {
    const locations = (book as any).locations;
    if (!locations || typeof locations.generate !== 'function') return;

    await locations.generate(250);
    if (!cfi || typeof locations.locationFromCfi !== 'function' || typeof locations.total !== 'number') {
      return;
    }

    const currentLocation = locations.locationFromCfi(cfi);
    if (typeof currentLocation === 'number' && currentLocation >= 0) {
      const total = locations.total + 1;
      setPageInfo({
        current: Math.min(currentLocation + 1, total),
        total,
      });
    }
  };

  useEffect(() => {
    if (!viewerRef.current) return;

    // Clear previous rendition
    viewerRef.current.innerHTML = '';

    const newBook = ePub(bookData);
    bookRef.current = newBook;
    onBookReady(newBook);

    const newRendition = newBook.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      spread: 'none',
      manager: 'default',
      flow: isMobile ? 'scrolled' : 'paginated',
    });

    newRendition.hooks.content.register((contents: any) => {
      const doc = contents?.document as Document | undefined;
      if (!doc) return;

      const style = doc.createElement('style');
      style.textContent = `
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          overflow-x: hidden !important;
          ${isMobile ? 'height: auto !important;' : 'height: 100% !important;'}
        }

        *, *::before, *::after {
          box-sizing: border-box !important;
        }

        body {
          ${isMobile ? 'padding: 12px 14px 28px !important;' : ''}
          ${isMobile ? 'height: auto !important;' : ''}
          ${isMobile ? 'overflow-y: auto !important;' : ''}
          ${isMobile ? '-webkit-overflow-scrolling: touch !important;' : ''}
        }

        img, svg, video, canvas {
          max-width: 100% !important;
          height: auto !important;
        }

        table {
          max-width: 100% !important;
        }

        p, li, blockquote {
          max-width: none !important;
          width: auto !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          text-indent: 0 !important;
          text-align: left !important;
        }

        div, section, article, aside, main {
          max-width: none !important;
        }

        h1, h2, h3, h4, h5, h6 {
          max-width: none !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
        }

        [style*="margin-left"], [style*="margin-right"] {
          margin-left: 0 !important;
          margin-right: 0 !important;
        }
      `;
      doc.head?.appendChild(style);
    });

    setRendition(newRendition);

    newBook.ready.then(async () => {
      newBook.loaded.navigation.then((nav) => {
        onTocReady(nav.toc);
      });

      // Build global locations map so we can show "current / total" for the whole book.
      // Smaller break makes the global page indicator less jumpy.
      await regenerateLocations(newBook, typeof location === 'string' ? location : undefined);
    });

    if (location) {
      newRendition.display(location);
    } else {
      newRendition.display();
    }

    newRendition.on('relocated', (loc: any) => {
      pageTurnLockedRef.current = false;
      if (pageTurnUnlockTimerRef.current) {
        window.clearTimeout(pageTurnUnlockTimerRef.current);
        pageTurnUnlockTimerRef.current = null;
      }

      let href = loc.start.href;
      if (!href && loc.start.index !== undefined) {
        const spineItem = newBook.spine.get(loc.start.index);
        if (spineItem) href = spineItem.href;
      }

      if (loc?.start?.cfi) {
        lastRelocatedCfiRef.current = loc.start.cfi;
      }
      updateGlobalPageInfo(newBook, loc);

      onLocationChange(loc.start.cfi, href || '');
    });

    return () => {
      bookRef.current = null;
      if (pageTurnUnlockTimerRef.current) {
        window.clearTimeout(pageTurnUnlockTimerRef.current);
        pageTurnUnlockTimerRef.current = null;
      }
      newBook.destroy();
    };
  }, [bookData, isMobile]);

  useEffect(() => {
    if (rendition && location) {
      const currentCfi = (rendition as any)?.location?.start?.cfi;
      if (
        typeof location === 'string' &&
        (location === currentCfi || location === lastRelocatedCfiRef.current)
      ) {
        return;
      }
      rendition.display(location).catch((error: unknown) => {
        console.warn('Failed to sync location in rendition', error);
      });
    }
  }, [location, rendition]);

  useEffect(() => {
    if (!rendition) return;

    const palette =
      theme === 'dark'
        ? { bg: '#0a0a0a', text: '#f5f5f5', link: '#93c5fd' }
        : theme === 'sepia'
          ? { bg: '#f5ebd6', text: '#4a3925', link: '#9a6a38' }
          : { bg: '#f8fafc', text: '#111827', link: '#2563eb' };

    rendition.themes.default({
      '*, *::before, *::after': {
        'box-sizing': 'border-box !important',
      },
      body: {
        background: `${palette.bg} !important`,
        color: `${palette.text} !important`,
        'line-height': '1.7 !important',
        'font-family': `"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif !important`,
        height: isMobile ? 'auto !important' : '100% !important',
        overflow: isMobile ? 'visible !important' : 'hidden !important',
        '-webkit-overflow-scrolling': isMobile ? 'touch !important' : 'auto !important',
      },
      img: {
        'max-width': '100% !important',
        height: 'auto !important',
      },
      svg: {
        'max-width': '100% !important',
      },
      'p, div, span, li, h1, h2, h3, h4, h5, h6, section, article, blockquote': {
        overflowWrap: 'break-word !important',
      },
      'p, li, blockquote': {
        'font-size': isMobile ? '1.02rem !important' : '1rem !important',
        'line-height': isMobile ? '1.78 !important' : '1.72 !important',
        'letter-spacing': '0.01em !important',
        'text-align': 'left !important',
      },
      'h1, h2, h3, h4, h5, h6': {
        color: `${palette.text} !important`,
        'line-height': '1.25 !important',
      },
      a: {
        color: `${palette.link} !important`,
      },
    });
    rendition.themes.fontSize(`${fontScale}%`);
  }, [fontScale, isMobile, rendition, theme]);

  useEffect(() => {
    const book = bookRef.current;
    if (!book) return;

    regenerateLocations(
      book,
      (rendition as any)?.location?.start?.cfi || lastRelocatedCfiRef.current || undefined,
    ).catch((error) => {
      console.warn('Failed to regenerate locations after font change', error);
    });
  }, [fontScale, rendition]);

  useEffect(() => {
    if (!rendition) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        rendition.next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        rendition.prev();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rendition]);

  const handlePrev = () => {
    if (!rendition || pageTurnLockedRef.current) return;
    pageTurnLockedRef.current = true;
    rendition.prev();
    pageTurnUnlockTimerRef.current = window.setTimeout(() => {
      pageTurnLockedRef.current = false;
      pageTurnUnlockTimerRef.current = null;
    }, 450);
  };

  const handleNext = () => {
    if (!rendition || pageTurnLockedRef.current) return;
    pageTurnLockedRef.current = true;
    rendition.next();
    pageTurnUnlockTimerRef.current = window.setTimeout(() => {
      pageTurnLockedRef.current = false;
      pageTurnUnlockTimerRef.current = null;
    }, 450);
  };

  const readerSurfaceClass =
    theme === 'dark'
      ? 'bg-[#111111]'
      : theme === 'sepia'
        ? 'bg-[#e9dcc3]'
        : 'bg-[#ebe4d8]';
  const shellClass =
    theme === 'dark'
      ? 'border-white/8 bg-black/30 shadow-[0_30px_80px_rgba(0,0,0,0.45)]'
      : theme === 'sepia'
        ? 'border-[rgba(110,86,55,0.18)] bg-[rgba(255,249,238,0.76)] shadow-[0_30px_70px_rgba(114,88,57,0.16)]'
        : 'border-[rgba(71,57,40,0.12)] bg-[rgba(255,253,249,0.74)] shadow-[0_28px_68px_rgba(91,67,39,0.12)]';
  const navButtonClass =
    theme === 'dark'
      ? 'bg-white/10 text-zinc-100 hover:bg-white/16'
      : 'bg-white/78 text-[color:var(--text)] hover:bg-white';
  const pageBadgeClass =
    theme === 'dark'
      ? 'bg-black/65 text-white'
      : 'bg-[rgba(36,27,18,0.76)] text-[rgba(255,250,242,0.96)]';

  return (
    <div className={`relative flex h-full w-full items-center justify-center overflow-hidden ${readerSurfaceClass}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_34%),radial-gradient(circle_at_bottom,_rgba(0,0,0,0.08),_transparent_38%)]" />

      {!isMobile && (
        <>
          <button
            type="button"
            aria-label="Previous page"
            onClick={handlePrev}
            className="absolute inset-y-0 left-0 z-[5] w-[14%] cursor-w-resize"
          />
          <button
            type="button"
            aria-label="Next page"
            onClick={handleNext}
            className="absolute inset-y-0 right-0 z-[5] w-[14%] cursor-e-resize"
          />
        </>
      )}

      <button
        onClick={handlePrev}
        className={`absolute left-3 z-10 rounded-full p-2.5 transition-all sm:left-5 sm:p-3 ${isMobile ? 'bottom-16' : ''} ${isMobile ? 'opacity-80' : ''} ${navButtonClass}`}
      >
        <ChevronLeft size={20} className="sm:w-6 sm:h-6" />
      </button>

      <div
        ref={viewerRef}
        className={`mx-auto h-full w-full max-w-5xl overflow-hidden border ${shellClass} ${isMobile ? 'px-0 py-2' : 'my-4 rounded-[32px] px-8 py-8 sm:my-6 sm:px-16 sm:py-10'}`}
      />

      <button
        onClick={handleNext}
        className={`absolute right-3 z-10 rounded-full p-2.5 transition-all sm:right-5 sm:p-3 ${isMobile ? 'bottom-16' : ''} ${isMobile ? 'opacity-80' : ''} ${navButtonClass}`}
      >
        <ChevronRight size={20} className="sm:w-6 sm:h-6" />
      </button>

      {pageInfo && (
        <div className={`absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full px-3 py-1.5 text-xs backdrop-blur sm:bottom-4 sm:text-sm ${pageBadgeClass}`}>
          {pageInfo.current} / {pageInfo.total}
        </div>
      )}
    </div>
  );
};
