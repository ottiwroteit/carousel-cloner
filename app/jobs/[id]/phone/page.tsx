import Link from "next/link";
import { notFound } from "next/navigation";
import { readJob, readJobTextArtifact } from "@/lib/jobs/store";
import type { GeneratedPackage } from "@/lib/types";

type PhonePageProps = {
  params: Promise<{ id: string }>;
};

export default async function PhonePage({ params }: PhonePageProps) {
  const { id } = await params;

  try {
    const job = await readJob(id);
    const captions = await readJobTextArtifact(id, "captions.txt");
    const pkg = job.artifacts["package.json"] as GeneratedPackage;
    const images = pkg.generatedImages ?? [];

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

        <section className="panel phoneActions">
          <button type="button" data-copy-caption={captions} className="copyCaptionButton">
            Copy caption
          </button>
          <Link href={`/api/jobs/${id}/images`}>Download all images</Link>
        </section>

        <section className="phoneImageStack">
          {images.map((image, index) => {
            const url = `/api/jobs/${id}/files/${image}`;
            const extension = image.split(".").at(-1) ?? "png";
            return (
              <article className="phoneImageCard" key={image}>
                <img src={url} alt={`Generated carousel slide ${index + 1}`} />
                <a href={url} download={`slide-${String(index + 1).padStart(2, "0")}.${extension}`}>
                  Save image {index + 1}
                </a>
              </article>
            );
          })}
        </section>

        <section className="panel">
          <h2>Caption</h2>
          <pre className="captionBox">{captions}</pre>
        </section>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.querySelector('[data-copy-caption]')?.addEventListener('click', async (event) => {
  const button = event.currentTarget;
  await navigator.clipboard.writeText(button.dataset.copyCaption || '');
  button.textContent = 'Copied';
});`
          }}
        />
      </main>
    );
  } catch {
    notFound();
  }
}
