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
    <div className="w-full h-full flex flex-col bg-white">
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 bg-zinc-50">
        <h2 className="text-sm font-medium text-zinc-700">Markdown Preview</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 rounded-md hover:bg-zinc-50 transition-colors"
          >
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
          >
            <Download size={16} />
            Download .md
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6 bg-zinc-50">
        <pre className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-zinc-200 whitespace-pre-wrap font-mono text-sm text-zinc-800 leading-relaxed">
          {markdown || 'No content to display.'}
        </pre>
      </div>
    </div>
  );
};
