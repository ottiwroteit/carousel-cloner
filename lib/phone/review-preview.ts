import type { ReviewState } from "@/lib/review/state";

export type InitialReviewPreview = {
  title: string;
  step: string;
  count: string;
  image?: string;
  detail: string;
  complete: boolean;
};

export function getInitialReviewPreview(state: ReviewState): InitialReviewPreview {
  const slot = state.slots[state.currentIndex];
  const total = state.slots.length;

  if (state.complete || !slot) {
    return {
      title: "Carousel approved",
      step: "Ready to post",
      count: `${total}/${total}`,
      detail: "Your accepted images are ready below.",
      complete: true
    };
  }

  return {
    title: slot.productName ?? slot.title,
    step: slot.kind === "storefront-hook" ? "Hero slide" : "Product slide",
    count: `${state.currentIndex + 1}/${total}`,
    image: slot.currentCandidate,
    detail: slot.rejectCount >= 3 ? "Next rejection should use the polished GPT fallback." : "Swipe right to keep. Swipe left to try another option.",
    complete: false
  };
}

export function reviewClientScript(): string {
  return `(() => {
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
  const editButtons = document.querySelectorAll('[data-review-edit]');
  let state;
  let startX = 0;

  async function request(action, payload = {}) {
    loading.hidden = false;
    accept.disabled = true;
    reject.disabled = true;
    try {
      const response = await fetch('/api/jobs/' + jobId + '/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      });
      if (!response.ok) throw new Error('Review request failed');
      state = await response.json();
      render();
    } catch {
      loading.hidden = true;
      title.textContent = 'Review did not load';
      step.textContent = 'Refresh needed';
      detail.textContent = 'Refresh this page and try again.';
      accept.disabled = true;
      reject.disabled = true;
    }
  }

  function render() {
    if (!state?.slots) {
      throw new Error('Review state missing slots');
    }
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
    image.src = '/api/jobs/' + jobId + '/files/' + slot.currentCandidate;
    title.textContent = slot.productName || slot.title;
    step.textContent = slot.kind === 'storefront-hook' ? 'Hero slide' : 'Product slide';
    count.textContent = (state.currentIndex + 1) + '/' + state.slots.length;
    detail.textContent = slot.rejectCount >= 3
      ? 'Next rejection should use the polished GPT fallback.'
      : 'Swipe right to keep. Swipe left to try another option.';
  }

  accept?.addEventListener('click', () => request('accept'));
  reject?.addEventListener('click', () => request('reject'));
  editButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const position = Number(button.dataset.reviewEdit);
      if (!Number.isFinite(position)) return;
      request('edit', { position });
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  frame?.addEventListener('touchstart', (event) => {
    startX = event.changedTouches[0].clientX;
  }, { passive: true });
  frame?.addEventListener('touchend', (event) => {
    const dx = event.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < 50) return;
    request(dx > 0 ? 'accept' : 'reject');
  }, { passive: true });
})();`;
}
