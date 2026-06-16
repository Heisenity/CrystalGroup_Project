import { NextRequest, NextResponse } from "next/server";
import {
  buildGrowthNarrative,
  buildLearningRecommendations,
  buildRecognitionMessage,
  summarizeTrend,
} from "@/lib/gemini";
import { buildEmployeeInsight } from "@/lib/intelligence";
import { getReviews } from "@/lib/sheets";
import { fallbackTrendSummary } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const employeeEmail = request.nextUrl.searchParams.get("employeeEmail");
    const employeeName = request.nextUrl.searchParams.get("employeeName") ?? "This employee";

    if (!employeeEmail) {
      return NextResponse.json({ error: "employeeEmail is required" }, { status: 400 });
    }

    const reviews = await getReviews(employeeEmail);
    const insight = buildEmployeeInsight(reviews);

    const recentReviews = reviews.slice(0, 6).map((review) => ({
      monthKey: review.monthKey,
      outputQuality: review.outputQuality,
      attendance: review.attendance,
      teamwork: review.teamwork,
      comment: review.comment,
    }));

    const [trendSummary, growthStory, learningActions, recognitionMessage] = await Promise.all([
      recentReviews.length > 0
        ? summarizeTrend({
            employeeName,
            reviews: recentReviews.slice(0, 3),
          }).catch(() => fallbackTrendSummary(employeeName, reviews))
        : Promise.resolve(`No reviews are available yet for ${employeeName}.`),
      buildGrowthNarrative({
        employeeName,
        reviews: recentReviews,
      }),
      buildLearningRecommendations({
        employeeName,
        focusAreas: insight.focusAreas,
        reviews: recentReviews,
      }),
      buildRecognitionMessage({
        employeeName,
        reviews: recentReviews.slice(0, 3),
      }),
    ]);

    return NextResponse.json({
      insight,
      trendSummary,
      growthStory,
      learningActions,
      recognitionMessage,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load employee insights" },
      { status: 500 },
    );
  }
}
