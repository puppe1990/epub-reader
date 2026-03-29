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

export interface ExtractedTextSection {
  id: string;
  href: string;
  title: string;
  paragraphs: string[];
}

export interface ExtractedReflowSection {
  id: string;
  href: string;
  title: string;
  html: string;
}

type NavigationItem = {
  href: string;
  label: string;
};

interface ConvertBookOptions {
  onProgress?: (progress: ConversionProgress) => void;
}

const getSpine = (book: Book): SpineLike | null => {
  const spine = (book as any)?.spine;
  if (!spine || typeof spine.get !== 'function') return null;
  return spine as SpineLike;
};

const normalizeHref = (href: string): string => href.split('#')[0].trim();
const getHrefAnchor = (href: string): string | null => {
  const hashIndex = href.indexOf('#');
  if (hashIndex < 0 || hashIndex === href.length - 1) return null;
  return href.slice(hashIndex + 1).trim() || null;
};

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

const normalizeTextContent = (value: string): string => value.replace(/\s+/g, ' ').trim();

const truncateWords = (value: string, maxWords: number): string => {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ')}...`;
};

const extractStructuredText = (html: string, fallbackTitle: string): { title: string; paragraphs: string[] } => {
  if (typeof DOMParser === 'undefined') {
    const plain = normalizeTextContent(html.replace(/<[^>]+>/g, ' '));
    return {
      title: fallbackTitle,
      paragraphs: plain ? [plain] : [],
    };
  }

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.querySelectorAll('script, style, noscript').forEach((node) => node.remove());

  const headingText = normalizeTextContent(
    doc.querySelector('h1, h2, h3, title')?.textContent || fallbackTitle,
  );

  const paragraphNodes = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, pre'));
  const paragraphs = paragraphNodes
    .map((node) => normalizeTextContent(node.textContent || ''))
    .filter((text) => text.length > 0);

  if (paragraphs.length === 0) {
    const plain = normalizeTextContent(doc.body?.textContent || '');
    if (plain) paragraphs.push(plain);
  }

  return {
    title: headingText || fallbackTitle,
    paragraphs,
  };
};

const deriveReadableSectionTitle = (doc: Document, fallbackTitle: string): string => {
  const headingCandidates = Array.from(doc.querySelectorAll('h1, h2, h3, h4')).map((node) =>
    normalizeTextContent(node.textContent || ''),
  );
  const meaningfulHeading = headingCandidates.find((value) => value.length >= 3 && value.length <= 120);
  if (meaningfulHeading) return meaningfulHeading;

  const paragraphCandidates = Array.from(doc.querySelectorAll('p, li, blockquote')).map((node) =>
    normalizeTextContent(node.textContent || ''),
  );
  const usefulParagraph = paragraphCandidates.find((value) => value.length >= 18);
  if (usefulParagraph) return truncateWords(usefulParagraph, 8);

  const titleCandidate = normalizeTextContent(
    doc.querySelector('title')?.textContent || fallbackTitle,
  );
  if (titleCandidate) return truncateWords(titleCandidate, 8);

  return fallbackTitle;
};

const wrapElement = (doc: Document, element: Element, tagName: string, attributes?: Record<string, string>): Element => {
  const wrapper = doc.createElement(tagName);
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      wrapper.setAttribute(key, value);
    }
  }
  element.parentNode?.insertBefore(wrapper, element);
  wrapper.appendChild(element);
  return wrapper;
};

const isLikelyNoteId = (value: string): boolean => /\b(note|footnote|endnote|fn|en)\b/i.test(value);

const normalizeReflowHref = (value: string, base: string): { href: string; external: boolean } | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('#')) {
    return {
      href: trimmed,
      external: false,
    };
  }
  if (/^(mailto:|tel:)/i.test(trimmed)) {
    return {
      href: trimmed,
      external: true,
    };
  }

  try {
    const baseUrl = new URL(base);
    const resolved = new URL(trimmed, baseUrl);
    const sameOrigin = resolved.origin === baseUrl.origin;
    return {
      href: sameOrigin ? `${resolved.pathname}${resolved.search}${resolved.hash}` : resolved.href,
      external: !sameOrigin,
    };
  } catch {
    return {
      href: trimmed,
      external: false,
    };
  }
};

const sanitizeReflowHtml = (html: string, fallbackTitle: string): { title: string; html: string } => {
  if (typeof DOMParser === 'undefined') {
    return {
      title: fallbackTitle,
      html,
    };
  }

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.querySelectorAll('script, style, noscript, iframe').forEach((node) => node.remove());

  const base = doc.baseURI || (typeof window !== 'undefined' ? window.location.href : 'http://localhost/');

  doc.querySelectorAll('[src]').forEach((node) => {
    const value = node.getAttribute('src');
    if (!value) return;
    try {
      node.setAttribute('src', new URL(value, base).href);
    } catch {
      node.removeAttribute('src');
    }
  });

  doc.querySelectorAll('[href]').forEach((node) => {
    const value = node.getAttribute('href');
    if (!value) return;
    const normalized = normalizeReflowHref(value, base);
    if (!normalized) {
      node.removeAttribute('href');
      return;
    }
    node.setAttribute('href', normalized.href);
    if (normalized.external) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noreferrer');
    } else {
      node.removeAttribute('target');
      node.removeAttribute('rel');
    }
  });

  doc.querySelectorAll('table').forEach((table) => {
    if (table.parentElement?.tagName.toLowerCase() === 'div' && table.parentElement.hasAttribute('data-reflow-table')) {
      return;
    }
    wrapElement(doc, table, 'div', { 'data-reflow-table': 'true' });
  });

  doc.querySelectorAll('img').forEach((image) => {
    image.setAttribute('loading', 'lazy');
    image.setAttribute('decoding', 'async');

    const parent = image.parentElement;
    const standaloneParent = parent && ['p', 'div'].includes(parent.tagName.toLowerCase())
      && parent.childElementCount === 1
      && normalizeTextContent(parent.textContent || '') === normalizeTextContent(image.getAttribute('alt') || '');

    let figure: Element | null =
      image.closest('figure') ||
      (standaloneParent ? wrapElement(doc, parent!, 'figure', { 'data-reflow-figure': 'true' }) : null);

    if (!figure && !parent) {
      figure = wrapElement(doc, image, 'figure', { 'data-reflow-figure': 'true' });
    } else if (figure && !figure.hasAttribute('data-reflow-figure')) {
      figure.setAttribute('data-reflow-figure', 'true');
    }

    if (!figure) return;

    const captionSource = normalizeTextContent(
      image.getAttribute('title') || image.getAttribute('alt') || '',
    );
    if (!captionSource || figure.querySelector('figcaption')) return;

    const figcaption = doc.createElement('figcaption');
    figcaption.textContent = captionSource;
    figure.appendChild(figcaption);
  });

  doc.querySelectorAll('*').forEach((node) => {
    const className = typeof (node as HTMLElement).className === 'string' ? (node as HTMLElement).className : '';
    const role = node.getAttribute('role') || '';
    const epubType = node.getAttribute('epub:type') || node.getAttribute('type') || '';
    const id = node.getAttribute('id') || '';
    const href = node.getAttribute('href') || '';
    const noteLike =
      /\b(footnote|endnote|note|annotation|notebody)\b/i.test(`${className} ${role} ${epubType}`) ||
      (['aside', 'li'].includes(node.tagName.toLowerCase()) && isLikelyNoteId(id));
    const noteRef =
      /\b(doc-noteref|noteref)\b/i.test(`${className} ${role} ${epubType}`) ||
      (node.tagName.toLowerCase() === 'a' && (isLikelyNoteId(href) || /\[\d+\]|\d+/.test(normalizeTextContent(node.textContent || ''))));
    const noteBacklink =
      /\b(doc-backlink|backlink)\b/i.test(`${className} ${role} ${epubType}`) ||
      (node.tagName.toLowerCase() === 'a' && /↩|back to text|return/i.test(normalizeTextContent(node.textContent || '')));

    if (noteLike) node.setAttribute('data-reflow-note-block', 'true');
    if (noteRef) node.setAttribute('data-reflow-note-ref', 'true');
    if (noteBacklink) node.setAttribute('data-reflow-note-backlink', 'true');

    node.removeAttribute('class');
    node.removeAttribute('style');
    node.removeAttribute('align');
    if (node.tagName.toLowerCase() !== 'img') {
      node.removeAttribute('width');
      node.removeAttribute('height');
    }
  });

  doc.querySelectorAll('div, span, p, section, article').forEach((node) => {
    const hasMedia = node.querySelector('img, svg, video, audio, table, pre');
    const text = normalizeTextContent(node.textContent || '');
    if (!hasMedia && text.length === 0) {
      node.remove();
    }
  });

  doc.querySelectorAll('br + br').forEach((node) => {
    let current: Element | null = node;
    while (current?.nextElementSibling?.tagName.toLowerCase() === 'br') {
      current.nextElementSibling.remove();
    }
  });

  let anchorCounter = 0;
  doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, figure, pre, table, aside').forEach((node) => {
    const text = normalizeTextContent(node.textContent || '');
    if (text.length < 12 && !['figure', 'table'].includes(node.tagName.toLowerCase())) return;
    const existingId = node.getAttribute('id') || node.getAttribute('name');
    const anchorId = existingId || `reflow-anchor-${anchorCounter++}`;
    node.setAttribute('data-reflow-anchor', anchorId);
    if (!node.getAttribute('id')) {
      node.setAttribute('id', anchorId);
    }
  });

  const title = deriveReadableSectionTitle(doc, fallbackTitle);

  return {
    title,
    html: doc.body.innerHTML,
  };
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

const collectNavigationItems = (items: any[] | undefined, acc: NavigationItem[] = []): NavigationItem[] => {
  if (!Array.isArray(items)) return acc;
  for (const item of items) {
    const href = typeof item?.href === 'string' ? item.href : '';
    const label = normalizeTextContent(
      typeof item?.label === 'string'
        ? item.label
        : typeof item?.title === 'string'
          ? item.title
          : '',
    );
    if (href) {
      acc.push({
        href,
        label,
      });
    }
    if (item?.subitems) collectNavigationItems(item.subitems, acc);
  }
  return acc;
};

const getNavigationItems = async (book: Book): Promise<NavigationItem[]> => {
  try {
    const navigation = await (book as any).loaded?.navigation;
    const items = collectNavigationItems(navigation?.toc);
    const deduped = new Map<string, NavigationItem>();
    for (const item of items) {
      const key = normalizeHref(item.href);
      if (!key || deduped.has(key)) continue;
      deduped.set(key, item);
    }
    return Array.from(deduped.values());
  } catch {
    return [];
  }
};

const getOrderedSectionEntries = async (book: Book): Promise<Array<{ item: SpineItemLike; href: string; label?: string }>> => {
  const navigationItems = await getNavigationItems(book);
  if (navigationItems.length > 0) {
    const ordered = navigationItems
      .map((navItem) => {
        const item = resolveSpineItemByHref(book, navItem.href);
        if (!item) return null;
        return {
          item,
          href: item.href || navItem.href,
          label: navItem.label || undefined,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    const seen = new Set<string>();
    return ordered.filter((entry) => {
      const key = normalizeHref(entry.href);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  let spineItems = getSpineItems(book);
  if (spineItems.length === 0) {
    spineItems = await getSpineItemsFromNavigation(book);
  }
  if (spineItems.length === 0) {
    spineItems = probeSpineByIndex(book);
  }

  return spineItems.map((item, index) => ({
    item,
    href: item.href || `section-${index + 1}`,
  }));
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

export const extractBookTextSections = async (book: Book): Promise<ExtractedTextSection[]> => {
  await book.ready;
  const entries = await getOrderedSectionEntries(book);

  const sections: ExtractedTextSection[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const { item, href, label } = entries[index]!;
    const html = await sectionToHtml(item, book);
    if (!html) continue;

    const fallbackTitle = label || `Capítulo ${index + 1}`;
    const structured = extractStructuredText(html, fallbackTitle);
    if (structured.paragraphs.length === 0) continue;

    sections.push({
      id: `section-${index + 1}`,
      href,
      title: structured.title,
      paragraphs: structured.paragraphs,
    });
  }

  return sections;
};

export const extractBookReflowSections = async (book: Book): Promise<ExtractedReflowSection[]> => {
  await book.ready;
  const entries = await getOrderedSectionEntries(book);

  const sections: ExtractedReflowSection[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const { item, href, label } = entries[index]!;
    const html = await sectionToHtml(item, book);
    if (!html) continue;

    const fallbackTitle = label || `Capítulo ${index + 1}`;
    const sanitized = sanitizeReflowHtml(html, fallbackTitle);

    if (!normalizeTextContent(sanitized.html.replace(/<[^>]+>/g, ' '))) continue;

    sections.push({
      id: `section-${index + 1}`,
      href,
      title: sanitized.title,
      html: sanitized.html,
    });
  }

  return sections;
};

export const extractBookTextSectionsFromBuffer = async (
  bookData: ArrayBuffer,
): Promise<ExtractedTextSection[]> => {
  const book = ePub(bookData);
  try {
    return await extractBookTextSections(book);
  } finally {
    book.destroy();
  }
};

export const extractBookReflowSectionsFromBuffer = async (
  bookData: ArrayBuffer,
): Promise<ExtractedReflowSection[]> => {
  const book = ePub(bookData);
  try {
    return await extractBookReflowSections(book);
  } finally {
    book.destroy();
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
    const entries = await getOrderedSectionEntries(book);

    if (entries.length === 0) {
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

    for (let index = 0; index < entries.length; index += 1) {
      const { item, label } = entries[index]!;
      try {
        report({
          phase: 'converting',
          progress: 15 + Math.round((index / Math.max(entries.length, 1)) * 75),
          message: `Converting chapter ${index + 1} of ${entries.length}...`,
          current: index + 1,
          total: entries.length,
        });
        const html = await sectionToHtml(item, book);
        if (html) {
          const chapterMd = turndownService.turndown(html);
          if (chapterMd.trim()) {
            if (label && !chapterMd.startsWith('#')) {
              markdown += `## ${label}\n\n`;
            }
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
    const failedChapters = Math.max(entries.length - convertedChapters, 0);
    report({ phase: 'completed', progress: 100, message: 'Conversion completed.' });

    return {
      markdown,
      metrics: {
        totalChapters: entries.length,
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
