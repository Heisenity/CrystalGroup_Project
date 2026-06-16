import { Review } from "@/lib/types";

export function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function averageReviewScore(review: Review) {
  return Number(
    ((review.outputQuality + review.attendance + review.teamwork) / 3).toFixed(1),
  );
}

export function fallbackTrendSummary(employeeName: string, reviews: Review[]) {
  if (reviews.length === 0) {
    return `No reviews are available yet for ${employeeName}.`;
  }

  const latest = reviews[0];
  const latestAverage = averageReviewScore(latest);
  const previous = reviews[1];
  const previousAverage = previous ? averageReviewScore(previous) : null;
  const direction =
    previousAverage === null
      ? "This is the first recorded review."
      : latestAverage > previousAverage
        ? "Performance is trending upward."
        : latestAverage < previousAverage
          ? "Performance dipped compared with the prior month."
          : "Performance is stable compared with the prior month.";

  return `${employeeName}'s latest average score is ${latestAverage}/5 in ${latest.monthKey}. ${direction} Most recent manager feedback: "${latest.comment}"`;
}
