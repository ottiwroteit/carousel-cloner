"use client";

import { useMemo, useState } from "react";
import type { JobSnapshot } from "@/lib/jobs/store";
import type { CarouselSlidePlan, GeneratedPackage, SourceAnalysis, StyleProfile } from "@/lib/types";

const defaultProfile: StyleProfile = {
  accountName: "Carousel Cloner",
  targetAudience: "founders, creators, and operators building with AI",
  topics: ["automation", "content systems", "AI workflows"],
  tone: "direct, practical, slightly punchy",
  captionRules: "Short paragraphs. No fake urgency. Make the workflow feel immediately useful.",
  imageStyle: "clean vertical app screenshots, crisp interface details, high contrast, editorial tech feel",
  bannedElements: [],
  ctaStyle: "Ask what they would automate next."
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  const analysis = job?.artifacts["analysis.json"] as SourceAnalysis | undefined;
  const generated = job?.artifacts["package.json"] as GeneratedPackage | undefined;
  const imageGeneration = job?.artifacts["image-generation.json"] as
    | { provider: "openai"; model: string; quality: string; outputFormat: string }
    | { provider: "hybrid-web-openai"; model: string; quality: string; outputFormat: string; productSources: unknown[] }
    | { provider: "local-real-products"; reason: string; productSources: unknown[] }
    | { provider: "local-svg"; reason: string }
    | undefined;

  const captionsUrl = useMemo(() => (job ? `/api/jobs/${job.status.id}/captions` : ""), [job]);
  const phoneUrl = useMemo(() => (job ? `/jobs/${job.status.id}/phone` : ""), [job]);
  const qrUrl = useMemo(
    () => (job ? `/api/jobs/${job.status.id}/qr?origin=${encodeURIComponent(origin)}` : ""),
    [job, origin]
  );

  async function createJob() {
    setBusy(true);
    setError("");
    setCopied(false);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url, profile: defaultProfile })
      });
      const text = await response.text();
      const payload = text ? (JSON.parse(text) as JobSnapshot | { error: string }) : { error: "Server returned an empty response." };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Job failed.");
      }

      setJob(payload as JobSnapshot);
      setOrigin(window.location.origin);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCaptions() {
    if (!job) {
      return;
    }

    const response = await fetch(captionsUrl);
    const text = await response.text();
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <main className="app">
      <section className="masthead">
        <div>
          <p className="eyebrow">Local-first social automation</p>
          <h1>Carousel Cloner</h1>
          <p className="lede">
            Paste a competitor TikTok slideshow URL, extract what we can, then generate a randomized grocery carousel
            package you can hand off to your phone.
          </p>
        </div>
        <div className="statusPill">{job ? job.status.state : "ready"}</div>
      </section>

      <section className="grid">
        <form
          className="panel controls"
          onSubmit={(event) => {
            event.preventDefault();
            void createJob();
          }}
        >
          <label>
            TikTok slideshow URL
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.tiktok.com/@creator/video/..."
            />
          </label>

          <button disabled={busy || !url.trim()}>{busy ? "Processing..." : "Generate carousel package"}</button>
          {error ? <p className="error">{error}</p> : null}
        </form>

        <section className="panel results">
          <div className="panelHeader">
            <h2>Captions</h2>
            <div className="actions">
              <button type="button" disabled={!job} onClick={() => void copyCaptions()}>
                {copied ? "Copied" : "Copy"}
              </button>
              <a className={!job ? "disabled" : ""} href={captionsUrl}>
                Download .txt
              </a>
            </div>
          </div>

          {generated ? (
            <pre className="captionBox">{generated.mainCaption}</pre>
          ) : (
            <div className="empty">Your caption package will appear here after a job runs.</div>
          )}
        </section>
      </section>

      {analysis && generated ? (
        <section className="lowerGrid">
          <article className="panel">
            <h2>Source Analysis</h2>
            <dl>
              <dt>Hook</dt>
              <dd>{analysis.hook}</dd>
              <dt>Pacing</dt>
              <dd>{analysis.pacing}</dd>
              <dt>Why it works</dt>
              <dd>{analysis.whyItWorks}</dd>
            </dl>
          </article>

          <article className="panel">
            <h2>Carousel Order</h2>
            <ol className="slideList">
              {(generated.carouselSlides ?? []).map((slide: CarouselSlidePlan) => (
                <li key={`${slide.position}-${slide.title}`}>
                  <strong>Slide {slide.position}:</strong> {slide.title}
                  {slide.kind === "bare-screenshot" ? " — add BARE app screenshot" : ""}
                </li>
              ))}
            </ol>
          </article>
        </section>
      ) : null}

      {job && generated ? (
        <section className="handoffGrid">
          <article className="panel handoffPanel">
            <div>
              <h2>Phone Handoff</h2>
              <p className="mutedText">Scan this on your phone, save the images, copy the caption, and post natively.</p>
            </div>
            <img className="qrCode" src={qrUrl} alt="QR code for phone handoff page" />
            <div className="actions wrap">
              <a href={phoneUrl}>Open phone page</a>
              <a href={`/api/jobs/${job.status.id}/images`}>Download all images</a>
            </div>
          </article>

          <article className="panel">
            <h2>Generated Photos</h2>
            {imageGeneration?.provider === "local-svg" ? (
              <p className="successText">Using local image mode: {imageGeneration.reason}</p>
            ) : null}
            {imageGeneration?.provider === "openai" ? (
              <p className="successText">
                Generated with {imageGeneration.model} at {imageGeneration.quality} quality.
              </p>
            ) : null}
            {imageGeneration?.provider === "hybrid-web-openai" ? (
              <p className="successText">
                Generated hook with {imageGeneration.model}; sourced {imageGeneration.productSources.length} product image
                {imageGeneration.productSources.length === 1 ? "" : "s"} from the web.
              </p>
            ) : null}
            {imageGeneration?.provider === "local-real-products" ? (
              <p className="successText">
                Local mode used {imageGeneration.productSources.length} real BARE product image
                {imageGeneration.productSources.length === 1 ? "" : "s"}.
              </p>
            ) : null}
            <div className="imageGrid">
              {(generated.carouselSlides ?? [])
                .filter((slide) => slide.kind !== "bare-screenshot" && slide.generatedImage)
                .map((slide) => {
                const image = slide.generatedImage as string;
                const imageUrl = `/api/jobs/${job.status.id}/files/${image}`;
                const extension = image.split(".").at(-1) ?? "png";
                return (
                  <figure key={image} className="imageCard">
                    <img src={imageUrl} alt={`Generated ${slide.title}`} />
                    <figcaption>
                      Slide {slide.position}
                      <a href={imageUrl} download={`slide-${String(slide.position).padStart(2, "0")}.${extension}`}>
                        Save image
                      </a>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
}
