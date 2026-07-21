# AI Chatbot Platform — Project Summary

Purpose
- Lightweight platform to build, manage, and embed AI chatbots for small businesses.
- Core features: Firebase auth, Prisma/MySQL persistence, OpenRouter AI integration, knowledge base (URL scrape + uploads), leads tracking, dashboard and embeddable widget.

Tech stack
- Next.js 14 (App Router) with TypeScript
- Tailwind CSS
- Firebase Auth
- Prisma ORM + MySQL
- OpenRouter.ai (chat completions)
- Utilities: Cheerio (URL scraping), mammoth/pdf-parse (document parsing), nodemailer

Run locally
```bash
# install
npm install
# set env from .env.example
cp .env.example .env.local
# generate prisma client and push schema
npm run db:generate
npm run db:push
# dev server
npm run dev
```

Environment variables (key ones)
- `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`
- `DATABASE_URL` — MySQL connection
- `OPENROUTER_API_KEY`, optional `OPENROUTER_BASE_URL`
- `NEXT_PUBLIC_APP_URL` (used in OpenRouter headers)

Important files (what they contain)
- `package.json` — scripts and deps
- `README.md` — setup + high-level overview
- `prisma/schema.prisma` — database models: `User`, `Conversation`, `Message`, `Lead`, `KnowledgeBase`

Key app code
- `src/lib/firebase.ts` — Firebase initialization
- `src/lib/auth-context.tsx` — client auth provider (`useAuth` hook)
- `src/lib/prisma.ts` — Prisma client singleton
- `src/lib/openrouter.ts` — OpenRouter client + streaming helper (where AI calls are made)

API routes (server)
- `src/app/api/chat/route.ts` — forwards chat messages to OpenRouter via `sendMessage`
- `src/app/api/knowledge-base/*` — CRUD plus `scrape/route.ts` (cheerio) and `upload/route.ts` (pdf/docx/txt parsing)
- `src/app/api/leads/route.ts` — leads CRUD
- `src/app/api/user/route.ts` — get/create/update user rows linked to Firebase UID
- `src/app/api/widget/init/route.ts` — widget initialization: domain authorization, fetch KB items, compose `systemPrompt` and welcome text for the widget

Frontend structure
- `src/app/layout.tsx`, `src/app/page.tsx` — root layout + home redirect logic
- `src/components/auth/*` — `LoginForm.tsx`, `SignupForm.tsx`
- `src/components/chat/ChatWidget.tsx` — embeddable chat UI used in demo and can be used as widget
- `src/components/dashboard/*` — `Header.tsx`, `Sidebar.tsx`, `StatsCard.tsx`
- `src/components/ui/*` — shared UI primitives (`Button`, `Card`, `Input`)

Public demo
- `public/demo.html` — standalone demo website showing widget integration and client-side widget logic

Data flow summary
- User signs in via Firebase (client) -> `auth-context` reads user -> server `user` route ensures DB row exists (firebaseUid)<br>
- Widget load flow: client calls `/api/widget/init` with `userId` + `domain` -> server checks `registeredDomain` and returns `authorized` + `config` including `systemPrompt` with concatenated KB entries (max 20)
- Chat flow: frontend collects conversation history -> POST `/api/chat` -> server calls `src/lib/openrouter.sendMessage` -> returns AI response to frontend
- KB ingestion: either `scrape` (URL) or `upload` (file) endpoints extract text, format it, and create `KnowledgeBase` rows

Risks & considerations
- OpenRouter API key must be in server env only. Ensure not exposed to client.
- KB context concatenation may hit token limits for large KB entries — platform limits to 20 items but further chunking or embeddings would be more robust.
- File upload extraction has size limits (10MB) and truncation at 50k chars.
- Domain authorization relies on `registeredDomain` string matching — ensure consistent normalization

Suggested next tasks (ready to paste into Gemini for prioritization)
1. Add embeddings + vector store (e.g., Weaviate/Pinecone/SQLite+FAISS) for scalable KB context retrieval
   - Files to update: `src/app/api/knowledge-base/*`, `src/lib/openrouter.ts` (use retrieval augmentation instead of raw concat)
2. Rate limits / quota handling for OpenRouter calls and graceful fallbacks
   - Files: `src/app/api/chat/route.ts`, `src/lib/openrouter.ts`
3. Add unit/integration tests for API routes and lib functions (scraper, upload parsing)
   - Tests target: `src/app/api/knowledge-base/scrape/route.ts`, `src/app/api/knowledge-base/upload/route.ts`
4. Improve widget security: sign widget tokens server-side (short-lived JWT) and validate on init
   - Files: `src/app/api/widget/init/route.ts` and client widget bootstrap in `public/demo.html`
5. UX improvements: persistent conversation, conversation list, export conversation summary AI feature
   - Files/components: `src/components/chat/ChatWidget.tsx`, new pages under `(dashboard)` and API updates to store/retrieve conversation summaries

Notes for Gemini input
- Paste this entire file into Gemini and ask to:
  - Identify highest-impact next step (embeddings vs incremental improvements)
  - Produce a minimal implementation plan for adding embeddings with file-level changes and estimated effort
  - Generate example API signatures and sample DB migrations (if needed)

---
Generated from repository scan on 2026-01-28. If you want, I can:
- Add a short README section for embedding integration (code snippets)
- Create a basic vector-store PoC branch and commit files
- Run a quick static analysis for potential runtime errors

