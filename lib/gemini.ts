import "server-only";

type GeminiPart = {
  text: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
};

type GroqResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function isGeminiFallbackStatus(status: number) {
  return status === 429 || status === 500 || status === 503;
}

function hasGroqFallback() {
  return Boolean(process.env.GROQ_API_KEY);
}

async function callGroq(prompt: string) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required environment variable: GROQ_API_KEY");
  }

  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_completion_tokens: 700,
      messages: [
        {
          role: "system",
          content:
            "You are an HR assistant for an internal performance check-in tool. Be concise, specific, supportive, and practical.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as GroqResponse;
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

async function callGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    if (hasGroqFallback()) {
      return callGroq(prompt);
    }
    throw new Error("Missing required environment variable: GEMINI_API_KEY");
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
        }),
      },
    );

    if (response.ok) {
      const data = (await response.json()) as GeminiResponse;
      const text =
        data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text)
          .filter(Boolean)
          .join("\n")
          .trim() ?? "";

      return text;
    }

    const errorText = await response.text();
    const isRetryable = isGeminiFallbackStatus(response.status);
    if (isRetryable && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
      continue;
    }

    if (isGeminiFallbackStatus(response.status) && hasGroqFallback()) {
      return callGroq(prompt);
    }

    throw new Error(`Gemini API error: ${response.status} ${errorText}`);
  }

  if (hasGroqFallback()) {
    return callGroq(prompt);
  }

  throw new Error("Gemini API error: no response received");
}

function fallbackImprovedFeedback(input: {
  employeeName: string;
  outputQuality: number;
  attendance: number;
  teamwork: number;
  comment: string;
}) {
  const strongestArea = [
    { label: "output quality", score: input.outputQuality },
    { label: "attendance", score: input.attendance },
    { label: "teamwork", score: input.teamwork },
  ].sort((a, b) => b.score - a.score)[0];

  const weakestArea = [
    { label: "output quality", score: input.outputQuality },
    { label: "attendance", score: input.attendance },
    { label: "teamwork", score: input.teamwork },
  ].sort((a, b) => a.score - b.score)[0];

  return `${input.employeeName} showed the strongest performance in ${strongestArea.label}, which matches the scores this month. ${
    input.comment.trim() || "The review indicates steady contribution across the month."
  } A clear next step is to improve ${weakestArea.label} with one measurable goal before the next check-in.`;
}

export async function improveManagerFeedback(input: {
  employeeName: string;
  outputQuality: number;
  attendance: number;
  teamwork: number;
  comment: string;
}) {
  if (!process.env.GEMINI_API_KEY) {
    return fallbackImprovedFeedback(input);
  }

  return callGemini(`You are an HR assistant for an internal performance check-in tool.

Rewrite this manager feedback so it becomes specific, balanced, and actionable in 70 to 110 words.

Employee: ${input.employeeName}
Scores:
- Output Quality: ${input.outputQuality}/5
- Attendance: ${input.attendance}/5
- Teamwork: ${input.teamwork}/5

Draft comment:
${input.comment || "No draft provided"}

Requirements:
- Align the wording with the scores
- Mention at least one strength
- Mention one clear improvement area
- Keep a professional and human tone
- Return only the rewritten feedback`);
}

export async function summarizeTrend(input: {
  employeeName: string;
  reviews: Array<{
    monthKey: string;
    outputQuality: number;
    attendance: number;
    teamwork: number;
    comment: string;
  }>;
}) {
  if (!process.env.GEMINI_API_KEY) {
    return "";
  }

  return callGemini(`You are an HR assistant for an internal performance check-in tool.

Summarize the performance trend for this employee in plain English using exactly 3 short bullets.

Employee: ${input.employeeName}
Last reviews:
${input.reviews
  .map(
    (review) =>
      `- ${review.monthKey}: Output Quality ${review.outputQuality}/5, Attendance ${review.attendance}/5, Teamwork ${review.teamwork}/5. Comment: ${review.comment}`,
  )
  .join("\n")}

Requirements:
- Call out trend direction if visible
- Mention strongest dimension
- Mention one practical next step
- Return only the bullets`);
}

export async function buildGrowthNarrative(input: {
  employeeName: string;
  reviews: Array<{
    monthKey: string;
    outputQuality: number;
    attendance: number;
    teamwork: number;
    comment: string;
  }>;
}) {
  if (!process.env.GEMINI_API_KEY) {
    return `${input.employeeName} is building a clear pattern across recent check-ins. The strongest areas are visible in the higher-scoring dimensions, while the comments point to a few specific habits that can unlock the next step forward. Overall, the story suggests steady progress with room to sharpen one or two practical behaviors before taking on broader responsibility.`;
  }

  return callGemini(`Write a concise growth narrative in one short paragraph for an employee performance profile.

Employee: ${input.employeeName}
Recent reviews:
${input.reviews
  .map(
    (review) =>
      `- ${review.monthKey}: Output Quality ${review.outputQuality}/5, Attendance ${review.attendance}/5, Teamwork ${review.teamwork}/5. Comment: ${review.comment}`,
  )
  .join("\n")}

Requirements:
- Mention strengths
- Mention growth areas
- Mention overall direction
- Mention readiness for broader responsibility carefully
- Keep it professional, calm, and human
- Return only the paragraph`);
}

export async function buildLearningRecommendations(input: {
  employeeName: string;
  focusAreas: string[];
  reviews: Array<{
    monthKey: string;
    outputQuality: number;
    attendance: number;
    teamwork: number;
    comment: string;
  }>;
}) {
  if (!process.env.GEMINI_API_KEY) {
    return [
      "Set one small weekly habit tied to the lowest-scoring area.",
      "Use a simple checklist before final handoffs.",
      "Review progress in the next monthly conversation.",
    ];
  }

  const text = await callGemini(`Create exactly 3 concise learning actions for an employee.

Employee: ${input.employeeName}
Focus areas: ${input.focusAreas.join(", ") || "General consistency"}
Recent reviews:
${input.reviews
  .map(
    (review) =>
      `- ${review.monthKey}: Output Quality ${review.outputQuality}/5, Attendance ${review.attendance}/5, Teamwork ${review.teamwork}/5. Comment: ${review.comment}`,
  )
  .join("\n")}

Requirements:
- Actions must be practical and small enough to start this week
- Avoid mentioning courses, vendors, or brands
- Return exactly 3 bullets and nothing else`);

  return text
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

export async function buildRecognitionMessage(input: {
  employeeName: string;
  reviews: Array<{
    monthKey: string;
    outputQuality: number;
    attendance: number;
    teamwork: number;
    comment: string;
  }>;
}) {
  if (!process.env.GEMINI_API_KEY) {
    return `${input.employeeName} has shown dependable performance and positive contribution recently.`;
  }

  return callGemini(`Write one short recognition message for a manager to send internally.

Employee: ${input.employeeName}
Recent reviews:
${input.reviews
  .map(
    (review) =>
      `- ${review.monthKey}: Output Quality ${review.outputQuality}/5, Attendance ${review.attendance}/5, Teamwork ${review.teamwork}/5. Comment: ${review.comment}`,
  )
  .join("\n")}

Requirements:
- 1 to 2 sentences
- Warm but professional
- Mention a specific strength
- Do not use hashtags or emojis
- Return only the message`);
}
