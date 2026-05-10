export type JobState =
  | "queued"
  | "extracting"
  | "analyzing"
  | "generating_copy"
  | "generating_images"
  | "ready"
  | "failed";

export type StyleProfile = {
  accountName: string;
  targetAudience: string;
  topics: string[];
  tone: string;
  captionRules: string;
  imageStyle: string;
  bannedElements: string[];
  ctaStyle: string;
};

export type GeneratedPackage = {
  title: string;
  mainCaption: string;
  alternateHooks: string[];
  hashtags: string[];
  slideText: string[];
  postingNotes: string[];
  imagePrompts?: string[];
  generatedImages?: string[];
  carouselSlides?: CarouselSlidePlan[];
};

export type CarouselSlidePlan = {
  position: number;
  kind: "storefront-hook" | "product-photo" | "bare-screenshot";
  title: string;
  storeName?: string;
  productName?: string;
  barcode?: string;
  bareImageUrl?: string;
  bareScore?: number | null;
  bareLabel?: string;
  prompt?: string;
  generatedImage?: string;
};

export type JobStatus = {
  id: string;
  state: JobState;
  progress: number;
  message: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type JobInput = {
  url: string;
  profile: StyleProfile;
};

export type SourceArtifact = {
  images: string[];
  metadata: Record<string, unknown>;
  warning?: string;
};

export type SourceAnalysis = {
  summary: string;
  hook: string;
  pacing: string;
  visualPattern: string;
  captionStrategy: string;
  whyItWorks: string;
};
