import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { readJob, readJobTextArtifact } from "@/lib/jobs/store";
import { getPhoneBaseUrl } from "@/lib/network";
import { captionCopyScript } from "@/lib/phone/caption-copy";
import type { CarouselSlidePlan, GeneratedPackage } from "@/lib/types";

type PhonePageProps = {
  params: Promise<{ id: string }>;
};

export default async function PhonePage({ params }: PhonePageProps) {
  const { id } = await params;

  try {
    const job = await readJob(id);
    const captions = await readJobTextArtifact(id, "captions.txt");
    const pkg = job.artifacts["package.json"] as GeneratedPackage;
    const slides = pkg.carouselSlides ?? [];
    const requestHeaders = await headers();
    const host = requestHeaders.get("host") ?? "localhost:3000";
    const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
    const phoneUrl = `${getPhoneBaseUrl(`${proto}://${host}`)}/jobs/${id}/phone`;

    return (
      <main className="phonePage">
        <Link className="backLink" href="/">
          Back to dashboard
        </Link>
        <section className="phoneHero">
          <p className="eyebrow">Phone handoff</p>
          <h1>{pkg.title}</h1>
          <p className="lede">Save the images, copy the caption, then post natively in TikTok or Instagram.</p>
        </section>

        <section className="panel phoneQrPanel">
          <div>
            <h2>Scan to open this page</h2>
            <p className="mutedText">Use this from your computer when you want the package on your phone.</p>
          </div>
          <img className="qrCode" src={`/api/jobs/${id}/qr?origin=${encodeURIComponent(`${proto}://${host}`)}`} alt="QR code for this phone handoff page" />
          <a href={phoneUrl}>{phoneUrl}</a>
        </section>

        <section className="panel phoneActions">
          <button type="button" data-copy-caption-button className="copyCaptionButton">
            Copy caption
          </button>
          <Link href={`/api/jobs/${id}/images`}>Download all images</Link>
          <p className="copyCaptionStatus" data-copy-caption-status>
            If iPhone blocks copy on local Wi-Fi, the button will select the caption below.
          </p>
        </section>

        <section className="panel swipeReview" data-review-root data-job-id={id}>
          <div className="swipeReviewHeader">
            <div>
              <p className="eyebrow" data-review-step>
                Review
              </p>
              <h2 data-review-title>Loading candidate</h2>
            </div>
            <span data-review-count>0/0</span>
          </div>
          <div className="swipeFrame" data-swipe-frame>
            <img data-review-image alt="Current carousel candidate" />
            <div className="swipeLoading" data-review-loading hidden>
              Generating next option...
            </div>
          </div>
          <p className="mutedText" data-review-detail>
            Swipe right to keep. Swipe left to try another option.
          </p>
          <div className="swipeButtons">
            <button type="button" data-review-reject>
              Try another
            </button>
            <button type="button" data-review-accept>
              Keep
            </button>
          </div>
        </section>

        <section className="phoneImageStack">
          {slides.map((slide: CarouselSlidePlan) => {
            if (slide.kind === "bare-screenshot") {
              return (
                <article className="phoneImageCard bareSlot" key={`${slide.position}-${slide.title}`}>
                  <div>
                    <p className="eyebrow">Slide {slide.position}</p>
                    <h2>Insert BARE screenshot</h2>
                    <p>{slide.productName}</p>
                  </div>
                </article>
              );
            }

            const image = slide.generatedImage;
            if (!image) {
              return null;
            }

            const url = `/api/jobs/${id}/files/${image}`;
            const extension = image.split(".").at(-1) ?? "png";
            return (
              <article className="phoneImageCard" key={image}>
                <img src={url} alt={`Generated ${slide.title}`} />
                <a href={url} download={`slide-${String(slide.position).padStart(2, "0")}.${extension}`}>
                  Save slide {slide.position}
                </a>
              </article>
            );
          })}
        </section>

        <section className="panel">
          <h2>Caption</h2>
          <textarea className="captionBox captionCopyField" data-caption-field readOnly rows={16} defaultValue={captions} aria-label="Caption text" />
        </section>
        <script
          dangerouslySetInnerHTML={{
            __html: captionCopyScript()
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  const root = document.querySelector('[data-review-root]');
  if (!root) return;

  const jobId = root.dataset.jobId;
  const image = root.querySelector('[data-review-image]');
  const title = root.querySelector('[data-review-title]');
  const step = root.querySelector('[data-review-step]');
  const count = root.querySelector('[data-review-count]');
  const detail = root.querySelector('[data-review-detail]');
  const loading = root.querySelector('[data-review-loading]');
  const accept = root.querySelector('[data-review-accept]');
  const reject = root.querySelector('[data-review-reject]');
  const frame = root.querySelector('[data-swipe-frame]');
  let state;
  let startX = 0;

  async function request(action) {
    loading.hidden = false;
    accept.disabled = true;
    reject.disabled = true;
    const response = await fetch('/api/jobs/' + jobId + '/review', action ? {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    } : undefined);
    state = await response.json();
    render();
  }

  function render() {
    const slot = state.slots[state.currentIndex];
    loading.hidden = true;
    accept.disabled = false;
    reject.disabled = false;

    if (state.complete || !slot) {
      title.textContent = 'Carousel approved';
      step.textContent = 'Ready to post';
      count.textContent = state.slots.length + '/' + state.slots.length;
      detail.textContent = 'Your accepted images are ready below.';
      image.removeAttribute('src');
      image.hidden = true;
      accept.disabled = true;
      reject.disabled = true;
      return;
    }

    image.hidden = false;
    image.src = '/api/jobs/' + jobId + '/files/' + slot.currentCandidate + '?v=' + Date.now();
    title.textContent = slot.productName || slot.title;
    step.textContent = slot.kind === 'storefront-hook' ? 'Hero slide' : 'Product slide';
    count.textContent = (state.currentIndex + 1) + '/' + state.slots.length;
    detail.textContent = slot.rejectCount >= 3
      ? 'Next rejection should use the polished GPT fallback.'
      : 'Swipe right to keep. Swipe left to try another option.';
  }

  accept?.addEventListener('click', () => request('accept'));
  reject?.addEventListener('click', () => request('reject'));
  frame?.addEventListener('touchstart', (event) => {
    startX = event.changedTouches[0].clientX;
  }, { passive: true });
  frame?.addEventListener('touchend', (event) => {
    const dx = event.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < 50) return;
    request(dx > 0 ? 'accept' : 'reject');
  }, { passive: true });

  request();
})();`
          }}
        />
      </main>
    );
  } catch {
    notFound();
  }
}
