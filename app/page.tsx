"use client";

import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  allUsers,
  authenticateUser,
  employeeUsers,
  managerUser,
  sanitizeUser,
  type PublicUser,
} from "@/lib/users";
import type { Review } from "@/lib/types";
import { averageReviewScore, getMonthKey } from "@/lib/utils";
import type { EmployeeInsight, TeamSignalCard } from "@/lib/intelligence";

type ManagerFormState = {
  employeeEmail: string;
  outputQuality: number;
  attendance: number;
  teamwork: number;
  comment: string;
};

type LoginFormState = {
  email: string;
  password: string;
};

type TeamInsightsResponse = {
  metrics: {
    reviewedThisMonth: number;
    pendingThisMonth: number;
    teamAverage: number;
    moraleValue: string;
  };
  cards: TeamSignalCard[];
  recognition: Array<{
    employeeName: string;
    message: string;
  }>;
};

type EmployeeInsightsResponse = {
  insight: EmployeeInsight;
  trendSummary: string;
  growthStory: string;
  learningActions: string[];
  recognitionMessage: string;
};

type AlignmentResponse = {
  status: "aligned" | "watch" | "mismatch";
  summary: string;
};

type DetailModalState =
  | {
      title: string;
      text?: string;
      items?: string[];
    }
  | null;

type CoverageModalState = {
  reviewed: string[];
  pending: string[];
} | null;

const sessionKey = "crystal-group-user";

const initialManagerForm: ManagerFormState = {
  employeeEmail: employeeUsers[0].email,
  outputQuality: 3,
  attendance: 3,
  teamwork: 3,
  comment: "",
};

const safeManager = sanitizeUser(managerUser);
const safeEmployees = employeeUsers.map(sanitizeUser);
const safeUsers = allUsers.map(sanitizeUser);

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function formatMonthShort(monthKey: string) {
  const [year, month] = monthKey.split("-");
  if (!year || !month) {
    return monthKey;
  }

  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString("en-US", { month: "short" });
}

function formatReviewDate(timestamp: string) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatLabel(value: string) {
  return value
    .split(/[\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDirection(direction?: EmployeeInsight["growthDirection"]) {
  if (direction === "rising") {
    return "Improving";
  }

  if (direction === "softening") {
    return "Needs attention";
  }

  return "Steady";
}

function getStrongestSignal(insight?: EmployeeInsight | null) {
  return insight?.strengths[0] ?? insight?.focusAreas[0] ?? "Building pattern";
}

function aggregateTrendPoints(points: Array<{ monthKey: string; average: number }>) {
  const grouped = new Map<string, { total: number; count: number }>();

  for (const point of points) {
    const current = grouped.get(point.monthKey) ?? { total: 0, count: 0 };
    current.total += point.average;
    current.count += 1;
    grouped.set(point.monthKey, current);
  }

  return Array.from(grouped.entries()).map(([monthKey, value]) => ({
    monthKey,
    average: Number((value.total / value.count).toFixed(1)),
  }));
}

function getSignalCardHelpText(title: string) {
  if (title === "Load balance") {
    return "Explains whether work seems spread evenly across the team or whether a few people may be carrying too much.";
  }

  if (title === "Wellbeing watch") {
    return "Highlights whether recent reviews suggest pressure, stress, or the need for an extra check-in.";
  }

  if (title === "Check-in watchlist") {
    return "Shows who still needs a review so the month does not close with missing check-ins.";
  }

  if (title === "Team pulse") {
    return "Gives a simple read on overall team mood based on the tone of recent written feedback.";
  }

  if (title === "Recognition notes") {
    return "Points to employees with standout recent performance so managers can recognise good work quickly.";
  }

  return "Checks whether written feedback sounds in step with the scores that were given.";
}

function extractLeadingCount(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const text = await response.text();
  let data: unknown = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const trimmed = text.trim().toLowerCase();
      if (trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")) {
        throw new Error("The app received a page instead of data. Please refresh or restart the app.");
      }

      throw new Error(fallbackMessage);
    }
  }

  if (!response.ok) {
    const error =
      typeof data === "object" && data && "error" in data && typeof data.error === "string"
        ? data.error
        : fallbackMessage;
    throw new Error(error);
  }

  return data as T;
}

export default function HomePage() {
  const [activeUser, setActiveUser] = useState<PublicUser | null>(null);
  const [preferredDemo, setPreferredDemo] = useState<"manager" | "employee" | null>(null);
  const shellRef = useRef<HTMLElement | null>(null);
  const loginSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(sessionKey);
    if (!saved) {
      return;
    }

    const user = safeUsers.find((entry) => entry.id === saved);
    if (user) {
      setActiveUser(user);
    }
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.to(".orb-one", {
        y: 24,
        x: 18,
        rotate: 8,
        duration: 7,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
      gsap.to(".orb-two", {
        y: -22,
        x: -20,
        rotate: -10,
        duration: 9,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });

      gsap.utils.toArray<HTMLElement>(".reveal-block").forEach((element) => {
        gsap.fromTo(
          element,
          { opacity: 0, y: 48 },
          {
            opacity: 1,
            y: 0,
            duration: 0.95,
            ease: "power3.out",
            scrollTrigger: {
              trigger: element,
              start: "top 88%",
            },
          },
        );
      });
    }, shellRef);

    return () => ctx.revert();
  }, []);

  function loginAs(user: PublicUser) {
    window.localStorage.setItem(sessionKey, user.id);
    setActiveUser(user);
  }

  function logout() {
    window.localStorage.removeItem(sessionKey);
    setActiveUser(null);
  }

  function jumpToDemo(role: "manager" | "employee") {
    setPreferredDemo(role);
    loginSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="workspace-shell" ref={shellRef}>
      <Atmosphere />

      {!activeUser || activeUser.role === "manager" ? <HeroSection onOpenDemo={jumpToDemo} /> : null}

      <AnimatePresence mode="wait">
        {!activeUser ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.35 }}
            ref={loginSectionRef}
          >
            <LoginView onLogin={loginAs} preferredDemo={preferredDemo} />
          </motion.div>
        ) : activeUser.role === "manager" ? (
          <motion.div
            key="manager"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.35 }}
          >
            <ManagerDashboard user={activeUser} onLogout={logout} />
          </motion.div>
        ) : (
          <motion.div
            key="employee"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.35 }}
          >
            <EmployeeDashboard user={activeUser} onLogout={logout} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function HeroSection({
  onOpenDemo,
}: {
  onOpenDemo: (role: "manager" | "employee") => void;
}) {
  const [teamInsights, setTeamInsights] = useState<TeamInsightsResponse | null>(null);
  const [featuredEmployeeName, setFeaturedEmployeeName] = useState(
    safeEmployees[0]?.name ?? "Selected employee",
  );
  const [featuredInsight, setFeaturedInsight] = useState<EmployeeInsightsResponse | null>(null);
  const [featuredReviews, setFeaturedReviews] = useState<Review[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadHeroData() {
      try {
        const [teamResponse, reviewsResponse] = await Promise.all([
          fetch("/api/insights/team"),
          fetch("/api/reviews"),
        ]);

        const [teamData, reviewsData] = await Promise.all([
          readJsonResponse<TeamInsightsResponse>(teamResponse, "Could not load review progress"),
          readJsonResponse<{ reviews: Review[] }>(reviewsResponse, "Could not load review history"),
        ]);

        const allReviews = [...((reviewsData.reviews as Review[]) ?? [])].sort((a, b) =>
          b.timestamp.localeCompare(a.timestamp),
        );
        const latestReview = allReviews[0];
        const featuredEmail = latestReview?.employeeEmail ?? safeEmployees[0]?.email;
        const featuredName =
          latestReview?.employeeName ?? safeEmployees[0]?.name ?? "Selected employee";
        const selectedReviews = allReviews.filter((review) => review.employeeEmail === featuredEmail);

        if (!featuredEmail) {
          if (isMounted) {
            setTeamInsights(teamData);
            setFeaturedEmployeeName(featuredName);
            setFeaturedReviews(selectedReviews);
            setFeaturedInsight(null);
          }
          return;
        }

        const insightResponse = await fetch(
          `/api/insights/employee?employeeEmail=${encodeURIComponent(featuredEmail)}&employeeName=${encodeURIComponent(featuredName)}`,
        );
        const insightData = await readJsonResponse<EmployeeInsightsResponse>(
          insightResponse,
          "Could not load employee trend",
        );

        if (isMounted) {
          setTeamInsights(teamData);
          setFeaturedEmployeeName(featuredName);
          setFeaturedReviews(selectedReviews);
          setFeaturedInsight(insightData);
        }
      } catch {
        if (isMounted) {
          setTeamInsights(null);
          setFeaturedReviews([]);
          setFeaturedInsight(null);
        }
      }
    }

    void loadHeroData();

    return () => {
      isMounted = false;
    };
  }, []);

  const featuredReview = featuredReviews[0];
  const reviewedThisMonth = teamInsights?.metrics.reviewedThisMonth ?? 0;
  const pendingThisMonth = teamInsights?.metrics.pendingThisMonth ?? safeEmployees.length;
  const teamAverage = teamInsights?.metrics.teamAverage ?? 0;
  const reviewProgress = safeEmployees.length
    ? Math.min(100, Math.round((reviewedThisMonth / safeEmployees.length) * 100))
    : 0;
  const heroTrendPoints = aggregateTrendPoints(featuredInsight?.insight.trend ?? []).slice(-3);

  return (
    <motion.section
      className="hero-shell reveal-block"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
    >
      <motion.div variants={fadeUp} className="hero-brand-row">
        <span className="hero-kicker">Crystal People Lite</span>
      </motion.div>

      <motion.div variants={fadeUp} className="hero-preview-shell glass-panel">
        <div className="hero-preview-backdrop" aria-hidden="true" />
        <div className="hero-preview-heading">
          <div className="hero-preview-label">Overview</div>
          <h1>Monthly Review Command Center</h1>
        </div>
        <div className="hero-preview-grid">
          <article className="hero-preview-card">
            <div className="card-title-row">
              <div className="hero-preview-label">Reviewed</div>
              <InfoHint text="Shows how many team members already have a saved review for this month." />
            </div>
            <div className="hero-preview-number">
              {reviewedThisMonth} / {safeEmployees.length}
            </div>
            <div className="hero-preview-helper">employees this month</div>
            <div className="hero-progress-track" aria-hidden="true">
              <div className="hero-progress-fill" style={{ width: `${reviewProgress}%` }} />
            </div>
          </article>

          <article className="hero-preview-card">
            <div className="card-title-row">
              <div className="hero-preview-label">Pending</div>
              <InfoHint text="Shows how many people still need a review before the current month is complete." />
            </div>
            <div className="hero-preview-number">{pendingThisMonth}</div>
            <div className="hero-preview-helper">reviews left</div>
          </article>

          <article className="hero-preview-card">
            <div className="card-title-row">
              <div className="hero-preview-label">Average Score</div>
              <InfoHint text="Shows the overall average from the scores already saved across quality, attendance, and teamwork." />
            </div>
            <div className="hero-preview-number">{teamInsights ? `${teamAverage} / 5` : "--"}</div>
            <div className="hero-preview-helper">quality · attendance · teamwork</div>
          </article>

          <article className="hero-preview-card hero-preview-card-review">
            <div className="card-title-row">
              <div className="hero-preview-label">Recent Review</div>
              <InfoHint text="Shows the most recent review that was saved, including scores and manager feedback." />
            </div>
            <div className="hero-review-header">
              <strong>{featuredReview?.employeeName ?? featuredEmployeeName}</strong>
              <span>{featuredReview ? formatMonthLabel(featuredReview.monthKey) : "No review yet"}</span>
            </div>
            <div className="hero-score-row">
              <span>Output Quality: {featuredReview?.outputQuality ?? "--"}</span>
              <span>Attendance: {featuredReview?.attendance ?? "--"}</span>
              <span>Teamwork: {featuredReview?.teamwork ?? "--"}</span>
            </div>
            <div className="hero-preview-scroll">
              <p className="hero-preview-body">
                {featuredReview?.comment ??
                  "The latest written feedback will appear here once a review is saved."}
              </p>
            </div>
          </article>

          <article className="hero-preview-card hero-preview-card-history">
            <div className="card-title-row">
              <div className="hero-preview-label">Trend and History</div>
              <InfoHint text="Shows how one employee’s average score has been moving across the latest saved months." />
            </div>
            <div className="hero-review-header">
              <strong>{featuredEmployeeName}</strong>
              <span>{formatDirection(featuredInsight?.insight.growthDirection)}</span>
            </div>
            <TrendBarChart points={heroTrendPoints} compact />
            <div className="movement-history-text">
              {heroTrendPoints.length > 0
                ? heroTrendPoints
                    .map((point) => `${formatMonthShort(point.monthKey)} ${point.average}`)
                    .join(" → ")
                : "No monthly history yet."}
            </div>
          </article>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="hero-actions-block">
        <div className="hero-cta-row hero-cta-row-centered">
          <button className="button-primary" type="button" onClick={() => onOpenDemo("manager")}>
            Open Manager Demo
          </button>
          <button className="button-secondary" type="button" onClick={() => onOpenDemo("employee")}>
            View Employee Timeline
          </button>
        </div>
      </motion.div>
    </motion.section>
  );
}

function Atmosphere() {
  return (
    <div className="atmosphere" aria-hidden="true">
      <div className="atmosphere-mesh" />
      <div className="atmosphere-ring atmosphere-ring-a" />
      <div className="atmosphere-ring atmosphere-ring-b" />
      <div className="atmosphere-ring atmosphere-ring-c" />
    </div>
  );
}

function LoginView({
  onLogin,
  preferredDemo,
}: {
  onLogin: (user: PublicUser) => void;
  preferredDemo: "manager" | "employee" | null;
}) {
  const [form, setForm] = useState<LoginFormState>({
    email: managerUser.email,
    password: managerUser.password,
  });
  const [error, setError] = useState("");

  function handlePrefill(role: "manager" | "employee") {
    if (role === "manager") {
      setForm({ email: managerUser.email, password: managerUser.password });
      setError("");
      return;
    }

    setForm({ email: employeeUsers[0].email, password: employeeUsers[0].password });
    setError("");
  }

  useEffect(() => {
    if (!preferredDemo) {
      return;
    }

    handlePrefill(preferredDemo);
  }, [preferredDemo]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const matchedUser = authenticateUser(form.email, form.password);

    if (!matchedUser) {
      setError("The login details do not match the available demo accounts.");
      return;
    }

    setError("");
    onLogin(sanitizeUser(matchedUser));
  }

  return (
    <section className="login-grid reveal-block">
      <motion.article
        className="glass-panel major-panel"
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <SectionLabel>Secure workspace</SectionLabel>
        <h2>Sign in to the review desk</h2>
        <p className="muted-copy">
          This prototype uses a fixed account list so you can move straight into the experience
          without a full auth setup.
        </p>

        <form onSubmit={handleSubmit} className="stack-form">
          <InputField
            id="email"
            label="Email"
            value={form.email}
            onChange={(value) => setForm((current) => ({ ...current, email: value }))}
          />
          <InputField
            id="password"
            type="password"
            label="Password"
            value={form.password}
            onChange={(value) => setForm((current) => ({ ...current, password: value }))}
          />

          <div className="button-row">
            <button className="button-primary" type="submit">
              Enter workspace
            </button>
            <button className="button-secondary" type="button" onClick={() => handlePrefill("manager")}>
              Use manager account
            </button>
            <button className="button-secondary" type="button" onClick={() => handlePrefill("employee")}>
              Use employee account
            </button>
          </div>
        </form>

        {error ? <p className="tone-bad">{error}</p> : null}
      </motion.article>

      <motion.article
        className="glass-panel side-panel"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, duration: 0.45 }}
      >
        <SectionLabel>Quick access</SectionLabel>
        <h3>Demo accounts</h3>
        <div className="credential-stack">
          <CredentialCard
            title="Manager"
            lineOne={safeManager.email}
            lineTwo={`Password: ${managerUser.password}`}
          />
          <CredentialCard
            title="Employees"
            lineOne="Any employee email in the roster"
            lineTwo={`Password: ${employeeUsers[0].password}`}
          />
        </div>

        <div className="mini-stat-grid">
          <MiniStat label="Employees" value={String(safeEmployees.length)} />
          <MiniStat label="Review areas" value="3" />
          <MiniStat label="Live sheet" value="On" />
        </div>
      </motion.article>
    </section>
  );
}

function ManagerDashboard({
  user,
  onLogout,
}: {
  user: PublicUser;
  onLogout: () => void;
}) {
  const [form, setForm] = useState<ManagerFormState>(initialManagerForm);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [teamInsights, setTeamInsights] = useState<TeamInsightsResponse | null>(null);
  const [employeeInsights, setEmployeeInsights] = useState<EmployeeInsightsResponse | null>(null);
  const [employeeReviews, setEmployeeReviews] = useState<Review[]>([]);
  const [alignment, setAlignment] = useState<AlignmentResponse | null>(null);
  const [loadingSignals, setLoadingSignals] = useState(true);
  const [detailModal, setDetailModal] = useState<DetailModalState>(null);
  const [coverageModal, setCoverageModal] = useState<CoverageModalState>(null);

  const selectedEmployee =
    safeEmployees.find((employee) => employee.email === form.employeeEmail) ?? safeEmployees[0];
  const currentMonthLabel = formatMonthLabel(getMonthKey());
  const trendPoints = aggregateTrendPoints(employeeInsights?.insight.trend ?? []);
  const latestTrend = trendPoints[trendPoints.length - 1];
  const previousTrend = trendPoints.length > 1 ? trendPoints[trendPoints.length - 2] : null;
  const latestFeedback = employeeReviews[0]?.comment ?? "No feedback has been recorded yet.";
  const strongestSignal = getStrongestSignal(employeeInsights?.insight);
  const pendingReviewNames =
    teamInsights?.cards
      .find((card) => card.title === "Check-in watchlist")
      ?.points?.map((point) => point.label) ?? [];
  const pendingReviewSet = new Set(pendingReviewNames);
  const reviewedNames = safeEmployees
    .map((employee) => employee.name)
    .filter((name) => !pendingReviewSet.has(name));

  useEffect(() => {
    void loadTeamSignals();
  }, []);

  useEffect(() => {
    void loadEmployeeLens(selectedEmployee.email, selectedEmployee.name);
  }, [selectedEmployee.email, selectedEmployee.name]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!form.comment.trim()) {
        setAlignment(null);
        return;
      }

      void checkAlignment();
    }, 380);

    return () => window.clearTimeout(timeout);
  }, [form.comment, form.outputQuality, form.attendance, form.teamwork]);

  async function loadTeamSignals() {
    setLoadingSignals(true);

    try {
      const response = await fetch("/api/insights/team");
      const data = await readJsonResponse<TeamInsightsResponse>(response, "Could not load team signals");

      setTeamInsights(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load team signals");
    } finally {
      setLoadingSignals(false);
    }
  }

  async function loadEmployeeLens(employeeEmail: string, employeeName: string) {
    try {
      const [insightResponse, reviewResponse] = await Promise.all([
        fetch(
          `/api/insights/employee?employeeEmail=${encodeURIComponent(employeeEmail)}&employeeName=${encodeURIComponent(employeeName)}`,
        ),
        fetch(`/api/reviews?employeeEmail=${encodeURIComponent(employeeEmail)}`),
      ]);

      const [insightData, reviewData] = await Promise.all([
        readJsonResponse<EmployeeInsightsResponse>(insightResponse, "Could not load employee lens"),
        readJsonResponse<{ reviews: Review[] }>(reviewResponse, "Could not load employee history"),
      ]);

      setEmployeeInsights(insightData);
      setEmployeeReviews(reviewData.reviews);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load employee lens");
    }
  }

  async function checkAlignment() {
    try {
      const response = await fetch("/api/ai/alignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outputQuality: form.outputQuality,
          attendance: form.attendance,
          teamwork: form.teamwork,
          comment: form.comment,
        }),
      });

      const data = await readJsonResponse<AlignmentResponse>(response, "Could not check wording fit");

      setAlignment(data);
    } catch {
      setAlignment(null);
    }
  }

  async function handlePolishComment() {
    setIsPolishing(true);
    setMessage("");

    try {
      const response = await fetch("/api/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeName: selectedEmployee.name,
          outputQuality: form.outputQuality,
          attendance: form.attendance,
          teamwork: form.teamwork,
          comment: form.comment,
        }),
      });

      const data = await readJsonResponse<{ text: string }>(response, "Could not polish the wording");

      setForm((current) => ({ ...current, comment: data.text }));
      setMessage("The review wording has been tightened and made more specific.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not polish the wording");
    } finally {
      setIsPolishing(false);
    }
  }

  async function handleSubmitReview() {
    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeEmail: selectedEmployee.email,
          employeeName: selectedEmployee.name,
          managerEmail: user.email,
          outputQuality: form.outputQuality,
          attendance: form.attendance,
          teamwork: form.teamwork,
          comment: form.comment.trim(),
        }),
      });

      await readJsonResponse<{ ok: true }>(response, "Could not save the check-in");

      setMessage(`Check-in saved for ${selectedEmployee.name}.`);
      await Promise.all([
        loadTeamSignals(),
        loadEmployeeLens(selectedEmployee.email, selectedEmployee.name),
      ]);
      setForm((current) => ({ ...current, comment: "" }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the check-in");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCopyRecognition(note: string, employeeName: string) {
    try {
      await navigator.clipboard.writeText(note);
      setMessage(`Recognition note copied for ${employeeName}.`);
    } catch {
      setMessage("Could not copy the recognition note.");
    }
  }

  return (
    <section className="dashboard-stack">
      <DashboardHeader
        roleLabel="Manager workspace"
        title={`Good evening, ${user.name}`}
        body="Lead the monthly cycle, review team health, and move from observation to action without leaving the workspace."
        onLogout={onLogout}
      />

      <section className="metric-strip reveal-block">
        <MetricPanel
          label="Reviewed this month"
          value={String(teamInsights?.metrics.reviewedThisMonth ?? 0)}
          helpText="How many employees already have a review saved for the current month."
          onClick={() => setCoverageModal({ reviewed: reviewedNames, pending: pendingReviewNames })}
        />
        <MetricPanel
          label="Pending this month"
          value={String(teamInsights?.metrics.pendingThisMonth ?? safeEmployees.length)}
          helpText="How many employees still need a review before this month is complete."
          onClick={() => setCoverageModal({ reviewed: reviewedNames, pending: pendingReviewNames })}
        />
        <MetricPanel
          label="Average review level"
          value={teamInsights ? `${teamInsights.metrics.teamAverage}/5` : "--"}
          helpText="The current average score across all saved reviews."
        />
        <MetricPanel
          label="Team pulse"
          value={teamInsights?.metrics.moraleValue ?? "Loading"}
          helpText="A quick read on whether recent feedback sounds steady, mixed, or under pressure."
        />
      </section>

      <CoverageModal detail={coverageModal} onClose={() => setCoverageModal(null)} />

      <section className="main-grid reveal-block">
        <motion.article
          className="glass-panel studio-panel tooltip-surface"
          whileHover={{ y: -6 }}
          transition={{ type: "spring", stiffness: 180, damping: 18 }}
        >
          <SectionLabel>Review studio</SectionLabel>
          <div className="panel-heading-row">
            <div>
              <h2>Performance review</h2>
              <p className="muted-copy compact-copy">Score the month and keep the written review clear and fair.</p>
            </div>
            <InfoHint text="Managers use this area to score one employee for the current month and save written feedback." />
          </div>

          <div className="review-meta-row">
            <FieldShell label="Employee">
              <select
                className="field-input"
                value={form.employeeEmail}
                onChange={(event) =>
                  setForm((current) => ({ ...current, employeeEmail: event.target.value }))
                }
              >
                {safeEmployees.map((employee) => (
                  <option key={employee.id} value={employee.email}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </FieldShell>
            <FieldShell label="Month">
              <input className="field-input" value={currentMonthLabel} readOnly />
            </FieldShell>
          </div>

          <div className="compact-score-panel">
            <ScoreRow
              label="Output Quality"
              value={form.outputQuality}
              onChange={(value) => setForm((current) => ({ ...current, outputQuality: value }))}
            />
            <ScoreRow
              label="Attendance"
              value={form.attendance}
              onChange={(value) => setForm((current) => ({ ...current, attendance: value }))}
            />
            <ScoreRow
              label="Teamwork"
              value={form.teamwork}
              onChange={(value) => setForm((current) => ({ ...current, teamwork: value }))}
            />
          </div>

          <FieldShell label="Written review">
            <textarea
              className="field-input field-textarea"
              value={form.comment}
              placeholder="Write a short, direct review that captures what went well and what should improve next."
              onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))}
            />
          </FieldShell>

          <div className="assistant-band">
            <div className={`signal-pill signal-${alignment?.status ?? "watch"}`}>
              <span>Score fit</span>
              <strong>{alignment ? alignment.summary : "Start writing to check whether the wording matches the scores."}</strong>
            </div>
            <div className="button-row">
              <button className="button-secondary" onClick={handlePolishComment} disabled={isPolishing}>
                {isPolishing ? "Refining..." : "Refine wording"}
              </button>
              <button className="button-primary" onClick={handleSubmitReview} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save check-in"}
              </button>
            </div>
          </div>

          {message ? (
            <p
              className={
                /could not|failed|unable|error|received a page/i.test(message)
                  ? "tone-bad"
                  : "tone-good"
              }
            >
              {message}
            </p>
          ) : null}
        </motion.article>

        <article className="glass-panel command-panel tooltip-surface">
          <SectionLabel>Command deck</SectionLabel>
          <div className="panel-heading-row">
            <div>
              <h2>Team signals</h2>
              <p className="muted-copy compact-copy">A compact view of workload, wellbeing, pending check-ins, and follow-up areas.</p>
            </div>
            <InfoHint text="These cards help a manager spot team-wide patterns that may need follow-up." />
          </div>

          <div className="signal-card-grid">
            {(teamInsights?.cards ?? []).map((card) => (
              <SignalCard
                key={card.title}
                card={card}
                onReadMore={() =>
                  setDetailModal({
                    title: card.title,
                    text: card.summary,
                    items: card.points?.map((point) => `${point.label}: ${point.detail}`),
                  })
                }
              />
            ))}
            {loadingSignals && !teamInsights ? (
              <div className="empty-card">Loading the latest team signals...</div>
            ) : null}
          </div>

          <div className="signal-detail-board">
            {(teamInsights?.cards ?? [])
              .filter((card) => card.points?.length)
              .map((card) => (
                <div key={`${card.title}-details`} className="signal-detail-panel">
                  <div className="signal-detail-header">
                    <strong>{card.title}</strong>
                    <span>{card.points?.length} items</span>
                  </div>
                  <div className="signal-detail-scroll">
                    {card.points?.map((point) => (
                      <div key={`${card.title}-${point.label}`} className="signal-detail-row">
                        <strong>{point.label}</strong>
                        <span>{point.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </article>
      </section>

      <section className="focus-grid reveal-block">
        <article className="glass-panel focus-panel tooltip-surface">
          <SectionLabel>People lens</SectionLabel>
          <div className="panel-heading-row people-lens-header">
            <div>
              <h2>{selectedEmployee.name}</h2>
              <p className="muted-copy compact-copy">
                A compact read on current momentum, skill signals, and next-step development for
                the selected teammate.
              </p>
            </div>
            <InfoHint text="People Lens turns one employee’s recent reviews into a short summary, practical next steps, and recurring skill signals." />
          </div>

          <div className="status-cluster people-lens-cluster">
            <StatusBadge label="Trend" value={formatDirection(employeeInsights?.insight.growthDirection)} />
            <StatusBadge
              label="Avg"
              value={employeeInsights?.insight.latestAverage ? `${employeeInsights.insight.latestAverage}/5` : "--"}
            />
            <StatusBadge
              label="Load"
              value={formatLabel(employeeInsights?.insight.workloadSignal.label ?? "balanced")}
            />
            <StatusBadge
              label="Wellbeing"
              value={formatLabel(employeeInsights?.insight.wellbeingSignal.label ?? "steady")}
            />
            <StatusBadge label="Strongest" value={strongestSignal} />
          </div>

          <div className="people-lens-grid">
            <div className="glass-subpanel summary-subpanel">
              <div className="card-title-row">
                <h3>Growth Summary</h3>
                <InfoHint text="A short plain-English summary of how this person has been doing lately." />
              </div>
              <p className="body-copy clamped-copy">
                {employeeInsights?.growthStory ??
                  "A fuller summary will appear here once the employee history has been loaded."}
              </p>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setDetailModal({
                    title: `${selectedEmployee.name} growth story`,
                    text:
                      employeeInsights?.growthStory ??
                      "A fuller summary will appear here once the employee history has been loaded.",
                  })
                }
              >
                View full story
              </button>
            </div>

            <div className="glass-subpanel summary-subpanel">
              <div className="card-title-row">
                <h3>Learning Actions</h3>
                <InfoHint text="Short next steps the employee can focus on after the latest review pattern." />
              </div>
              {(employeeInsights?.learningActions ?? []).length ? (
                <ul className="action-checklist">
                  {(employeeInsights?.learningActions ?? []).slice(0, 3).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted-copy">Learning actions will appear here once the profile is ready.</p>
              )}
              {(employeeInsights?.learningActions ?? []).length ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setDetailModal({
                      title: `${selectedEmployee.name} learning actions`,
                      items: employeeInsights?.learningActions ?? [],
                    })
                  }
                >
                  View all actions
                </button>
              ) : null}
            </div>

            <div className="glass-subpanel summary-subpanel">
              <div className="card-title-row">
                <h3>Skill Signals</h3>
                <InfoHint text="Shows the recurring themes that are appearing most often in recent reviews." />
              </div>
              <TagRow
                values={Array.from(
                  new Set([
                    ...(employeeInsights?.insight.focusAreas ?? []),
                    ...(employeeInsights?.insight.strengths ?? []),
                  ]),
                )}
                emptyText="No recurring skill theme yet."
              />
              <div className="strongest-signal-row">
                <span>Strongest signal</span>
                <strong>{strongestSignal}</strong>
              </div>
            </div>
          </div>
        </article>

        <article className="glass-panel history-panel tooltip-surface">
          <SectionLabel>Trend and history</SectionLabel>
          <div className="history-top">
            <div>
              <h2>Recent movement</h2>
              <p className="muted-copy compact-copy">Selected employee trend and latest feedback.</p>
            </div>
            <InfoHint text="This card shows whether the selected employee’s scores are moving up, holding steady, or slipping." />
            <div className="score-chip-compact">{employeeInsights?.insight.latestAverage ? `${employeeInsights.insight.latestAverage}/5` : "--"}</div>
          </div>

          <div className="movement-stat-row">
            <StatusBadge label="Trend" value={formatDirection(employeeInsights?.insight.growthDirection)} />
            <StatusBadge label="Latest month" value={latestTrend ? formatMonthLabel(latestTrend.monthKey) : "No data yet"} />
            <StatusBadge
              label="Previous month"
              value={previousTrend ? formatMonthLabel(previousTrend.monthKey) : "No earlier month"}
            />
          </div>

          <div className="recent-movement-card">
            <TrendBarChart points={trendPoints.slice(-4)} compact />

            <div className="movement-history-inline">
              {trendPoints.slice(-3).map((point) => (
                <div key={point.monthKey} className="movement-history-pill">
                  <span>{formatMonthShort(point.monthKey)}</span>
                  <strong>{point.average}</strong>
                </div>
              ))}
            </div>

            <div className="glass-subpanel feedback-preview-box">
              <h3>Latest feedback</h3>
              <div className="summary-box">{latestFeedback}</div>
            </div>

            <div className="movement-history-text">
              {trendPoints.length > 0
                ? trendPoints
                    .slice(-3)
                    .map((point) => `${formatMonthShort(point.monthKey)}: ${point.average}`)
                    .join(" → ")
                : "No score history yet."}
            </div>
          </div>

          <div className="timeline-scroll-shell">
            <div className="timeline-scroll-title">Score history</div>
            <TimelineList reviews={employeeReviews} emptyText="No check-ins logged yet for this person." compact />
          </div>
        </article>
      </section>

      <section className="recognition-grid reveal-block">
        <article className="glass-panel tooltip-surface">
          <SectionLabel>Recognition notes</SectionLabel>
          <div className="panel-heading-row">
            <div>
              <h2>Easy to share highlights</h2>
              <p className="muted-copy compact-copy">
                Short recognition messages you can quickly reuse in email, chat, or one-to-one conversations.
              </p>
            </div>
            <InfoHint text="These notes turn strong recent performance into quick, ready-to-share appreciation messages." />
          </div>
          <div className="recognition-card-grid">
            {(teamInsights?.recognition ?? []).map((entry) => (
              <motion.div
                key={entry.employeeName}
                className="glass-subpanel recognition-card"
                whileHover={{ y: -4, rotateX: -3 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              >
                <div className="card-title-row">
                  <strong>{entry.employeeName}</strong>
                  <InfoHint text="A short recognition note based on recent strong review signals for this employee." />
                </div>
                <p className="body-copy clamped-copy">{entry.message}</p>
                <div className="inline-action-row">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => void handleCopyRecognition(entry.message, entry.employeeName)}
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setDetailModal({
                        title: `${entry.employeeName} recognition note`,
                        text: entry.message,
                      })
                    }
                  >
                    View full
                  </button>
                </div>
              </motion.div>
            ))}
            {!teamInsights?.recognition?.length ? (
              <div className="empty-card">Recognition notes will appear once the team has more history.</div>
            ) : null}
          </div>
        </article>
      </section>

      <DetailModal detail={detailModal} onClose={() => setDetailModal(null)} />
    </section>
  );
}

function EmployeeDashboard({
  user,
  onLogout,
}: {
  user: PublicUser;
  onLogout: () => void;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [employeeInsights, setEmployeeInsights] = useState<EmployeeInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailModal, setDetailModal] = useState<DetailModalState>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        const [reviewResponse, insightResponse] = await Promise.all([
          fetch(`/api/reviews?employeeEmail=${encodeURIComponent(user.email)}`),
          fetch(
            `/api/insights/employee?employeeEmail=${encodeURIComponent(user.email)}&employeeName=${encodeURIComponent(user.name)}`,
          ),
        ]);

        const [reviewData, insightData] = await Promise.all([
          readJsonResponse<{ reviews: Review[] }>(reviewResponse, "Could not load history"),
          readJsonResponse<EmployeeInsightsResponse>(insightResponse, "Could not load profile"),
        ]);

        if (isMounted) {
          setReviews(reviewData.reviews);
          setEmployeeInsights(insightData);
          setError("");
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Could not load profile");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadProfile();
    return () => {
      isMounted = false;
    };
  }, [user.email, user.name]);

  const latestReview = reviews[0];
  const trendPoints = aggregateTrendPoints(employeeInsights?.insight.trend ?? []);
  const strongestSignal = getStrongestSignal(employeeInsights?.insight);
  const categories = latestReview
    ? [
        { label: "Output quality", value: latestReview.outputQuality },
        { label: "Attendance", value: latestReview.attendance },
        { label: "Teamwork", value: latestReview.teamwork },
      ]
    : [];

  return (
    <section className="dashboard-stack">
      <DashboardHeader
        roleLabel="Personal workspace"
        title={`Welcome back, ${user.name}`}
        body="See how the month is landing, where your momentum is strongest, and what to focus on next."
        onLogout={onLogout}
      />

      <section className="employee-hero-grid reveal-block">
        <article className="glass-panel">
          <SectionLabel>Current snapshot</SectionLabel>
          <div className="history-top">
            <div>
              <h2>Your latest review</h2>
              <p className="muted-copy">
                The most recent snapshot pulls together your review level, growth direction, and
                recent written context.
              </p>
            </div>
            <div className="score-hero">
              {employeeInsights?.insight.latestAverage ? `${employeeInsights.insight.latestAverage}/5` : "--"}
            </div>
          </div>

          <CategoryBars items={categories} />
          <TrendBarChart points={trendPoints} />
        </article>

        <article className="glass-panel">
          <SectionLabel>Growth story</SectionLabel>
          <h2>What the recent pattern says</h2>
          <p className="body-copy">
            {employeeInsights?.growthStory ?? "Loading your recent pattern..."}
          </p>
          <div className="status-cluster" style={{ marginTop: 18 }}>
            <StatusBadge label="Direction" value={employeeInsights?.insight.growthDirection ?? "steady"} />
            <StatusBadge label="Load" value={employeeInsights?.insight.workloadSignal.label ?? "balanced"} />
            <StatusBadge label="Wellbeing" value={employeeInsights?.insight.wellbeingSignal.label ?? "steady"} />
          </div>
        </article>
      </section>

      <section className="focus-grid reveal-block">
        <article className="glass-panel focus-panel">
          <SectionLabel>Personal focus</SectionLabel>
          <div className="panel-heading-row people-lens-header">
            <div>
              <h2>Personal focus</h2>
              <p className="muted-copy compact-copy">
                A cleaner view of your strengths, development themes, and practical next steps.
              </p>
            </div>
          </div>

          <div className="status-cluster people-lens-cluster">
            <StatusBadge label="Trend" value={formatDirection(employeeInsights?.insight.growthDirection)} />
            <StatusBadge
              label="Avg"
              value={employeeInsights?.insight.latestAverage ? `${employeeInsights.insight.latestAverage}/5` : "--"}
            />
            <StatusBadge
              label="Load"
              value={formatLabel(employeeInsights?.insight.workloadSignal.label ?? "balanced")}
            />
            <StatusBadge
              label="Wellbeing"
              value={formatLabel(employeeInsights?.insight.wellbeingSignal.label ?? "steady")}
            />
            <StatusBadge label="Strongest" value={strongestSignal} />
          </div>

          <div className="people-lens-grid">
            <div className="glass-subpanel summary-subpanel">
              <div className="card-title-row">
                <h3>Learning Actions</h3>
              </div>
              {(employeeInsights?.learningActions ?? []).length ? (
                <ul className="action-checklist">
                  {(employeeInsights?.learningActions ?? []).slice(0, 3).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted-copy">Learning actions will appear here as your review pattern grows.</p>
              )}
              {(employeeInsights?.learningActions ?? []).length ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setDetailModal({
                      title: "All learning actions",
                      items: employeeInsights?.learningActions ?? [],
                    })
                  }
                >
                  View all actions
                </button>
              ) : null}
            </div>

            <div className="glass-subpanel summary-subpanel">
              <div className="card-title-row">
                <h3>Strengths and Themes</h3>
              </div>
              <TagRow
                values={Array.from(
                  new Set([
                    ...(employeeInsights?.insight.strengths ?? []),
                    ...(employeeInsights?.insight.focusAreas ?? []),
                  ]),
                )}
                emptyText="Strength themes will appear here."
              />
              <div className="strongest-signal-row">
                <span>Strongest signal</span>
                <strong>{strongestSignal}</strong>
              </div>
            </div>

            <div className="glass-subpanel summary-subpanel">
              <div className="card-title-row">
                <h3>Recognition Note</h3>
              </div>
              <p className="body-copy clamped-copy">
                {employeeInsights?.recognitionMessage ?? "Recognition language will appear here."}
              </p>
              {employeeInsights?.recognitionMessage ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setDetailModal({
                      title: "Recognition note",
                      text: employeeInsights.recognitionMessage,
                    })
                  }
                >
                  View full note
                </button>
              ) : null}
            </div>
          </div>
        </article>

        <article className="glass-panel history-panel">
          <SectionLabel>Review timeline</SectionLabel>
          {loading ? <div className="empty-card">Loading your review history...</div> : null}
          {error ? <p className="tone-bad">{error}</p> : null}
          {!loading && !error ? (
            <>
              <div className="glass-subpanel story-panel">
                <h3>Monthly readout</h3>
                <div className="summary-box">
                  {employeeInsights?.trendSummary ?? "Your recent monthly readout will appear here."}
                </div>
              </div>

              <TimelineList reviews={reviews} emptyText="No reviews have been added yet." />
            </>
          ) : null}
        </article>
      </section>

      <DetailModal detail={detailModal} onClose={() => setDetailModal(null)} />
    </section>
  );
}

function DashboardHeader({
  roleLabel,
  title,
  body,
  onLogout,
}: {
  roleLabel: string;
  title: string;
  body: string;
  onLogout: () => void;
}) {
  return (
    <motion.section className="header-panel reveal-block" initial="hidden" animate="visible" variants={fadeUp}>
      <div>
        <SectionLabel>{roleLabel}</SectionLabel>
        <h2>{title}</h2>
        <p className="muted-copy">{body}</p>
      </div>
      <button className="button-secondary" onClick={onLogout}>
        Sign out
      </button>
    </motion.section>
  );
}

function InputField({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="field-shell" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type={type} className="field-input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function FieldShell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field-shell">
      <span>{label}</span>
      {children}
    </label>
  );
}

function CredentialCard({
  title,
  lineOne,
  lineTwo,
}: {
  title: string;
  lineOne: string;
  lineTwo: string;
}) {
  return (
    <div className="credential-card">
      <strong>{title}</strong>
      <span>{lineOne}</span>
      <span>{lineTwo}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricPanel({
  label,
  value,
  helpText,
  onClick,
}: {
  label: string;
  value: string;
  helpText: string;
  onClick?: () => void;
}) {
  return (
    <motion.article
      className={onClick ? "glass-metric glass-metric-action" : "glass-metric"}
      whileHover={{ y: -5, scale: 1.01 }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="card-title-row">
        <span>{label}</span>
        <InfoHint text={helpText} />
      </div>
      <strong>{value}</strong>
    </motion.article>
  );
}

function ScoreRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="score-row-compact">
      <span className="score-row-label">{label}</span>
      <div className="score-pills">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            className={score === value ? "score-pill active" : "score-pill"}
            onClick={() => onChange(score)}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}

function SignalCard({
  card,
  onReadMore,
}: {
  card: TeamSignalCard;
  onReadMore?: () => void;
}) {
  const count = extractLeadingCount(card.value);

  const view =
    card.title === "Load balance"
      ? {
          value: count === null ? "Stable" : String(count),
          helper: count === null ? "" : card.value.includes("ready for more") ? "people ready for more" : "people carrying more",
          description:
            count === null
              ? "Work patterns look evenly distributed."
              : card.value.includes("ready for more")
                ? "Some employees may be ready to take on more."
                : "A few people may be carrying more than others.",
          chip: count === null ? "Healthy" : "Review",
        }
      : card.title === "Wellbeing watch"
        ? {
            value: count === null ? "Steady" : String(count),
            helper: count === null ? "" : count === 1 ? "person to check" : "people to check",
            description: count === null ? "No strong pressure pattern is visible." : "May need attention this month.",
            chip: count === null ? "Healthy" : "Review",
          }
        : card.title === "Check-in watchlist"
          ? {
              value: count === null ? "0" : String(count),
              helper: count === 1 ? "pending review" : "pending reviews",
              description: "Reviews still pending this month.",
              chip: "Needs follow-up",
            }
          : card.title === "Team pulse"
            ? {
                value: card.value,
                helper: "",
                description: "Progress is visible, but follow-ups are needed.",
                chip: card.value === "Steady" ? "Healthy" : "Review",
              }
            : card.title === "Recognition notes"
              ? {
                  value: count === null ? "0" : String(count),
                  helper: count === 1 ? "standout moment" : "standout moments",
                  description: "Found in recent feedback.",
                  chip: "Positive",
                }
              : {
                  value: count === null ? "0" : String(count),
                  helper: count === 1 ? "comment to review" : "comments to review",
                  description: "Comments may need score checks.",
                  chip: "Check alignment",
                };

  return (
    <motion.div
      className={`signal-card signal-card-${card.tone}`}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
    >
      <div className="signal-card-header">
        <span className="signal-card-title">{card.title}</span>
        <InfoHint text={getSignalCardHelpText(card.title)} />
      </div>
      <div className="signal-card-value-block">
        <strong className="signal-card-value">{view.value}</strong>
        {view.helper ? <span className="signal-card-helper">{view.helper}</span> : null}
      </div>
      <p className="signal-card-description">{view.description}</p>
      {onReadMore ? (
        <button type="button" className="text-button signal-readmore" onClick={onReadMore}>
          Read more
        </button>
      ) : null}
      <div className="signal-card-badge">{view.chip}</div>
    </motion.div>
  );
}

function TrendBarChart({
  points,
  compact = false,
}: {
  points: Array<{ monthKey: string; average: number }>;
  compact?: boolean;
}) {
  if (points.length === 0) {
    return <div className="chart-empty">More monthly check-ins will shape the trend view here.</div>;
  }

  return (
    <div className={compact ? "chart-shell chart-shell-compact" : "chart-shell"}>
      <div
        className={compact ? "trend-bar-chart trend-bar-chart-compact" : "trend-bar-chart"}
        style={{ gridTemplateColumns: `repeat(${points.length}, minmax(72px, 88px))` }}
      >
        {points.map((point) => (
          <div key={point.monthKey} className="trend-bar-column">
            <span className="trend-bar-value">{point.average}</span>
            <div className="trend-bar-track">
              <div className="trend-bar-fill" style={{ height: `${Math.max(18, (point.average / 5) * 100)}%` }} />
            </div>
            <span className="trend-bar-label">{formatMonthShort(point.monthKey)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineList({
  reviews,
  emptyText,
  compact = false,
}: {
  reviews: Review[];
  emptyText: string;
  compact?: boolean;
}) {
  if (reviews.length === 0) {
    return <div className="empty-card">{emptyText}</div>;
  }

  return (
    <div className={compact ? "timeline-list timeline-list-compact" : "timeline-list"}>
      {reviews.map((review) => (
        <motion.div
          key={review.timestamp}
          className={compact ? "timeline-card timeline-card-compact" : "timeline-card"}
          whileHover={{ y: -2 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          <div className="timeline-head">
            <strong>{formatReviewDate(review.timestamp)}</strong>
            <span>{averageReviewScore(review)}/5</span>
          </div>
          <div className="timeline-tags">
            <Tag value={`Output ${review.outputQuality}`} />
            <Tag value={`Attendance ${review.attendance}`} />
            <Tag value={`Teamwork ${review.teamwork}`} />
          </div>
          <p>{review.comment}</p>
        </motion.div>
      ))}
    </div>
  );
}

function CategoryBars({
  items,
}: {
  items: Array<{ label: string; value: number }>;
}) {
  if (!items.length) {
    return <div className="chart-empty">Once a review is added, category levels will appear here.</div>;
  }

  return (
    <div className="bar-stack">
      {items.map((item) => (
        <div key={item.label} className="bar-row">
          <span>{item.label}</span>
          <div className="bar-track">
            <motion.div
              className="bar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${(item.value / 5) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <strong>{item.value}/5</strong>
        </div>
      ))}
    </div>
  );
}

function TagRow({
  values,
  emptyText,
}: {
  values: string[];
  emptyText: string;
}) {
  if (!values.length) {
    return <p className="muted-copy">{emptyText}</p>;
  }

  return (
    <div className="timeline-tags">
      {values.map((value) => (
        <Tag key={value} value={value} />
      ))}
    </div>
  );
}

function Tag({ value }: { value: string }) {
  return <span className="tag-chip">{value}</span>;
}

function StatusBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="status-badge">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoHint({ text }: { text: string }) {
  return (
    <span className="info-hint" tabIndex={0} aria-label={text}>
      <span className="info-hint-icon">i</span>
      <span className="info-hint-tooltip" role="tooltip">
        {text}
      </span>
    </span>
  );
}

function DetailModal({
  detail,
  onClose,
}: {
  detail: DetailModalState;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!detail) {
      return;
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [detail, onClose]);

  if (!detail) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="glass-panel modal-card"
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          transition={{ duration: 0.22 }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="card-title-row">
            <div>
              <SectionLabel>Full detail</SectionLabel>
              <h3>{detail.title}</h3>
            </div>
            <button type="button" className="button-secondary modal-close" onClick={onClose}>
              Close
            </button>
          </div>

          {detail.text ? <div className="summary-box modal-body-copy">{detail.text}</div> : null}

          {detail.items?.length ? (
            <ul className="action-checklist modal-checklist">
              {detail.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function CoverageModal({
  detail,
  onClose,
}: {
  detail: CoverageModalState;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!detail) {
      return;
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [detail, onClose]);

  if (!detail) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="glass-panel modal-card coverage-modal"
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          transition={{ duration: 0.22 }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="card-title-row">
            <div>
              <SectionLabel>Review coverage</SectionLabel>
              <h3>Monthly check-in progress</h3>
            </div>
            <button type="button" className="button-secondary modal-close" onClick={onClose}>
              Close
            </button>
          </div>

          <div className="coverage-grid">
            <section className="coverage-panel coverage-panel-reviewed">
              <div className="coverage-panel-header">
                <strong>Reviewed</strong>
                <span>{detail.reviewed.length}</span>
              </div>
              <p className="muted-copy">Employees already checked in this month.</p>
              <div className="coverage-list">
                {detail.reviewed.length ? (
                  detail.reviewed.map((name) => (
                    <div key={name} className="coverage-pill coverage-pill-reviewed">
                      {name}
                    </div>
                  ))
                ) : (
                  <div className="coverage-empty">No one has been reviewed yet.</div>
                )}
              </div>
            </section>

            <section className="coverage-panel coverage-panel-pending">
              <div className="coverage-panel-header">
                <strong>Still pending</strong>
                <span>{detail.pending.length}</span>
              </div>
              <p className="muted-copy">Employees still left to check in this month.</p>
              <div className="coverage-list">
                {detail.pending.length ? (
                  detail.pending.map((name) => (
                    <div key={name} className="coverage-pill coverage-pill-pending">
                      {name}
                    </div>
                  ))
                ) : (
                  <div className="coverage-empty">Everyone has already been reviewed.</div>
                )}
              </div>
            </section>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="section-label">{children}</div>;
}
