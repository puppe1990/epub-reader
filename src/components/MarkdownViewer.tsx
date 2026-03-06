import React, { useState } from 'react';
import { Download, Copy, Check } from 'lucide-react';

interface MarkdownViewerProps {
  markdown: string;
  title: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ markdown, title }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full w-full flex-col bg-[color:var(--surface-muted)]">
      <div className="flex flex-col gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
            Saida gerada
          </p>
          <h2 className="mt-1 text-sm font-semibold text-[color:var(--text)] sm:text-base">Markdown do livro</h2>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button
            onClick={handleCopy}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm font-semibold text-[color:var(--text)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-muted)] sm:flex-none"
          >
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <button
            onClick={handleDownload}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[color:var(--accent)] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] sm:flex-none"
          >
            <Download size={16} />
            Baixar .md
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-5xl rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4 shadow-[var(--shadow-card)] sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
            <span className="rounded-full bg-[color:var(--surface-muted)] px-2.5 py-1">Arquivo pronto</span>
            <span className="rounded-full bg-[color:var(--surface-muted)] px-2.5 py-1">{title}</span>
          </div>
          <pre className="whitespace-pre-wrap rounded-[22px] bg-[color:var(--surface-muted)] p-4 font-mono text-xs leading-7 text-[color:var(--text)] sm:p-6 sm:text-sm">
          {markdown || 'Nenhum conteúdo disponível.'}
          </pre>
        </div>
      </div>
    </div>
  );
};
