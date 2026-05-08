"use client";

import { useMemo, useState } from "react";
import type { JobSnapshot } from "@/lib/jobs/store";
import type { GeneratedPackage, SourceAnalysis, StyleProfile } from "@/lib/types";

const defaultProfile: StyleProfile = {
  accountName: "Carousel Cloner",
  targetAudience: "founders, creators, and operators building with AI",
  topics: ["automation", "content systems", "AI workflows"],
  tone: "direct, practical, slightly punchy",
  captionRules: "Short paragraphs. No fake urgency. Make the workflow feel immediately useful.",
  imageStyle: "clean vertical app screenshots, crisp interface details, high contrast, editorial tech feel",
  bannedElements: ["generic motivational quotes", "fake income claims", "overcrowded text"],
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
      const payload = (await response.json()) as JobSnapshot | { error: string };

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
            Paste a competitor TikTok slideshow URL, extract what we can, then generate a new caption package and slide
            plan in your account style.
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
            <h2>Slide Text</h2>
            <ol className="slideList">
              {generated.slideText.map((slide) => (
                <li key={slide}>{slide}</li>
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
              <a href={phoneUrl} target="_blank">
                Open phone page
              </a>
              <a href={`/api/jobs/${job.status.id}/images`}>Download all images</a>
            </div>
          </article>

          <article className="panel">
            <h2>Generated Images</h2>
            <div className="imageGrid">
              {(generated.generatedImages ?? []).map((image, index) => {
                const imageUrl = `/api/jobs/${job.status.id}/files/${image}`;
                return (
                  <figure key={image} className="imageCard">
                    <img src={imageUrl} alt={`Generated carousel slide ${index + 1}`} />
                    <figcaption>
                      Slide {index + 1}
                      <a href={imageUrl} download={`slide-${String(index + 1).padStart(2, "0")}.svg`}>
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
