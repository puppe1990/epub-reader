import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const xmlEscape = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const xhtmlEscape = (value: string): string => xmlEscape(value).replace(/\n/g, '<br/>');

const splitIntoChapters = (pages: string[]): string[][] => {
  const chunkSize = 12;
  const chapters: string[][] = [];
  for (let i = 0; i < pages.length; i += chunkSize) {
    chapters.push(pages.slice(i, i + chunkSize));
  }
  return chapters.length ? chapters : [[]];
};

const extractPdfPages = async (pdfBuffer: Uint8Array): Promise<string[]> => {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
  const pdfDoc = await loadingTask.promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdfDoc.numPages; i += 1) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{ str?: string }>;
    const text = items
      .map((item) => item.str || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    pages.push(text || `[Page ${i}]`);
  }

  return pages;
};

const buildEpubBuffer = async (
  pages: string[],
  options: { title: string; author?: string },
): Promise<Uint8Array> => {
  const zip = new JSZip();
  const id = crypto.randomUUID();
  const author = options.author || 'Unknown Author';
  const title = options.title || 'Converted PDF';
  const now = new Date().toISOString();
  const chapters = splitIntoChapters(pages);

  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  zip.folder('META-INF')?.file(
    'container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  const textFolder = zip.folder('OEBPS')?.folder('Text');
  const manifestItems: string[] = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
  ];
  const spineItems: string[] = [];
  const navItems: string[] = [];
  const ncxNavPoints: string[] = [];

  chapters.forEach((chapterPages, index) => {
    const chapterNumber = index + 1;
    const chapterId = `chapter-${chapterNumber}`;
    const filename = `Text/${chapterId}.xhtml`;
    const pageStart = index * 12 + 1;
    const pageEnd = Math.min(pageStart + chapterPages.length - 1, pages.length);
    const chapterTitle = `Pages ${pageStart}-${pageEnd}`;

    const sections = chapterPages
      .map(
        (pageText, pageOffset) => `<section>
  <h2>Page ${pageStart + pageOffset}</h2>
  <p>${xhtmlEscape(pageText)}</p>
</section>`,
      )
      .join('\n');

    textFolder?.file(
      `${chapterId}.xhtml`,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
  <head>
    <meta charset="UTF-8"/>
    <title>${xmlEscape(chapterTitle)}</title>
  </head>
  <body>
    <h1>${xmlEscape(chapterTitle)}</h1>
    ${sections}
  </body>
</html>`,
    );

    manifestItems.push(`<item id="${chapterId}" href="${filename}" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="${chapterId}"/>`);
    navItems.push(`<li><a href="${filename}">${xmlEscape(chapterTitle)}</a></li>`);
    ncxNavPoints.push(`<navPoint id="navPoint-${chapterNumber}" playOrder="${chapterNumber}">
  <navLabel><text>${xmlEscape(chapterTitle)}</text></navLabel>
  <content src="${filename}"/>
</navPoint>`);
  });

  zip.folder('OEBPS')?.file(
    'nav.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
  <head>
    <meta charset="UTF-8"/>
    <title>Table of Contents</title>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Table of Contents</h1>
      <ol>
        ${navItems.join('\n        ')}
      </ol>
    </nav>
  </body>
</html>`,
  );

  zip.folder('OEBPS')?.file(
    'toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${id}"/>
  </head>
  <docTitle><text>${xmlEscape(title)}</text></docTitle>
  <navMap>
    ${ncxNavPoints.join('\n    ')}
  </navMap>
</ncx>`,
  );

  zip.folder('OEBPS')?.file(
    'content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${id}</dc:identifier>
    <dc:title>${xmlEscape(title)}</dc:title>
    <dc:creator>${xmlEscape(author)}</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${now}</meta>
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineItems.join('\n    ')}
  </spine>
</package>`,
  );

  return zip.generateAsync({
    type: 'uint8array',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
};

export const convertPdfBytesToEpub = async (
  pdfBuffer: Uint8Array,
  options: { title: string; author?: string },
): Promise<Uint8Array> => {
  const pages = await extractPdfPages(pdfBuffer);
  return buildEpubBuffer(pages, options);
};
