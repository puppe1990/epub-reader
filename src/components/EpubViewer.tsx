import React, { useEffect, useRef, useState } from 'react';
import ePub, { Book, Rendition } from 'epubjs';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface EpubViewerProps {
  bookData: ArrayBuffer;
  location: string | number;
  onLocationChange: (location: string, href: string) => void;
  onTocReady: (toc: any[]) => void;
  onBookReady: (book: Book) => void;
}

export const EpubViewer: React.FC<EpubViewerProps> = ({
  bookData,
  location,
  onLocationChange,
  onTocReady,
  onBookReady,
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [pageInfo, setPageInfo] = useState<{ current: number; total: number } | null>(null);

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

  useEffect(() => {
    if (!viewerRef.current) return;

    // Clear previous rendition
    viewerRef.current.innerHTML = '';

    const newBook = ePub(bookData);
    onBookReady(newBook);

    const newRendition = newBook.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      spread: 'none',
      manager: 'continuous',
      flow: 'paginated',
    });

    setRendition(newRendition);

    newBook.ready.then(async () => {
      newBook.loaded.navigation.then((nav) => {
        onTocReady(nav.toc);
      });

      // Build global locations map so we can show "current / total" for the whole book.
      // A larger break keeps generation faster while still useful for progress feedback.
      const locations = (newBook as any).locations;
      if (locations && typeof locations.generate === 'function') {
        await locations.generate(1600);
      }
    });

    if (location) {
      newRendition.display(location);
    } else {
      newRendition.display();
    }

    newRendition.on('relocated', (loc: any) => {
      let href = loc.start.href;
      if (!href && loc.start.index !== undefined) {
        const spineItem = newBook.spine.get(loc.start.index);
        if (spineItem) href = spineItem.href;
      }

      updateGlobalPageInfo(newBook, loc);

      onLocationChange(loc.start.cfi, href || '');
    });

    return () => {
      newBook.destroy();
    };
  }, [bookData]);

  useEffect(() => {
    if (rendition && location) {
      // Only display if it's a different location to avoid loops
      // Actually, epubjs handles this, but it's better to be safe
      rendition.display(location);
    }
  }, [location, rendition]);

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
    if (rendition) rendition.prev();
  };

  const handleNext = () => {
    if (rendition) rendition.next();
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-zinc-50">
      <button
        onClick={handlePrev}
        className="absolute left-2 sm:left-4 z-10 p-2 sm:p-3 rounded-full bg-white/80 shadow-md hover:bg-white text-zinc-600 hover:text-zinc-900 transition-all"
      >
        <ChevronLeft size={20} className="sm:w-6 sm:h-6" />
      </button>

      <div ref={viewerRef} className="w-full h-full max-w-4xl mx-auto px-8 sm:px-16 py-4 sm:py-8" />

      <button
        onClick={handleNext}
        className="absolute right-2 sm:right-4 z-10 p-2 sm:p-3 rounded-full bg-white/80 shadow-md hover:bg-white text-zinc-600 hover:text-zinc-900 transition-all"
      >
        <ChevronRight size={20} className="sm:w-6 sm:h-6" />
      </button>

      {pageInfo && (
        <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-zinc-900/80 text-white text-xs sm:text-sm backdrop-blur">
          {pageInfo.current} / {pageInfo.total}
        </div>
      )}
    </div>
  );
};
