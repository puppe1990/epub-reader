import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LibraryView } from './LibraryView';

const books = [
  {
    id: '1',
    title: 'Duna',
    author: 'Frank Herbert',
    format: 'epub' as const,
    addedAt: Date.now(),
    sizeBytes: 1024 * 1024,
  },
  {
    id: '2',
    title: 'Neuromancer',
    author: 'William Gibson',
    format: 'pdf' as const,
    addedAt: Date.now() - 1000,
    sizeBytes: 2048,
  },
];

describe('LibraryView', () => {
  it('renders library metrics and cards', () => {
    render(
      <LibraryView
        books={books}
        filteredBooks={books}
        isLoadingBooks={false}
        isOpeningBook={false}
        openingBookId={null}
        isUploading={false}
        searchQuery=""
        formatFilter="all"
        sortBy="recent"
        onSearchQueryChange={vi.fn()}
        onFormatFilterChange={vi.fn()}
        onSortByChange={vi.fn()}
        onUpload={vi.fn()}
        onSelectBook={vi.fn()}
        onDeleteBook={vi.fn()}
        libraryTaskStatus={{ tone: 'info', message: 'Convertendo PDF no servidor...' }}
      />,
    );

    expect(screen.getByText('Leitura limpa, biblioteca enxuta, conversão sem ruído.')).toBeInTheDocument();
    expect(screen.getByText('Duna')).toBeInTheDocument();
    expect(screen.getByText('Neuromancer')).toBeInTheDocument();
    expect(screen.getByText('Convertendo PDF no servidor...')).toBeInTheDocument();
  });
});
