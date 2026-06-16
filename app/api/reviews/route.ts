import { NextRequest, NextResponse } from "next/server";
import { appendReview, getReviews } from "@/lib/sheets";

export async function GET(request: NextRequest) {
  try {
    const employeeEmail = request.nextUrl.searchParams.get("employeeEmail") ?? undefined;
    const reviews = await getReviews(employeeEmail);
    return NextResponse.json({ reviews });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load reviews" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const outputQuality = Number(body.outputQuality);
    const attendance = Number(body.attendance);
    const teamwork = Number(body.teamwork);

    if (
      !body.employeeEmail ||
      !body.employeeName ||
      !body.managerEmail ||
      !body.comment
    ) {
      return NextResponse.json({ error: "Missing required review fields" }, { status: 400 });
    }

    if ([outputQuality, attendance, teamwork].some((score) => Number.isNaN(score) || score < 1 || score > 5)) {
      return NextResponse.json(
        { error: "Scores must be numbers between 1 and 5" },
        { status: 400 },
      );
    }

    await appendReview({
      employeeEmail: body.employeeEmail,
      employeeName: body.employeeName,
      managerEmail: body.managerEmail,
      outputQuality,
      attendance,
      teamwork,
      comment: String(body.comment),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save review" },
      { status: 500 },
    );
  }
}
