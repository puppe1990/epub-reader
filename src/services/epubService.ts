import ePub, { Book } from 'epubjs';
import TurndownService from 'turndown';

interface SpineItemLike {
  href?: string;
  load: (loader: (...args: unknown[]) => unknown) => Promise<Element | Document>;
  unload?: () => void;
}

interface SpineLike {
  get: (target: string | number) => SpineItemLike | undefined;
  spineItems?: SpineItemLike[];
}

export type ConversionPhase =
  | 'idle'
  | 'initializing'
  | 'loading-structure'
  | 'converting'
  | 'finalizing'
  | 'completed'
  | 'error';

export interface ConversionProgress {
  phase: ConversionPhase;
  progress: number;
  message: string;
  current?: number;
  total?: number;
}

export interface ConversionMetrics {
  totalChapters: number;
  convertedChapters: number;
  failedChapters: number;
  durationMs: number;
}

interface ConvertBookOptions {
  onProgress?: (progress: ConversionProgress) => void;
}

const getSpine = (book: Book): SpineLike | null => {
  const spine = (book as any)?.spine;
  if (!spine || typeof spine.get !== 'function') return null;
  return spine as SpineLike;
};

const normalizeHref = (href: string): string => href.split('#')[0].trim();

const resolveSpineItemByHref = (book: Book, href: string): SpineItemLike | null => {
  const spine = getSpine(book);
  if (!spine) return null;
  const cleanHref = normalizeHref(href);
  if (!cleanHref) return null;

  const candidates = [
    cleanHref,
    decodeURI(cleanHref),
    encodeURI(cleanHref),
    cleanHref.startsWith('/') ? cleanHref.slice(1) : `/${cleanHref}`,
  ];

  for (const candidate of candidates) {
    const item = spine.get(candidate);
    if (item) return item;
  }

  const spineItems = spine.spineItems || [];
  return (
    spineItems.find((item) => {
      if (!item.href) return false;
      const sectionHref = normalizeHref(item.href);
      return sectionHref === cleanHref || sectionHref.endsWith(cleanHref) || cleanHref.endsWith(sectionHref);
    }) || null
  );
};

const sectionToHtml = async (section: SpineItemLike, book: Book): Promise<string> => {
  const contents = await section.load(book.load.bind(book));

  try {
    if (typeof contents === 'string') {
      return contents;
    }

    let targetNode: Element | null = null;
    const unknownContents = contents as unknown as {
      nodeType?: number;
      documentElement?: Element;
      querySelector?: (selector: string) => Element | null;
      tagName?: string;
      textContent?: string;
      cloneNode?: (deep?: boolean) => Node;
    };
    const nodeType = unknownContents?.nodeType;

    if (nodeType === 9 || (typeof Document !== 'undefined' && contents instanceof Document)) {
      const doc = contents as Document;
      targetNode =
        (doc.querySelector?.('body') as Element | null) ||
        doc.documentElement;
    } else if (unknownContents?.documentElement) {
      targetNode =
        (unknownContents.querySelector?.('body') as Element | null) ||
        unknownContents.documentElement;
    } else {
      const element = contents as Element;
      if (element.tagName?.toLowerCase() === 'html') {
        targetNode =
          (element.querySelector('body') as Element | null) ||
          element;
      } else {
        targetNode = element;
      }
    }

    if (!targetNode) return '';

    const clonedNode = (targetNode.cloneNode?.(true) as Element | undefined) || targetNode;
    clonedNode.querySelectorAll?.('script, style, noscript').forEach((el) => el.remove());

    return clonedNode.innerHTML || clonedNode.textContent || '';
  } finally {
    section.unload?.();
  }
};

const getSpineItems = (book: Book): SpineItemLike[] => {
  const spine = (book as any)?.spine;
  if (!spine) return [];

  const directItems = spine.spineItems || spine.items;
  if (Array.isArray(directItems) && directItems.length > 0) {
    return directItems as SpineItemLike[];
  }

  if (typeof spine.each === 'function') {
    const collected: SpineItemLike[] = [];
    spine.each((item: SpineItemLike) => {
      if (item) collected.push(item);
    });
    return collected;
  }

  return [];
};

const collectNavigationHrefs = (items: any[] | undefined, acc: string[] = []): string[] => {
  if (!Array.isArray(items)) return acc;
  for (const item of items) {
    if (item?.href && typeof item.href === 'string') acc.push(item.href);
    if (item?.subitems) collectNavigationHrefs(item.subitems, acc);
  }
  return acc;
};

const getSpineItemsFromNavigation = async (book: Book): Promise<SpineItemLike[]> => {
  try {
    const navigation = await (book as any).loaded?.navigation;
    const hrefs = Array.from(new Set(collectNavigationHrefs(navigation?.toc)));
    if (hrefs.length === 0) return [];

    const resolved = hrefs
      .map((href) => resolveSpineItemByHref(book, href))
      .filter((item): item is SpineItemLike => Boolean(item));

    return resolved;
  } catch {
    return [];
  }
};

const probeSpineByIndex = (book: Book, maxItems = 1000): SpineItemLike[] => {
  const spine = getSpine(book);
  if (!spine) return [];
  const items: SpineItemLike[] = [];
  let misses = 0;

  for (let i = 0; i < maxItems; i += 1) {
    const item = spine.get(i);
    if (item) {
      items.push(item);
      misses = 0;
    } else {
      misses += 1;
      if (misses >= 10) break;
    }
  }

  return items;
};

export const parseEpubMetadata = async (file: File) => {
  const blobToDataUrl = async (blob: Blob): Promise<string> =>
    await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to convert cover blob to data URL.'));
      reader.readAsDataURL(blob);
    });

  const buffer = await file.arrayBuffer();
  const book = ePub(buffer);
  try {
    await book.ready;
    const metadata = await book.loaded.metadata;
    let coverUrl: string | undefined;
    try {
      const cover = await book.coverUrl();
      if (cover) {
        const coverResponse = await fetch(cover);
        const coverBlob = await coverResponse.blob();
        const dataUrl = await blobToDataUrl(coverBlob);
        coverUrl = dataUrl || undefined;
        if (cover.startsWith('blob:')) {
          URL.revokeObjectURL(cover);
        }
      }
    } catch (e) {
      console.warn('Failed to load cover', e);
    }

    return {
      title: metadata.title || 'Unknown Title',
      author: metadata.creator || 'Unknown Author',
      coverUrl,
    };
  } finally {
    book.destroy();
  }
};

export const convertChapterToMarkdown = async (book: Book, href: string): Promise<string> => {
  try {
    await book.ready;
    const spineItem = resolveSpineItemByHref(book, href);
    if (!spineItem) return '';

    const html = await sectionToHtml(spineItem, book);
    if (!html) return '';

    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
    return turndownService.turndown(html);
  } catch (e) {
    console.error('Failed to convert chapter', e);
    return 'Error converting chapter to markdown.';
  }
};

export const convertBookToMarkdown = async (book: Book): Promise<string> => {
  const result = await convertBookToMarkdownDetailed(book);
  return result.markdown;
};

export const convertBookToMarkdownDetailed = async (
  book: Book,
  options: ConvertBookOptions = {},
): Promise<{ markdown: string; metrics: ConversionMetrics; errors: string[] }> => {
  const { onProgress } = options;
  const startedAt = performance.now();
  const report = (payload: ConversionProgress) => {
    onProgress?.(payload);
  };

  try {
    report({ phase: 'initializing', progress: 5, message: 'Initializing book conversion...' });
    await book.ready;
    let title = 'Unknown Title';
    try {
      const metadata = await book.loaded.metadata;
      title = metadata?.title || title;
    } catch (metadataError) {
      console.warn('Failed to load EPUB metadata for conversion', metadataError);
    }

    report({ phase: 'loading-structure', progress: 12, message: 'Loading chapters...' });

    let markdown = `# ${title}\n\n`;
    let spineItems = getSpineItems(book);
    if (spineItems.length === 0) {
      spineItems = await getSpineItemsFromNavigation(book);
    }
    if (spineItems.length === 0) {
      spineItems = probeSpineByIndex(book);
    }

    if (spineItems.length === 0) {
      const durationMs = performance.now() - startedAt;
      report({ phase: 'error', progress: 100, message: 'No readable chapters found.' });
      return {
        markdown: 'No readable chapters were found in this EPUB.',
        metrics: {
          totalChapters: 0,
          convertedChapters: 0,
          failedChapters: 0,
          durationMs,
        },
        errors: ['No readable chapters were found in this EPUB.'],
      };
    }

    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
    const errors: string[] = [];
    let convertedChapters = 0;

    for (let index = 0; index < spineItems.length; index += 1) {
      const item = spineItems[index];
      try {
        report({
          phase: 'converting',
          progress: 15 + Math.round((index / Math.max(spineItems.length, 1)) * 75),
          message: `Converting chapter ${index + 1} of ${spineItems.length}...`,
          current: index + 1,
          total: spineItems.length,
        });
        const html = await sectionToHtml(item, book);
        if (html) {
          const chapterMd = turndownService.turndown(html);
          if (chapterMd.trim()) {
            markdown += chapterMd + '\n\n---\n\n';
            convertedChapters += 1;
          }
        }

        // Yield control periodically to keep UI responsive with large books.
        if (index % 5 === 0) {
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        }
      } catch (e) {
        console.error('Failed to convert a chapter', e);
        errors.push(`Chapter ${index + 1}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    report({ phase: 'finalizing', progress: 95, message: 'Finalizing markdown...' });
    const durationMs = performance.now() - startedAt;
    const failedChapters = Math.max(spineItems.length - convertedChapters, 0);
    report({ phase: 'completed', progress: 100, message: 'Conversion completed.' });

    return {
      markdown,
      metrics: {
        totalChapters: spineItems.length,
        convertedChapters,
        failedChapters,
        durationMs,
      },
      errors,
    };
  } catch (e) {
    console.error('Failed to convert book', e);
    const message = e instanceof Error ? e.message : String(e);
    report({ phase: 'error', progress: 100, message: 'Conversion failed.' });
    return {
      markdown: `Error converting book to markdown.\n\n${message}`,
      metrics: {
        totalChapters: 0,
        convertedChapters: 0,
        failedChapters: 0,
        durationMs: performance.now() - startedAt,
      },
      errors: [message],
    };
  }
};
