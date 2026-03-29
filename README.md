# EPUB & PDF Reader

Aplicação web para leitura de arquivos **EPUB** e **PDF**, com biblioteca remota em **Turso** e API em **Netlify Functions**.

## Funcionalidades

- Upload de arquivos `.epub` e `.pdf`
- Biblioteca em grid (livros lado a lado)
- Abertura do livro ao clicar no card
- Leitor EPUB com navegação por botões e teclado (`←` / `→`)
- Indicador de progresso global do livro no EPUB (`página atual / total`)
- Persistência de progresso de leitura no servidor
- Visualização de PDF no navegador
- Conversão de capítulo/livro EPUB para Markdown
- Download e cópia do conteúdo Markdown

## Stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS 4
- Netlify Functions
- Turso (`@libsql/client`)
- `epubjs` para leitura de EPUB
- `turndown` para conversão HTML -> Markdown

## Requisitos

- Node.js 18+ (recomendado 20+)
- npm
- Conta/DB Turso

## Variáveis de ambiente

Copie `.env.example` para `.env` e configure:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `VITE_API_BASE_URL` (default recomendado: `/api`)

## Banco de dados

A migration inicial, a migration de storage em blobs e a migration do estado extra de leitura estão em:

- `db/migrations/001_init.sql`
- `db/migrations/002_blob_storage.sql`
- `db/migrations/003_reading_progress_extra_state.sql`

Para aplicar tudo no banco configurado no `.env`:

```bash
npm run db:migrate
```

O runner é idempotente: ele cria `schema_migrations`, detecta colunas já existentes e só aplica o que estiver faltando.

## Como rodar

1. Instale as dependências:

```bash
npm install
```

2. Rode em modo full-stack (frontend + functions):

```bash
npm run dev
```

3. Abra no navegador:

`http://localhost:8888`

## Desenvolvimento local

- `npm run dev`: sobe o app completo com `Netlify Dev` em `http://localhost:8888`
- `npm run dev:vite`: sobe somente o Vite em `http://localhost:8889`
- `npm run db:migrate`: aplica as migrations pendentes no Turso usando o `.env`

Observações importantes:

- Use `npm run dev` para desenvolvimento normal. Ele já sobe o Vite internamente.
- Não rode `npm run dev:vite` e `npm run dev` ao mesmo tempo.
- O projeto usa portas fixas para evitar proxy quebrado:
  - `8888`: app completo com Netlify Functions
  - `8889`: Vite puro
- Se alguma dessas portas já estiver em uso, encerre o processo antes de subir o projeto:

```bash
lsof -tiTCP:8888 -sTCP:LISTEN | xargs kill
lsof -tiTCP:8889 -sTCP:LISTEN | xargs kill
```

## Scripts

- `npm run dev`: roda app completo (Netlify proxy + Vite + Functions) em `http://localhost:8888`
- `npm run dev:vite`: roda somente o Vite em `http://localhost:8889`
- `npm run dev:netlify`: alias de `npm run dev`
- `npm run db:migrate`: aplica migrations pendentes no Turso
- `npm run build`: gera build de produção
- `npm run preview`: serve o build localmente
- `npm run lint`: checagem de tipos com TypeScript (`tsc --noEmit`)
- `npm run test`: smoke tests com Vitest
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
    apiClient.ts
    db.ts
    epubService.ts

netlify/
  functions/
    api.ts
    books-list.ts
    books-create.ts
    books-data.ts
    books-delete.ts
    progress-get.ts
    progress-put.ts
    uploads-init.ts
    uploads-chunk.ts
    uploads-complete.ts
    _lib/
      book-bytes.ts
      turso.ts
      http.ts
      uploads.ts

db/
  migrations/
    001_init.sql
    002_blob_storage.sql
    003_reading_progress_extra_state.sql

scripts/
  db-migrate.mjs
```

## Observações

- Sem autenticação nesta fase (namespace único do app).
- Upload em **chunks** com Netlify Blobs (suporte a arquivos até **25MB**).
- Em indisponibilidade da API/Turso, o app falha com mensagem clara (sem fallback local).
