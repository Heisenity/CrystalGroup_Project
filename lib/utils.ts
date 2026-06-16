import { Review } from "@/lib/types";

const IST_TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

function getISTParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

export function formatISTTimestamp(date = new Date()) {
  const { year, month, day, hour, minute, second } = getISTParts(date);
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${milliseconds}${IST_OFFSET}`;
}

export function getMonthKey(date = new Date()) {
  const { year, month } = getISTParts(date);
  return `${year}-${month}`;
}

export function averageReviewScore(review: Review) {
  return Number(
    ((review.outputQuality + review.attendance + review.teamwork) / 3).toFixed(1),
  );
}

export function getTimestampValue(timestamp: string) {
  const parsed = new Date(timestamp).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function fallbackTrendSummary(employeeName: string, reviews: Review[]) {
  if (reviews.length === 0) {
    return `No reviews are available yet for ${employeeName}.`;
  }

  const latest = reviews[0];
  const latestAverage = averageReviewScore(latest);
  const previous = reviews.find((review) => review.monthKey !== latest.monthKey);
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
