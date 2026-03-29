import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReflowEpubViewer } from './ReflowEpubViewer';

const mockExtractBookReflowSectionsFromBuffer = vi.fn();

vi.mock('../services/epubService', () => ({
  extractBookReflowSectionsFromBuffer: (...args: unknown[]) =>
    mockExtractBookReflowSectionsFromBuffer(...args),
}));

describe('ReflowEpubViewer', () => {
  beforeEach(() => {
    mockExtractBookReflowSectionsFromBuffer.mockReset();
    const storage = new Map<string, string>();
    const localStorageMock = {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
      clear: vi.fn(() => {
        storage.clear();
      }),
    };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    });

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('skips front matter and opens the first substantial chapter', async () => {
    const onSectionChange = vi.fn();

    mockExtractBookReflowSectionsFromBuffer.mockResolvedValue([
      {
        id: 'section-1',
        href: 'cover.xhtml',
        title: 'Copyright',
        html: '<p>Copyright 2026 Publisher ISBN 123 all rights reserved</p>',
      },
      {
        id: 'section-2',
        href: 'chapter-1.xhtml',
        title: 'Chapter One',
        html: `<h1 data-reflow-anchor="chapter-one">Chapter One</h1><p>${
          'This is the first real chapter with enough body text to be treated as the main section. '.repeat(6)
        }</p>`,
      },
    ]);

    render(
      <ReflowEpubViewer
        bookData={new ArrayBuffer(8)}
        bookId="book-1"
        sectionIndex={0}
        fontScale={100}
        theme="light"
        onSectionChange={onSectionChange}
      />,
    );

    expect(await screen.findByText('Chapter One', { selector: 'h3' })).toBeInTheDocument();

    await waitFor(() => {
      expect(onSectionChange).toHaveBeenLastCalledWith(1, 'chapter-1.xhtml');
    });
  });

  it('filters chapters and navigates to the selected section', async () => {
    const onSectionChange = vi.fn();

    mockExtractBookReflowSectionsFromBuffer.mockResolvedValue([
      {
        id: 'section-1',
        href: 'intro.xhtml',
        title: 'Introduction',
        html: '<h1 data-reflow-anchor="intro">Introduction</h1><p>Opening material with enough text to render clearly.</p>',
      },
      {
        id: 'section-2',
        href: 'discovery.xhtml',
        title: 'Customer Discovery',
        html: '<h1 data-reflow-anchor="discovery">Customer Discovery</h1><p>Interview users before writing code.</p>',
      },
    ]);

    render(
      <ReflowEpubViewer
        bookData={new ArrayBuffer(8)}
        bookId="book-2"
        sectionIndex={0}
        fontScale={100}
        theme="sepia"
        onSectionChange={onSectionChange}
      />,
    );

    expect(await screen.findByText('Introduction', { selector: 'h3' })).toBeInTheDocument();

    fireEvent.change(screen.getAllByPlaceholderText('Buscar capítulo')[0]!, {
      target: { value: 'customer' },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /customer discovery/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /introduction/i })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /customer discovery/i }));

    await waitFor(() => {
      expect(onSectionChange).toHaveBeenLastCalledWith(1, 'discovery.xhtml');
    });
  });

  it('emits progress snapshots with the current anchor while scrolling', async () => {
    const onProgressSnapshotChange = vi.fn();

    mockExtractBookReflowSectionsFromBuffer.mockResolvedValue([
      {
        id: 'section-1',
        href: 'chapter.xhtml',
        title: 'Useful Chapter',
        html: [
          '<h1 id="start" data-reflow-anchor="start">Useful Chapter</h1>',
          '<p id="para-1" data-reflow-anchor="para-1">First paragraph.</p>',
          '<p id="para-2" data-reflow-anchor="para-2">Second paragraph.</p>',
        ].join(''),
      },
    ]);

    const { container } = render(
      <ReflowEpubViewer
        bookData={new ArrayBuffer(8)}
        bookId="book-3"
        sectionIndex={0}
        fontScale={100}
        theme="dark"
        onSectionChange={vi.fn()}
        onProgressSnapshotChange={onProgressSnapshotChange}
      />,
    );

    expect(await screen.findByText('Useful Chapter', { selector: 'h3' })).toBeInTheDocument();

    const chapterTitle = container.querySelector('#start') as HTMLElement;
    const firstParagraph = container.querySelector('#para-1') as HTMLElement;
    const secondParagraph = container.querySelector('#para-2') as HTMLElement;
    const article = chapterTitle.closest('article');
    const scrollContainer = article?.parentElement as HTMLDivElement | null;

    expect(scrollContainer).not.toBeNull();

    Object.defineProperty(chapterTitle, 'offsetTop', { configurable: true, value: 0 });
    Object.defineProperty(firstParagraph, 'offsetTop', { configurable: true, value: 80 });
    Object.defineProperty(secondParagraph, 'offsetTop', { configurable: true, value: 180 });

    if (scrollContainer) {
      scrollContainer.scrollTop = 150;
      fireEvent.scroll(scrollContainer);
    }

    await waitFor(() => {
      expect(onProgressSnapshotChange).toHaveBeenLastCalledWith({
        sectionIndex: 0,
        href: 'chapter.xhtml',
        scrollTop: 150,
        anchorId: 'para-2',
      });
    });
  });
});
