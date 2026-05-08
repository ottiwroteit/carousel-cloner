# Carousel Cloner

Local-first tool for turning a competitor TikTok slideshow URL into a new carousel planning package in your account style.

## What Works In This First Version

- Paste a TikTok URL into a local web dashboard.
- Create a disk-backed job under `outputs/jobs/<job-id>`.
- Attempt direct TikTok metadata extraction with `yt-dlp`.
- Fall back to a useful local draft when TikTok blocks extraction.
- Generate a caption package, alternate hooks, slide text, hashtags, posting notes, and image prompts.
- Copy captions from the UI or download `captions.txt`.
- Generate one local slide image per slide into the job folder.
- Scan a QR code to open a phone handoff page.
- Save individual images on your phone or download all images as a zip.

This version does not auto-post, schedule content, or guarantee every TikTok slideshow can be extracted. TikTok frequently blocks direct extraction, so blocked URLs produce an actionable partial job instead of a dead end.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Optional Environment

```bash
OPENAI_API_KEY=your_key_here
TIKTOK_COOKIES_FILE=/absolute/path/to/cookies.txt
```

`OPENAI_API_KEY` enables real ChatGPT/OpenAI image generation through `gpt-image-1`. Without it, the app clearly marks image generation as skipped and uses local SVG placeholders so the handoff flow can still be tested.

`TIKTOK_COOKIES_FILE` is passed to `yt-dlp` when set. It can help with URLs that need an authenticated TikTok session.

## TikTok Extraction

Install `yt-dlp` if you want direct URL extraction:

```bash
brew install yt-dlp
```

If `yt-dlp` is missing or TikTok blocks a URL, the app still writes:

- `analysis.json`
- `extractor-error.json`
- `package.json`
- `captions.txt`

## Output Files

Jobs are saved in:

```bash
outputs/jobs/<job-id>
```

Each job contains `input.json`, `status.json`, generated JSON artifacts, and `captions.txt`.

Generated slide images are saved in:

```bash
outputs/jobs/<job-id>/generated
```

The dashboard also exposes:

- `/jobs/<job-id>/phone` for phone handoff
- `/api/jobs/<job-id>/images` for the image zip

## Scripts

```bash
npm run dev
npm run lint
npm run test -- --run
npm run build
```
