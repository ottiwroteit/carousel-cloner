# Carousel Cloner

Local-first tool for turning a competitor TikTok slideshow URL into a randomized grocery carousel package with phone handoff.

## What Works In This First Version

- Paste a TikTok URL into a local web dashboard.
- Create a disk-backed job under `outputs/jobs/<job-id>`.
- Attempt direct TikTok metadata extraction with `yt-dlp`.
- Fall back to a useful local draft when TikTok blocks extraction.
- Generate a caption package, alternate hooks, slide text, hashtags, posting notes, and image prompts.
- Copy captions from the UI or download `captions.txt`.
- Generate local slide images into the job folder by default, with optional OpenAI image generation only when explicitly enabled.
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

## Running Without Codex

Codex is only needed to edit or improve the app. The Carousel Cloner runs as a normal local Next.js app from this folder.

Fast local mode:

```bash
npm run local
```

Production mode:

```bash
npm run build
npm start
```

On macOS, you can also double-click `Start Carousel Cloner.command` in this folder. It opens a Terminal window, starts the app, and keeps it running until you press `Control+C`.

Your phone handoff still works as long as your phone and computer are on the same Wi-Fi network. Codex usage limits do not affect the running app. OpenAI image generation depends on your OpenAI API key and billing limits, but local BARE product-image mode does not use Codex or OpenAI tokens.

## Optional Environment

```bash
OPENAI_API_KEY=your_key_here
CAROUSEL_IMAGE_PROVIDER=local
OPENAI_IMAGE_MODEL=gpt-image-1-mini
OPENAI_IMAGE_QUALITY=medium
TIKTOK_COOKIES_FILE=/absolute/path/to/cookies.txt
```

The app defaults to local generation so the full pipeline can run without paid APIs. When BARE product image URLs are available, local mode uses those real product images in vertical 9:16 slides; otherwise it falls back to placeholder SVG slides. Set `CAROUSEL_IMAGE_PROVIDER=openai` and `OPENAI_API_KEY` only when you want paid ChatGPT/OpenAI image generation.

## BARE Simulator Proof Screenshots

Scheduled TikTok carousel packages must use real BARE app product-detail screenshots for proof slides. The simulator workflow is:

1. Tap the `Scan` tab.
2. Tap the `Enter barcode manually` field.
3. Type the product barcode from the BARE catalog.
4. Press the submit arrow.
5. Wait for the product detail sheet to open.
6. Screenshot the product detail sheet.

Do not accept Home, Profile, Scan, unmatched-route, blank, or competitor-style generated proof screens as carousel proof slides. If the product detail sheet is not visible, the scheduled package should fail instead of posting.

`OPENAI_IMAGE_MODEL` controls image cost. Supported values:

- `gpt-image-1-mini` cheaper default
- `gpt-image-1` higher quality, higher cost

`OPENAI_IMAGE_QUALITY` supports `low`, `medium`, `high`, or `auto`. The default is `medium`.

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
