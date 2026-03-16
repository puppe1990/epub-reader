type PdfToEpubOptions = {
  title: string;
  author?: string;
};

type ConvertPdfToMarkdownOptions = {
  onProgress?: (progress: import('./epubService').ConversionProgress) => void;
  title?: string;
};

type PdfJsModule = typeof import('pdfjs-dist');
let pdfJsPromise: Promise<PdfJsModule> | null = null;
let jsZipPromise: Promise<any> | null = null;
let workerSetupPromise: Promise<void> | null = null;

const loadPdfJs = async (): Promise<PdfJsModule> => {
  if (!pdfJsPromise) {
    pdfJsPromise = import('pdfjs-dist');
  }
  return pdfJsPromise;
};

const loadJSZip = async (): Promise<any> => {
  if (!jsZipPromise) {
    jsZipPromise = import('jszip').then((module) => (module as any).default ?? module);
  }
  return jsZipPromise;
};

const ensurePdfWorker = async (): Promise<void> => {
  if (!workerSetupPromise) {
    workerSetupPromise = (async () => {
      const [pdfjsLib, workerModule] = await Promise.all([
        loadPdfJs(),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      ]);

      (
        pdfjsLib as unknown as { GlobalWorkerOptions: { workerSrc: string } }
      ).GlobalWorkerOptions.workerSrc = workerModule.default;
    })();
  }

  await workerSetupPromise;
};

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

const extractPdfPages = async (pdfBuffer: ArrayBuffer): Promise<string[]> => {
  await ensurePdfWorker();
  const pdfjsLib = await loadPdfJs();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
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

export const convertPdfToMarkdownDetailed = async (
  fileData: ArrayBuffer,
  options: ConvertPdfToMarkdownOptions = {},
): Promise<{
  markdown: string;
  metrics: import('./epubService').ConversionMetrics;
  errors: string[];
}> => {
  const { onProgress } = options;
  const startedAt = performance.now();
  const report = (payload: import('./epubService').ConversionProgress) => {
    onProgress?.(payload);
  };

  try {
    report({ phase: 'initializing', progress: 5, message: 'Preparando extração do PDF...' });
    const pages = await extractPdfPages(fileData);

    if (pages.length === 0) {
      const durationMs = performance.now() - startedAt;
      report({ phase: 'error', progress: 100, message: 'Nenhuma página legível foi encontrada.' });
      return {
        markdown: 'Nenhuma página legível foi encontrada neste PDF.',
        metrics: {
          totalChapters: 0,
          convertedChapters: 0,
          failedChapters: 0,
          durationMs,
        },
        errors: ['Nenhuma página legível foi encontrada neste PDF.'],
      };
    }

    report({ phase: 'loading-structure', progress: 18, message: 'Organizando páginas...' });

    const documentTitle = options.title?.trim() || 'Documento PDF';
    let markdown = `# ${documentTitle}\n\n`;

    for (let index = 0; index < pages.length; index += 1) {
      const pageNumber = index + 1;
      report({
        phase: 'converting',
        progress: 18 + Math.round((pageNumber / Math.max(pages.length, 1)) * 72),
        message: `Convertendo página ${pageNumber} de ${pages.length}...`,
        current: pageNumber,
        total: pages.length,
      });

      markdown += `## Página ${pageNumber}\n\n${pages[index]}\n\n`;

      if (pageNumber < pages.length) {
        markdown += '---\n\n';
      }

      if (index % 8 === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
    }

    const durationMs = performance.now() - startedAt;
    report({ phase: 'finalizing', progress: 95, message: 'Finalizando Markdown...' });
    report({ phase: 'completed', progress: 100, message: 'Conversão concluída.' });

    return {
      markdown,
      metrics: {
        totalChapters: pages.length,
        convertedChapters: pages.length,
        failedChapters: 0,
        durationMs,
      },
      errors: [],
    };
  } catch (error) {
    console.error('Failed to convert PDF to markdown', error);
    const message = error instanceof Error ? error.message : String(error);
    report({ phase: 'error', progress: 100, message: 'A conversão falhou.' });
    return {
      markdown: `Erro ao converter o PDF para Markdown.\n\n${message}`,
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

const buildEpub = async (pages: string[], options: PdfToEpubOptions): Promise<Blob> => {
  const JSZip = await loadJSZip();
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
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
};

export const convertPdfToEpubFile = async (file: File, options: PdfToEpubOptions): Promise<File> => {
  const pdfBuffer = await file.arrayBuffer();
  const pages = await extractPdfPages(pdfBuffer);
  const epubBlob = await buildEpub(pages, options);
  const fileName = file.name.replace(/\.pdf$/i, '.epub');
  return new File([epubBlob], fileName, { type: 'application/epub+zip' });
};
