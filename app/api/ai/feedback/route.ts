import { NextRequest, NextResponse } from "next/server";
import { improveManagerFeedback } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = await improveManagerFeedback({
      employeeName: String(body.employeeName),
      outputQuality: Number(body.outputQuality),
      attendance: Number(body.attendance),
      teamwork: Number(body.teamwork),
      comment: String(body.comment ?? ""),
    });

    return NextResponse.json({ text });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to improve feedback" },
      { status: 500 },
    );
  }
}
