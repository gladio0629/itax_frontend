import { api } from "@/api/client";

/**
 * Wait for the server's verdict on an action sent for review (sign-in,
 * card link…). Sample data resolves in a few seconds; a real backend
 * usually answers "approved" right away. "cancelled" when the screen left.
 */
export async function waitForReview(reviewId: string, signal: { cancelled: boolean }): Promise<"approved" | "rejected" | "cancelled"> {
  for (;;) {
    if (signal.cancelled) return "cancelled";
    try {
      const res = await api.getReviewStatus(reviewId);
      if (res.status !== "pending") return res.status;
    } catch {
      /* transient: poll again */
    }
    await new Promise((r) => setTimeout(r, 600));
  }
}
