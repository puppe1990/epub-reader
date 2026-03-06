import React from 'react';
import { X } from 'lucide-react';
import { Notice, toneClasses } from './ui';

interface NoticeStackProps {
  notices: Notice[];
  onDismiss: (id: number) => void;
}

export const NoticeStack = React.memo(function NoticeStack({
  notices,
  onDismiss,
}: NoticeStackProps) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-40 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {notices.map((notice) => (
        <div
          key={notice.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-[var(--shadow-card)] ${toneClasses[notice.tone]}`}
        >
          <div className="mt-0.5 h-2.5 w-2.5 rounded-full bg-current opacity-70" />
          <p className="flex-1 leading-5">{notice.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(notice.id)}
            className="rounded-full p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
            aria-label="Fechar notificação"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
});
