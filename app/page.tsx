"use client";

import { useMemo, useState } from "react";
import type { JobSnapshot } from "@/lib/jobs/store";
import type { GeneratedPackage, SourceAnalysis, StyleProfile } from "@/lib/types";

const defaultProfile: StyleProfile = {
  accountName: "Otti",
  targetAudience: "founders, creators, and operators building with AI",
  topics: ["automation", "content systems", "AI workflows"],
  tone: "direct, practical, slightly punchy",
  captionRules: "Short paragraphs. No fake urgency. Make the workflow feel immediately useful.",
  imageStyle: "clean vertical app screenshots, crisp interface details, high contrast, editorial tech feel",
  bannedElements: ["generic motivational quotes", "fake income claims", "overcrowded text"],
  ctaStyle: "Ask what they would automate next."
};

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [accountName, setAccountName] = useState(defaultProfile.accountName);
  const [tone, setTone] = useState(defaultProfile.tone);
  const [imageStyle, setImageStyle] = useState(defaultProfile.imageStyle);
  const [topics, setTopics] = useState(defaultProfile.topics.join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [copied, setCopied] = useState(false);

  const analysis = job?.artifacts["analysis.json"] as SourceAnalysis | undefined;
  const generated = job?.artifacts["package.json"] as GeneratedPackage | undefined;

  const captionsUrl = useMemo(() => (job ? `/api/jobs/${job.status.id}/captions` : ""), [job]);

  async function createJob() {
    setBusy(true);
    setError("");
    setCopied(false);

    const profile: StyleProfile = {
      ...defaultProfile,
      accountName,
      tone,
      imageStyle,
      topics: splitLines(topics)
    };

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url, profile })
      });
      const payload = (await response.json()) as JobSnapshot | { error: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Job failed.");
      }

      setJob(payload as JobSnapshot);
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

          <div className="two">
            <label>
              Account
              <input value={accountName} onChange={(event) => setAccountName(event.target.value)} />
            </label>
            <label>
              Tone
              <input value={tone} onChange={(event) => setTone(event.target.value)} />
            </label>
          </div>

          <label>
            Topics
            <textarea value={topics} onChange={(event) => setTopics(event.target.value)} rows={4} />
          </label>

          <label>
            Image style
            <textarea value={imageStyle} onChange={(event) => setImageStyle(event.target.value)} rows={4} />
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
    </main>
  );
}
