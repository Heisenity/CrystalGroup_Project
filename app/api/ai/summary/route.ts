import { NextRequest, NextResponse } from "next/server";
import { summarizeTrend } from "@/lib/gemini";
import { fallbackTrendSummary } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const reviews = Array.isArray(body.reviews) ? body.reviews : [];

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        text: fallbackTrendSummary(String(body.employeeName), reviews),
        fallback: true,
      });
    }

    const text = await summarizeTrend({
      employeeName: String(body.employeeName),
      reviews,
    });

    return NextResponse.json({ text });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to summarize reviews" },
      { status: 500 },
    );
  }
}
