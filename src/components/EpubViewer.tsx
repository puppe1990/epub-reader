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

    newBook.ready.then(() => {
      newBook.loaded.navigation.then((nav) => {
        onTocReady(nav.toc);
      });
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
        className="absolute left-4 z-10 p-3 rounded-full bg-white/80 shadow-md hover:bg-white text-zinc-600 hover:text-zinc-900 transition-all"
      >
        <ChevronLeft size={24} />
      </button>

      <div ref={viewerRef} className="w-full h-full max-w-4xl mx-auto px-16 py-8" />

      <button
        onClick={handleNext}
        className="absolute right-4 z-10 p-3 rounded-full bg-white/80 shadow-md hover:bg-white text-zinc-600 hover:text-zinc-900 transition-all"
      >
        <ChevronRight size={24} />
      </button>
    </div>
  );
};
