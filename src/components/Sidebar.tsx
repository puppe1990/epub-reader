import React, { useState } from 'react';
import { Book, List, Upload, Trash2, X } from 'lucide-react';
import { BookRecord } from '../services/db';

interface SidebarProps {
  books: Omit<BookRecord, 'data'>[];
  activeBookId: string | null;
  onSelectBook: (id: string) => void;
  onDeleteBook: (id: string) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  toc: any[];
  onSelectToc: (href: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  books,
  activeBookId,
  onSelectBook,
  onDeleteBook,
  onUpload,
  toc,
  onSelectToc,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'library' | 'contents'>('library');

  return (
    <div
      className={`fixed inset-y-0 left-0 z-50 w-72 bg-zinc-900 text-zinc-100 transform transition-transform duration-300 ease-in-out flex flex-col ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } md:relative md:translate-x-0`}
    >
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h1 className="text-xl font-semibold tracking-tight">EPUB Reader</h1>
        <button onClick={onClose} className="md:hidden p-2 text-zinc-400 hover:text-white">
          <X size={20} />
        </button>
      </div>

      <div className="flex border-b border-zinc-800">
        <button
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
            activeTab === 'library' ? 'text-white border-b-2 border-indigo-500' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          onClick={() => setActiveTab('library')}
        >
          <Book size={16} /> Library
        </button>
        <button
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
            activeTab === 'contents' ? 'text-white border-b-2 border-indigo-500' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          onClick={() => setActiveTab('contents')}
          disabled={!activeBookId}
        >
          <List size={16} /> Contents
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'library' ? (
          <div className="space-y-4">
            <label className="flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed border-zinc-700 rounded-xl text-zinc-400 hover:text-white hover:border-zinc-500 cursor-pointer transition-colors">
              <Upload size={20} />
              <span className="text-sm font-medium">Upload EPUB</span>
              <input type="file" accept=".epub" className="hidden" onChange={onUpload} />
            </label>

            <div className="space-y-2">
              {books.map((book) => (
                <div
                  key={book.id}
                  className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    activeBookId === book.id ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                  }`}
                  onClick={() => onSelectBook(book.id)}
                >
                  <div className="w-12 h-16 bg-zinc-800 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                      <Book size={24} className="text-zinc-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">{book.title}</h3>
                    <p className="text-xs text-zinc-400 truncate">{book.author}</p>
                  </div>
                  <button
                    className="p-2 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteBook(book.id);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {books.length === 0 && (
                <p className="text-center text-sm text-zinc-500 mt-8">No books in library.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {toc.map((item, index) => (
              <button
                key={index}
                className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-lg truncate transition-colors"
                onClick={() => onSelectToc(item.href)}
              >
                {item.label}
              </button>
            ))}
            {toc.length === 0 && (
              <p className="text-center text-sm text-zinc-500 mt-8">No table of contents available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
