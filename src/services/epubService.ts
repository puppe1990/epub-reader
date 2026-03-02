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

const getSpine = (book: Book): SpineLike => book.spine as unknown as SpineLike;

const normalizeHref = (href: string): string => href.split('#')[0].trim();

const resolveSpineItemByHref = (book: Book, href: string): SpineItemLike | null => {
  const spine = getSpine(book);
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
  const root: ParentNode = contents as unknown as ParentNode;
  const body = root.querySelector?.('body');
  const contentNode = body ?? (contents as Element);
  const clonedNode = contentNode.cloneNode(true) as Element;

  clonedNode.querySelectorAll?.('script, style, noscript').forEach((el) => el.remove());
  section.unload?.();
  return clonedNode.innerHTML || '';
};

export const parseEpubMetadata = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const book = ePub(buffer);
  try {
    await book.ready;
    const metadata = await book.loaded.metadata;
    let coverUrl: string | undefined;
    try {
      const cover = await book.coverUrl();
      if (cover) coverUrl = cover;
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
  try {
    const metadata = await book.loaded.metadata;
    let markdown = `# ${metadata.title || 'Unknown Title'}\n\n`;
    const spine = getSpine(book);
    const spineItems = spine.spineItems || [];
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });

    for (let index = 0; index < spineItems.length; index += 1) {
      const item = spineItems[index];
      try {
        const html = await sectionToHtml(item, book);
        if (html) {
          const chapterMd = turndownService.turndown(html);
          if (chapterMd.trim()) markdown += chapterMd + '\n\n---\n\n';
        }

        // Yield control periodically to keep UI responsive with large books.
        if (index % 5 === 0) {
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        }
      } catch (e) {
        console.error('Failed to convert a chapter', e);
      }
    }
    
    return markdown;
  } catch (e) {
    console.error('Failed to convert book', e);
    return 'Error converting book to markdown.';
  }
};
