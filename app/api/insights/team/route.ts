import { NextResponse } from "next/server";
import { buildRecognitionMessage } from "@/lib/gemini";
import { buildTeamSignals, groupReviewsByEmployee } from "@/lib/intelligence";
import { getReviews } from "@/lib/sheets";

export async function GET() {
  try {
    const reviews = await getReviews();
    const teamSignals = buildTeamSignals(reviews);
    const grouped = groupReviewsByEmployee(reviews);

    const recognition = await Promise.all(
      grouped
        .slice(0, 3)
        .map(async (entry) => ({
          employeeName: entry.employeeName,
          message: await buildRecognitionMessage({
            employeeName: entry.employeeName,
            reviews: entry.reviews.slice(0, 3),
          }),
        })),
    );

    return NextResponse.json({
      ...teamSignals,
      recognition,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load team insights" },
      { status: 500 },
    );
  }
}
