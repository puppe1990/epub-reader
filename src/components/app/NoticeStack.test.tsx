import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NoticeStack } from './NoticeStack';

describe('NoticeStack', () => {
  it('renders notices and dismisses one item', () => {
    const onDismiss = vi.fn();

    render(
      <NoticeStack
        notices={[
          { id: 1, message: 'EPUB enviado.', tone: 'success' },
          { id: 2, message: 'Falha ao converter PDF.', tone: 'error' },
        ]}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText('EPUB enviado.')).toBeInTheDocument();
    expect(screen.getByText('Falha ao converter PDF.')).toBeInTheDocument();

    fireEvent.click(screen.getAllByLabelText('Fechar notificação')[0]);
    expect(onDismiss).toHaveBeenCalledWith(1);
  });
});
