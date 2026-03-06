import React, { useEffect, useMemo } from 'react';

interface PdfViewerProps {
  fileData: ArrayBuffer;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ fileData }) => {
  const objectUrl = useMemo(() => {
    const blob = new Blob([fileData], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  }, [fileData]);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  return (
    <div className="flex h-full w-full flex-col bg-[color:var(--surface-muted)]">
      <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-4 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
          Leitura PDF
        </p>
        <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-[color:var(--text)]">Visualização incorporada</h2>
          <p className="text-sm text-[color:var(--text-muted)]">
            Se o navegador limitar o preview, use o download do arquivo original.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4 sm:p-6">
        <div className="h-full overflow-hidden rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-3 shadow-[var(--shadow-card)] sm:p-4">
          <iframe src={objectUrl} title="PDF Viewer" className="h-full w-full rounded-[20px] border-0 bg-white" />
        </div>
      </div>
    </div>
  );
};
