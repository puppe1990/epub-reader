import ePub, { Book } from 'epubjs';
import TurndownService from 'turndown';

export const parseEpubMetadata = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const book = ePub(buffer);
  
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
};

export const convertChapterToMarkdown = async (book: Book, href: string): Promise<string> => {
  try {
    const cleanHref = href.split('#')[0];
    const spineItem = book.spine.get(cleanHref);
    if (!spineItem) return '';
    
    // @ts-ignore
    const doc = await spineItem.load(book.load.bind(book));
    
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
    
    const elementsToRemove = doc.querySelectorAll('script, style');
    elementsToRemove.forEach((el: Element) => el.remove());
    
    return turndownService.turndown(doc.body.innerHTML);
  } catch (e) {
    console.error('Failed to convert chapter', e);
    return 'Error converting chapter to markdown.';
  }
};

export const convertBookToMarkdown = async (book: Book): Promise<string> => {
  try {
    const metadata = await book.loaded.metadata;
    let markdown = `# ${metadata.title || 'Unknown Title'}\n\n`;
    
    // @ts-ignore
    const spineItems = book.spine.spineItems || [];
    
    for (const item of spineItems) {
      try {
        // @ts-ignore
        const doc = await item.load(book.load.bind(book));
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
        });
        
        const elementsToRemove = doc.querySelectorAll('script, style');
        elementsToRemove.forEach((el: Element) => el.remove());
        
        const chapterMd = turndownService.turndown(doc.body.innerHTML);
        markdown += chapterMd + '\n\n---\n\n';
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
