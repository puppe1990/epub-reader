# EPUB & PDF Reader

Aplicação web para leitura de arquivos **EPUB** e **PDF**, com biblioteca local no navegador e conversão de EPUB para Markdown.

## Funcionalidades

- Upload de arquivos `.epub` e `.pdf`
- Biblioteca em grid (livros lado a lado)
- Abertura do livro ao clicar no card
- Leitor EPUB com navegação por botões e teclado (`←` / `→`)
- Indicador de progresso global do livro no EPUB (`página atual / total`)
- Visualização de PDF no navegador
- Conversão de capítulo/livro EPUB para Markdown
- Download e cópia do conteúdo Markdown
- Persistência local dos livros via IndexedDB (`localforage`)

## Stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS 4
- `epubjs` para leitura de EPUB
- `turndown` para conversão HTML -> Markdown
- `localforage` para armazenamento local

## Requisitos

- Node.js 18+ (recomendado 20+)
- npm

## Como rodar

1. Instale as dependências:

```bash
npm install
```

2. Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

3. Abra no navegador:

`http://localhost:3000`

## Scripts

- `npm run dev`: inicia em modo desenvolvimento (`--port=3000 --host=0.0.0.0`)
- `npm run build`: gera build de produção
- `npm run preview`: serve o build localmente
- `npm run lint`: checagem de tipos com TypeScript (`tsc --noEmit`)
- `npm run clean`: remove a pasta `dist`

## Estrutura principal

```txt
src/
  App.tsx
  components/
    EpubViewer.tsx
    PdfViewer.tsx
    MarkdownViewer.tsx
  services/
    db.ts
    epubService.ts
```

## Observações

- O projeto funciona 100% no frontend e salva dados localmente no navegador.
- A conversão para Markdown está disponível para EPUB.
