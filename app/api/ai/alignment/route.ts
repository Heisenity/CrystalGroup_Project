import { NextRequest, NextResponse } from "next/server";
import { scoreCommentAlignment } from "@/lib/intelligence";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const outputQuality = Number(body.outputQuality);
    const attendance = Number(body.attendance);
    const teamwork = Number(body.teamwork);
    const comment = String(body.comment ?? "");

    const alignment = scoreCommentAlignment({
      outputQuality,
      attendance,
      teamwork,
      comment,
    });

    return NextResponse.json(alignment);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to check alignment" },
      { status: 500 },
    );
  }
}
