import { employeeUsers } from "@/lib/users";
import { Review } from "@/lib/types";
import { averageReviewScore, getMonthKey } from "@/lib/utils";

const POSITIVE_WORDS = [
  "strong",
  "great",
  "excellent",
  "reliable",
  "consistent",
  "supportive",
  "helpful",
  "improved",
  "clear",
  "ownership",
  "collaborative",
  "steady",
];

const NEGATIVE_WORDS = [
  "late",
  "missed",
  "inconsistent",
  "weak",
  "issue",
  "concern",
  "drop",
  "stress",
  "overwhelmed",
  "burnout",
  "confused",
  "poor",
  "delay",
  "struggle",
];

const SKILL_SIGNALS = [
  { label: "Detail accuracy", patterns: ["detail", "accuracy", "proof", "quality check", "error"] },
  { label: "Communication", patterns: ["communicat", "clarity", "update", "explain", "stakeholder"] },
  { label: "Ownership", patterns: ["ownership", "initiative", "follow through", "accountable"] },
  { label: "Planning", patterns: ["planning", "priorit", "deadline", "time", "organis"] },
  { label: "Collaboration", patterns: ["team", "collabor", "support", "partner", "handoff"] },
  { label: "Reliability", patterns: ["attendance", "reliable", "consistent", "follow up"] },
  { label: "Leadership", patterns: ["lead", "mentor", "guide", "decision"] },
];

export type TeamSignalCard = {
  title: string;
  summary: string;
  tone: "good" | "watch" | "alert";
  value: string;
  detail?: string;
  points?: Array<{
    label: string;
    detail: string;
  }>;
};

export type EmployeeInsight = {
  trend: Array<{ monthKey: string; average: number }>;
  latestAverage: number | null;
  growthDirection: "rising" | "steady" | "softening";
  focusAreas: string[];
  strengths: string[];
  alignment: {
    status: "aligned" | "watch" | "mismatch";
    summary: string;
  };
  workloadSignal: {
    label: "balanced" | "heavy" | "light";
    summary: string;
  };
  wellbeingSignal: {
    label: "steady" | "watch" | "urgent";
    summary: string;
  };
};

type EmployeeSeries = {
  employeeEmail: string;
  employeeName: string;
  reviews: Review[];
};

export function groupReviewsByEmployee(reviews: Review[]): EmployeeSeries[] {
  const map = new Map<string, Review[]>();

  for (const review of reviews) {
    const current = map.get(review.employeeEmail) ?? [];
    current.push(review);
    map.set(review.employeeEmail, current);
  }

  return Array.from(map.entries()).map(([employeeEmail, groupedReviews]) => ({
    employeeEmail,
    employeeName: groupedReviews[0]?.employeeName ?? employeeEmail,
    reviews: groupedReviews.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
  }));
}

export function scoreCommentAlignment(review: Pick<Review, "outputQuality" | "attendance" | "teamwork" | "comment">) {
  const text = review.comment.toLowerCase();
  const positives = POSITIVE_WORDS.filter((word) => text.includes(word)).length;
  const negatives = NEGATIVE_WORDS.filter((word) => text.includes(word)).length;
  const average = (review.outputQuality + review.attendance + review.teamwork) / 3;

  if (average >= 4.2 && negatives > positives + 1) {
    return {
      status: "mismatch" as const,
      summary: "The scores feel stronger than the wording. Consider balancing the comment with clearer strengths.",
    };
  }

  if (average <= 2.6 && positives > negatives + 1) {
    return {
      status: "mismatch" as const,
      summary: "The wording sounds more positive than the scores suggest. Add one clear improvement point.",
    };
  }

  if (Math.abs(positives - negatives) <= 1) {
    return {
      status: "watch" as const,
      summary: "The comment is broadly aligned, but it could be more explicit about priorities.",
    };
  }

  return {
    status: "aligned" as const,
    summary: "The scores and wording are pulling in the same direction.",
  };
}

function scoreSentiment(comment: string) {
  const text = comment.toLowerCase();
  const positives = POSITIVE_WORDS.filter((word) => text.includes(word)).length;
  const negatives = NEGATIVE_WORDS.filter((word) => text.includes(word)).length;
  return positives - negatives;
}

function deriveSkillMap(reviews: Review[]) {
  const matches = new Map<string, number>();
  const combinedText = reviews.map((review) => review.comment.toLowerCase()).join(" ");

  for (const signal of SKILL_SIGNALS) {
    const hitCount = signal.patterns.reduce(
      (total, pattern) => total + (combinedText.includes(pattern) ? 1 : 0),
      0,
    );
    if (hitCount > 0) {
      matches.set(signal.label, hitCount);
    }
  }

  return Array.from(matches.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label);
}

function deriveFocusAreas(reviews: Review[]) {
  const latest = reviews[0];
  if (!latest) {
    return [];
  }

  const ordered = [
    { label: "Output quality", score: latest.outputQuality },
    { label: "Attendance rhythm", score: latest.attendance },
    { label: "Team collaboration", score: latest.teamwork },
  ].sort((a, b) => a.score - b.score);

  const keywordSkills = deriveSkillMap(reviews).slice(0, 2);
  return Array.from(new Set([ordered[0]?.label, ordered[1]?.label, ...keywordSkills].filter(Boolean)));
}

function deriveStrengths(reviews: Review[]) {
  const latest = reviews[0];
  if (!latest) {
    return [];
  }

  const ordered = [
    { label: "Output quality", score: latest.outputQuality },
    { label: "Attendance rhythm", score: latest.attendance },
    { label: "Team collaboration", score: latest.teamwork },
  ].sort((a, b) => b.score - a.score);

  return ordered
    .filter((entry) => entry.score >= 4)
    .slice(0, 2)
    .map((entry) => entry.label);
}

function deriveWorkloadSignal(reviews: Review[]) {
  const latest = reviews[0];
  if (!latest) {
    return {
      label: "balanced" as const,
      summary: "Not enough history yet to read workload pressure.",
    };
  }

  const average = averageReviewScore(latest);
  const text = latest.comment.toLowerCase();
  const pressureWords = ["overwhelm", "stretch", "load", "pressure", "late", "rush"];
  const pressure = pressureWords.some((word) => text.includes(word));

  if (latest.outputQuality >= 4 && (latest.teamwork <= 3 || latest.attendance <= 3 || pressure)) {
    return {
      label: "heavy" as const,
      summary: "Recent patterns suggest this person may be carrying a heavier load than the scores alone show.",
    };
  }

  if (average <= 2.8 && latest.attendance >= 4 && latest.teamwork >= 4) {
    return {
      label: "light" as const,
      summary: "There may be room to stretch responsibilities without creating friction.",
    };
  }

  return {
    label: "balanced" as const,
    summary: "The recent pattern looks broadly sustainable.",
  };
}

function deriveWellbeingSignal(reviews: Review[]) {
  const latest = reviews[0];
  const previous = reviews[1];
  if (!latest) {
    return {
      label: "steady" as const,
      summary: "Not enough history yet to read wellbeing changes.",
    };
  }

  const sentiment = scoreSentiment(latest.comment);
  const drop =
    previous &&
    (latest.attendance < previous.attendance || latest.teamwork < previous.teamwork || averageReviewScore(latest) + 0.6 < averageReviewScore(previous));

  if (drop && sentiment < 0) {
    return {
      label: "urgent" as const,
      summary: "Recent scores and wording suggest this person may need a check-in and support soon.",
    };
  }

  if (drop || sentiment < 0) {
    return {
      label: "watch" as const,
      summary: "There are early signs of pressure or friction worth discussing in the next conversation.",
    };
  }

  return {
    label: "steady" as const,
    summary: "The recent pattern looks emotionally steady.",
  };
}

export function buildEmployeeInsight(reviews: Review[]): EmployeeInsight {
  const recent = reviews.slice(0, 6);
  const trend = recent
    .slice()
    .reverse()
    .map((review) => ({
      monthKey: review.monthKey,
      average: averageReviewScore(review),
    }));

  const latestAverage = recent[0] ? averageReviewScore(recent[0]) : null;
  const previousAverage = recent[1] ? averageReviewScore(recent[1]) : latestAverage;
  const growthDirection =
    latestAverage === null || previousAverage === null
      ? "steady"
      : latestAverage > previousAverage
        ? "rising"
        : latestAverage < previousAverage
          ? "softening"
          : "steady";

  return {
    trend,
    latestAverage,
    growthDirection,
    focusAreas: deriveFocusAreas(recent),
    strengths: deriveStrengths(recent),
    alignment: recent[0]
      ? scoreCommentAlignment(recent[0])
      : { status: "watch", summary: "No review has been written yet." },
    workloadSignal: deriveWorkloadSignal(recent),
    wellbeingSignal: deriveWellbeingSignal(recent),
  };
}

function classifyTeamPulse(reviews: Review[]) {
  if (reviews.length === 0) {
    return {
      value: "No pattern yet",
      summary: "Once reviews build up, this area will show whether the team mood is steady or drifting.",
      tone: "watch" as const,
    };
  }

  const recent = reviews.slice(0, Math.min(reviews.length, 12));
  const sentiment = recent.reduce((sum, review) => sum + scoreSentiment(review.comment), 0);

  if (sentiment >= 6) {
    return {
      value: "Steady",
      summary: "Recent language is mostly constructive and positive, which suggests the team mood is holding up well.",
      tone: "good" as const,
    };
  }

  if (sentiment <= -2) {
    return {
      value: "Dipping",
      summary: "Recent wording carries more pressure and concerns, which may point to morale softening.",
      tone: "alert" as const,
    };
  }

  return {
    value: "Mixed",
    summary: "Recent comments show a mix of progress and pressure. This is a good moment for focused follow-ups.",
    tone: "watch" as const,
  };
}

export function buildTeamSignals(reviews: Review[]) {
  const grouped = groupReviewsByEmployee(reviews);
  const currentMonth = getMonthKey();
  const reviewedThisMonth = new Set(
    reviews.filter((review) => review.monthKey === currentMonth).map((review) => review.employeeEmail),
  );
  const pendingEmployees = employeeUsers.filter((employee) => !reviewedThisMonth.has(employee.email));

  const workloadPoints = grouped
    .map((entry) => {
      const insight = buildEmployeeInsight(entry.reviews);
      return {
        name: entry.employeeName,
        signal: insight.workloadSignal,
        average: insight.latestAverage ?? 0,
      };
    })
    .sort((a, b) => b.average - a.average);

  const heavyLoad = workloadPoints.filter((entry) => entry.signal.label === "heavy").slice(0, 3);
  const lightLoad = workloadPoints.filter((entry) => entry.signal.label === "light").slice(0, 3);

  const burnoutWatch = grouped
    .map((entry) => ({
      name: entry.employeeName,
      signal: buildEmployeeInsight(entry.reviews).wellbeingSignal,
    }))
    .filter((entry) => entry.signal.label !== "steady")
    .slice(0, 4);

  const recognitionPool = grouped
    .map((entry) => ({
      name: entry.employeeName,
      latest: entry.reviews[0],
      average: entry.reviews[0] ? averageReviewScore(entry.reviews[0]) : 0,
      trend: buildEmployeeInsight(entry.reviews).growthDirection,
    }))
    .filter((entry) => entry.latest)
    .sort((a, b) => b.average - a.average)
    .slice(0, 3);

  const consistencyWatch = grouped
    .map((entry) => ({
      name: entry.employeeName,
      alignment: entry.reviews[0] ? scoreCommentAlignment(entry.reviews[0]) : null,
    }))
    .filter((entry) => entry.alignment && entry.alignment.status !== "aligned")
    .slice(0, 3);

  const skillCounts = new Map<string, number>();
  for (const entry of grouped) {
    for (const skill of deriveFocusAreas(entry.reviews)) {
      skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
    }
  }

  const commonSkillThemes = Array.from(skillCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const completionSignal: TeamSignalCard = {
    title: "Check-in watchlist",
    value: `${pendingEmployees.length} pending`,
    tone: pendingEmployees.length > 8 ? "alert" : pendingEmployees.length > 0 ? "watch" : "good",
    summary:
      pendingEmployees.length === 0
        ? "Everyone has a current check-in on file."
        : "These team members are the most likely to be missed if the month closes without follow-up.",
    points: pendingEmployees.slice(0, 5).map((employee) => ({
      label: employee.name,
      detail: "No review logged for the current month.",
    })),
  };

  return {
    metrics: {
      reviewedThisMonth: reviewedThisMonth.size,
      pendingThisMonth: pendingEmployees.length,
      teamAverage:
        reviews.length > 0
          ? Number(
              (
                reviews.reduce((sum, review) => sum + averageReviewScore(review), 0) / reviews.length
              ).toFixed(1),
            )
          : 0,
      moraleValue: classifyTeamPulse(reviews).value,
    },
    cards: [
      {
        title: "Load balance",
        value:
          heavyLoad.length > 0
            ? `${heavyLoad.length} carrying more`
            : lightLoad.length > 0
              ? `${lightLoad.length} ready for more`
              : "Stable spread",
        tone: heavyLoad.length > 0 ? "watch" : "good",
        summary:
          heavyLoad.length > 0
            ? "A few people are showing strong output with signs of pressure around them."
            : "Work patterns look broadly even across the current review history.",
        points: (heavyLoad.length > 0 ? heavyLoad : lightLoad).map((entry) => ({
          label: entry.name,
          detail: entry.signal.summary,
        })),
      } satisfies TeamSignalCard,
      {
        title: "Wellbeing watch",
        value: burnoutWatch.length > 0 ? `${burnoutWatch.length} to check on` : "Steady",
        tone: burnoutWatch.length > 1 ? "alert" : burnoutWatch.length === 1 ? "watch" : "good",
        summary:
          burnoutWatch.length > 0
            ? "Recent score changes suggest a few people may need support before pressure compounds."
            : "No strong pressure pattern is visible in the recent review history.",
        points: burnoutWatch.map((entry) => ({
          label: entry.name,
          detail: entry.signal.summary,
        })),
      } satisfies TeamSignalCard,
      completionSignal,
      {
        title: "Team pulse",
        value: classifyTeamPulse(reviews).value,
        tone: classifyTeamPulse(reviews).tone,
        summary: classifyTeamPulse(reviews).summary,
        points: commonSkillThemes.map(([label, count]) => ({
          label,
          detail: `${count} people are showing this as a recurring development theme.`,
        })),
      } satisfies TeamSignalCard,
      {
        title: "Recognition notes",
        value: recognitionPool.length > 0 ? `${recognitionPool.length} standout moments` : "No highlights yet",
        tone: "good",
        summary: "These people have the clearest momentum based on recent reviews.",
        points: recognitionPool.map((entry) => ({
          label: entry.name,
          detail:
            entry.trend === "rising"
              ? "Performance is lifting while staying reliable."
              : "Recent reviews show consistently strong delivery.",
        })),
      } satisfies TeamSignalCard,
      {
        title: "Score alignment",
        value:
          consistencyWatch.length > 0
            ? `${consistencyWatch.length} comments worth revisiting`
            : "Aligned",
        tone: consistencyWatch.length > 0 ? "watch" : "good",
        summary:
          consistencyWatch.length > 0
            ? "A few reviews may read harsher or softer than the scores themselves suggest."
            : "Recent comments appear consistent with their scores.",
        points: consistencyWatch.map((entry) => ({
          label: entry.name,
          detail: entry.alignment?.summary ?? "",
        })),
      } satisfies TeamSignalCard,
    ],
  };
}
