import { api } from "@/api/client";
import type { ReviewRequest } from "@/api/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls a review until the adapter decides it (approved or rejected). */
export async function waitReview(review: ReviewRequest): Promise<ReviewRequest> {
  let last = review;
  for (let i = 0; i < 40 && last.status === "pending"; i++) {
    await sleep(300);
    last = (await api.getReviewStatus(review.id).catch(() => null)) ?? last;
  }
  return last;
}
