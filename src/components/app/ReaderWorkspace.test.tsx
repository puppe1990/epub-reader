import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../EpubViewer', () => ({
  EpubViewer: () => <div>Mock EPUB Viewer</div>,
}));

vi.mock('../ReflowEpubViewer', () => ({
  ReflowEpubViewer: ({ sectionIndex }: { sectionIndex: number }) => (
    <div>Mock Reflow Viewer {sectionIndex}</div>
  ),
}));

vi.mock('../MarkdownViewer', () => ({
  MarkdownViewer: () => <div>Mock Markdown Viewer</div>,
}));

vi.mock('../PdfViewer', () => ({
  PdfViewer: () => <div>Visualização incorporada</div>,
}));

import { ReaderWorkspace } from './ReaderWorkspace';

describe('ReaderWorkspace', () => {
  it('shows persistent sync state for the active book', async () => {
    render(
      <ReaderWorkspace
        activeBook={{
          id: '1',
          title: 'Duna',
          author: 'Frank Herbert',
          format: 'pdf',
          addedAt: Date.now(),
          sizeBytes: 2048,
        }}
        activeBookData={new ArrayBuffer(16)}
        activeSection="reader"
        isActiveEpub={false}
        readerFontScale={100}
        readerMode="epub"
        readerTheme="light"
        location=""
        reflowSectionIndex={0}
        markdownContent=""
        isConverting={false}
        conversionProgress={{ phase: 'idle', progress: 0, message: 'Pronto' }}
        conversionMetrics={null}
        conversionError={null}
        conversionDetails={[]}
        syncStatus="saved"
        onBackToLibrary={vi.fn()}
        onSetActiveSection={vi.fn()}
        onSetReaderFontScale={vi.fn()}
        onSetReaderMode={vi.fn()}
        onSetReaderTheme={vi.fn()}
        onLocationChange={vi.fn()}
        onReflowSectionChange={vi.fn()}
        onReflowProgressSnapshotChange={vi.fn()}
        onDownloadSource={vi.fn()}
        onConvertBook={vi.fn()}
      />,
    );

    expect(screen.getByText('Duna')).toBeInTheDocument();
    expect(screen.getByText('Progresso salvo')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /markdown/i }).length).toBeGreaterThan(0);
    expect(await screen.findByText('Visualização incorporada')).toBeInTheDocument();
  });

  it('switches between EPUB and reflow modes for EPUB books', async () => {
    const onSetReaderMode = vi.fn();

    render(
      <ReaderWorkspace
        activeBook={{
          id: 'epub-1',
          title: 'The Mom Test',
          author: 'Rob Fitzpatrick',
          format: 'epub',
          addedAt: Date.now(),
          sizeBytes: 4096,
        }}
        activeBookData={new ArrayBuffer(16)}
        activeSection="reader"
        isActiveEpub
        readerFontScale={100}
        readerMode="reflow"
        readerTheme="sepia"
        location="reflow:1"
        reflowSectionIndex={1}
        markdownContent=""
        isConverting={false}
        conversionProgress={{ phase: 'idle', progress: 0, message: 'Pronto' }}
        conversionMetrics={null}
        conversionError={null}
        conversionDetails={[]}
        syncStatus="idle"
        onBackToLibrary={vi.fn()}
        onSetActiveSection={vi.fn()}
        onSetReaderFontScale={vi.fn()}
        onSetReaderMode={onSetReaderMode}
        onSetReaderTheme={vi.fn()}
        onLocationChange={vi.fn()}
        onReflowSectionChange={vi.fn()}
        onReflowProgressSnapshotChange={vi.fn()}
        onDownloadSource={vi.fn()}
        onConvertBook={vi.fn()}
      />,
    );

    expect(await screen.findByText('Mock Reflow Viewer 1')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'EPUB original' })[0]!);

    expect(onSetReaderMode).toHaveBeenCalledWith('epub');
  });
});
