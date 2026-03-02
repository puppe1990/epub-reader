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
    <div className="w-full h-full bg-zinc-100">
      <iframe
        src={objectUrl}
        title="PDF Viewer"
        className="w-full h-full border-0"
      />
    </div>
  );
};
