import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { readJob, readJobTextArtifact } from "@/lib/jobs/store";
import { getPhoneBaseUrl } from "@/lib/network";
import { captionCopyScript } from "@/lib/phone/caption-copy";
import { getInitialReviewPreview, reviewClientScript } from "@/lib/phone/review-preview";
import { getOrCreateReviewState } from "@/lib/review/state";
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
    const review = getInitialReviewPreview(await getOrCreateReviewState(id));
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
                {review.step}
              </p>
              <h2 data-review-title>{review.title}</h2>
            </div>
            <span data-review-count>{review.count}</span>
          </div>
          <div className="swipeFrame" data-swipe-frame>
            <img
              data-review-image
              src={review.image ? `/api/jobs/${id}/files/${review.image}` : undefined}
              hidden={review.complete}
              alt="Current carousel candidate"
            />
            <div className="swipeLoading" data-review-loading hidden>
              Generating next option...
            </div>
          </div>
          <p className="mutedText" data-review-detail>
            {review.detail}
          </p>
          <div className="swipeButtons">
            <button type="button" data-review-reject disabled={review.complete}>
              Try another
            </button>
            <button type="button" data-review-accept disabled={review.complete}>
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
            __html: reviewClientScript()
          }}
        />
      </main>
    );
  } catch {
    notFound();
  }
}
