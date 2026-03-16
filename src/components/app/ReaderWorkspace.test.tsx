import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
        readerTheme="light"
        location=""
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
        onSetReaderTheme={vi.fn()}
        onLocationChange={vi.fn()}
        onDownloadSource={vi.fn()}
        onConvertBook={vi.fn()}
      />,
    );

    expect(screen.getByText('Duna')).toBeInTheDocument();
    expect(screen.getByText('Progresso salvo')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /markdown/i }).length).toBeGreaterThan(0);
    expect(await screen.findByText('Visualização incorporada')).toBeInTheDocument();
  });
});
