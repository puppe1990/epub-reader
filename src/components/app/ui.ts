export type ReaderTheme = 'light' | 'sepia' | 'dark';
export type NoticeTone = 'info' | 'success' | 'error';

export interface Notice {
  id: number;
  message: string;
  tone: NoticeTone;
}

export const toneClasses: Record<NoticeTone, string> = {
  info: 'border-[color:var(--border-strong)] bg-[color:var(--surface)] text-[color:var(--text)]',
  success: 'border-emerald-300/70 bg-emerald-50 text-emerald-900',
  error: 'border-rose-300/80 bg-rose-50 text-rose-900',
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatAddedAt = (timestamp: number): string => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(timestamp));
};
