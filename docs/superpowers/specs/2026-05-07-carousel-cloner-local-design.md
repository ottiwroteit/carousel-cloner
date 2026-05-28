# Local Carousel Cloner Design

## Goal

Build a local-first tool that turns a competitor TikTok slideshow URL into a new carousel package in the user's account style. The first version prioritizes a dependable end-to-end workflow on the user's Mac: paste URL, extract source slides, analyze the pattern, generate new slide assets and captions, then copy or download the finished caption package.

## Scope

Version 1 includes:

- Local web app UI.
- Direct TikTok slideshow URL input.
- Job-based processing with files saved on disk.
- Source slide extraction through an isolated adapter.
- AI analysis of extracted slides.
- New slide copy and image prompt generation in a configurable account style.
- Generated carousel images through OpenAI image generation.
- Caption package preview, copy, and download.

Version 1 does not include:

- Hosted deployment.
- Multi-user accounts.
- Scheduling or auto-posting.
- Native Telegram delivery.
- Guaranteed extraction for every TikTok URL if TikTok blocks access.

## Product Flow

1. User opens the local app.
2. User pastes a TikTok slideshow URL.
3. User selects or edits an account style profile.
4. App creates a job folder under `outputs/jobs/<job-id>`.
5. Extractor downloads or captures source slide images and metadata.
6. Analyzer summarizes the competitor structure, hook, pacing, visual pattern, caption style, and likely reason the post worked.
7. Generator creates a new carousel concept, slide-by-slide copy, image prompts, and caption package.
8. Image generator creates final slide images in the account style.
9. UI shows source analysis, generated slide previews, captions, and export controls.
10. User copies captions or downloads the package.

## Architecture

Use a local Next.js app because it gives one project for UI and API routes, works well on localhost, and can call local filesystem tools from server routes.

Core modules:

- `app/page.tsx`: main local dashboard.
- `app/api/jobs/route.ts`: create a job from URL and style settings.
- `app/api/jobs/[id]/route.ts`: read job status and results.
- `lib/jobs`: job folders, status, artifacts, and logs.
- `lib/extractors`: TikTok source extraction adapter.
- `lib/ai`: OpenAI calls for analysis, slide writing, captions, and image generation.
- `lib/export`: caption and package export helpers.
- `styles/profiles`: local JSON style profiles.

The TikTok extractor is deliberately isolated. The first adapter can use `yt-dlp` and metadata parsing where available. If a URL cannot be extracted cleanly, the app reports a specific extractor failure and keeps the job folder for debugging. A future adapter can use browser automation or cookies without changing the analyzer, generator, or UI.

## Data Model

Each job folder contains:

- `input.json`: original URL, chosen style profile, timestamps.
- `status.json`: state, progress, errors, and artifact paths.
- `source/`: extracted competitor images and metadata.
- `analysis.json`: structured analysis of source slides.
- `generated/`: generated slide images.
- `captions.txt`: final caption package for copying.
- `package.json`: structured final output for automation.

Job states:

- `queued`
- `extracting`
- `analyzing`
- `generating_copy`
- `generating_images`
- `ready`
- `failed`

## Account Style

Style profiles are local JSON files. A profile includes:

- account name
- target audience
- recurring topics
- tone
- caption rules
- image style description
- banned phrases or visual elements
- preferred CTA style

The UI starts with one editable default profile. The generator includes the selected profile in both text and image prompts.

## Caption Output

Captions are required output, independent of Telegram. The UI provides:

- copy final caption
- copy slide text
- download `captions.txt`
- download full structured `package.json`

The caption package includes:

- main caption
- optional alternate hooks
- suggested hashtags
- per-slide overlay text
- posting notes

## BARE Product Selection Rules

For scheduled BARE social drafts, product selection must use the broad BARE catalog rather than a small hardcoded History list. The History tab is allowed as a screenshot shortcut only; it is not allowed to define the product pool. If a selected catalog product is not currently visible in History, the app must use the Scan tab/manual barcode fallback to open the BARE product detail screen.

Weekly batches must avoid repeating products from the immediately previous carousel. Do not fill a week with the same products just because they are easy to screenshot.

Hard exclusions unless the user explicitly reverses them:

- Ozarka / Ozarka Water
- olive oil products
- Liquid Death
- Snapple
- raw chicken, raw meat, bacon, Spam, or other visually unfit meat products

Storefront heroes and products must make sense together. Do not use a Trader Joe's hero unless the products are Trader Joe's products. For general catalog items, use general grocery/storefront context instead of implying a store-specific haul.

## Error Handling

The app should make failures actionable:

- Invalid URL: show validation error before creating a job.
- TikTok extraction blocked: explain that the extractor could not access the slideshow and save logs in the job folder.
- OpenAI API key missing: show setup instructions for `.env.local`.
- Image generation failure: keep completed analysis and copy so captions are still available.
- Partial success: allow downloads for any artifacts already created.

## Testing

Use focused tests around non-visual logic:

- URL validation.
- job folder creation and status transitions.
- caption export formatting.
- style profile parsing.
- extractor error normalization.

Manual verification for v1:

- Start local dev server.
- Create a job from a real TikTok slideshow URL.
- Confirm extracted source artifacts are saved.
- Confirm captions can be copied and downloaded.
- Confirm generated images render in the UI.

## Implementation Notes

Use environment variables:

- `OPENAI_API_KEY`
- optional `TIKTOK_COOKIES_FILE`

Use package scripts:

- `npm run dev`
- `npm run lint`
- `npm run test`

Keep the first implementation small but real. The app should process one job at a time in the API request or through a simple local worker. Add queues only after the core workflow works.
