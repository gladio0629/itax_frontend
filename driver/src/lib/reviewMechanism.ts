import { saveReviewRequest, getReviewRequest, type ReviewKind, type ReviewRequest } from "@/mockDb/db";

export const DEMO_REVIEW_DELAY_MS: [number, number] = [2000, 4000];

function genId() {
  return `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function submitForReview(kind: ReviewKind, payload?: Record<string, unknown>): ReviewRequest {
  const now = Date.now();
  const [min, max] = DEMO_REVIEW_DELAY_MS;
  const delay = min + Math.random() * (max - min);
  const req: ReviewRequest = {
    id: genId(),
    kind,
    status: "pending",
    createdAt: now,
    resolvesAt: now + delay,
    payload,
  };
  saveReviewRequest(req);
  return req;
}

export function pollReview(id: string): ReviewRequest {
  const req = getReviewRequest(id);
  if (!req) throw new Error("Tekshiruv so'rovi topilmadi");
  if (req.status === "pending" && Date.now() >= req.resolvesAt) {
    req.status = "approved";
    saveReviewRequest(req);
  }
  return req;
}
