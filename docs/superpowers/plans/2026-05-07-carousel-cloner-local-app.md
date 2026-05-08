# Carousel Cloner Local App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first local web app that accepts a TikTok slideshow URL, creates a disk-backed job, attempts direct extraction, generates analysis/caption/image prompt artifacts, and exposes captions for copy/download.

**Architecture:** A Next.js app owns the UI and local API routes. Server-side modules handle validation, job persistence, extraction, AI/generation stubs with optional OpenAI integration, and exports so each part can be tested independently.

**Tech Stack:** Next.js, TypeScript, Node filesystem APIs, Vitest, `yt-dlp` through child process, optional OpenAI SDK.

---

### Task 1: Scaffold Local Next.js Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `app/layout.tsx`
- Create: `app/globals.css`

- [ ] **Step 1: Create project configuration**

Create package scripts for `dev`, `build`, `lint`, and `test`. Add Next.js, React, OpenAI, TypeScript, ESLint, and Vitest dependencies.

- [ ] **Step 2: Create base app shell**

Create a minimal app layout and global CSS with a dark, utilitarian dashboard style.

- [ ] **Step 3: Install dependencies**

Run: `npm install`

- [ ] **Step 4: Verify scaffold**

Run: `npm run lint`

Expected: lint completes or reports only config issues fixed in this task.

### Task 2: Add Core Types, URL Validation, Caption Export, and Tests

**Files:**
- Create: `lib/types.ts`
- Create: `lib/url.ts`
- Create: `lib/export/captions.ts`
- Create: `tests/url.test.ts`
- Create: `tests/captions.test.ts`

- [ ] **Step 1: Write failing tests**

Test valid TikTok URL parsing, invalid URL rejection, and caption text formatting with main caption, alternate hooks, hashtags, slide text, and posting notes.

- [ ] **Step 2: Implement modules**

Define shared job/profile/result types, `validateTikTokUrl(input)`, and `formatCaptionPackage(result)`.

- [ ] **Step 3: Verify tests**

Run: `npm run test -- --run tests/url.test.ts tests/captions.test.ts`

Expected: all tests pass.

### Task 3: Add Disk-Backed Jobs

**Files:**
- Create: `lib/jobs/store.ts`
- Create: `tests/jobs.test.ts`

- [ ] **Step 1: Write failing tests**

Test job creation, status updates, JSON artifact writing, and reading the full job snapshot.

- [ ] **Step 2: Implement job store**

Create job folders under `outputs/jobs/<job-id>`, write `input.json`, `status.json`, and artifact files.

- [ ] **Step 3: Verify tests**

Run: `npm run test -- --run tests/jobs.test.ts`

Expected: all tests pass.

### Task 4: Add Extractor and Generator Pipeline

**Files:**
- Create: `lib/extractors/tiktok.ts`
- Create: `lib/generator/pipeline.ts`
- Create: `tests/extractor.test.ts`
- Create: `tests/pipeline.test.ts`

- [ ] **Step 1: Write failing tests**

Test extractor error normalization when `yt-dlp` is unavailable or blocked. Test that the pipeline produces useful fallback analysis and captions even when extraction fails.

- [ ] **Step 2: Implement extractor**

Call `yt-dlp` with JSON output and artifact paths. Normalize failures into actionable errors. Keep the interface independent from the UI.

- [ ] **Step 3: Implement generator pipeline**

Create a deterministic MVP pipeline that writes analysis, generated package JSON, and captions. Use OpenAI only when `OPENAI_API_KEY` is present; otherwise produce marked local draft outputs so the UI still works.

- [ ] **Step 4: Verify tests**

Run: `npm run test -- --run tests/extractor.test.ts tests/pipeline.test.ts`

Expected: all tests pass.

### Task 5: Add API Routes and Dashboard UI

**Files:**
- Create: `app/api/jobs/route.ts`
- Create: `app/api/jobs/[id]/route.ts`
- Create: `app/api/jobs/[id]/captions/route.ts`
- Create: `app/page.tsx`

- [ ] **Step 1: Implement API routes**

Add `POST /api/jobs` to create and process a job, `GET /api/jobs/:id` to read status/results, and `GET /api/jobs/:id/captions` to download `captions.txt`.

- [ ] **Step 2: Implement dashboard**

Add URL input, style profile text areas, job status, analysis preview, generated slide text, captions box, copy button, and download link.

- [ ] **Step 3: Verify app build**

Run: `npm run lint && npm run test -- --run && npm run build`

Expected: lint, tests, and build pass.

### Task 6: Manual Local Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add usage docs**

Document setup, `.env.local`, `yt-dlp`, running locally, where outputs are saved, and what direct TikTok extraction limitations mean.

- [ ] **Step 2: Start local server**

Run: `npm run dev`

Expected: local app starts on `http://localhost:3000` or another available port.

- [ ] **Step 3: Smoke test**

Create one job from a TikTok URL or a known blocked URL and confirm the app returns an actionable failed/partial job with downloadable captions.

- [ ] **Step 4: Commit implementation**

Commit the working app once verification is complete.
