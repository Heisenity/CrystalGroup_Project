# Crystal Group Check-ins

A simple Next.js prototype for monthly employee performance reviews.

## What it includes

- Hardcoded login for one manager and twenty employees
- Manager dashboard to score employees on Output Quality, Attendance, and Teamwork
- Employee dashboard with a timeline of past reviews
- Google Sheets persistence using a service account
- Gemini-powered feedback improvement and trend summary
- Review coverage tracking so a manager can see who is still pending this month

## Fast setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill in:

- `GOOGLE_SHEET_ID`
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` is optional

3. Create a Google Sheet

4. The app will automatically use the first tab and create this header row if needed:

```text
timestamp | monthKey | employeeEmail | employeeName | managerEmail | outputQuality | attendance | teamwork | comment
```

5. Share the sheet with your Google service account email as an editor.

6. Start the app:

```bash
npm run dev
```

## Demo flow

- Log in as `sarah@crystalgroup.com` with password `manager123`
- Submit a review for an employee
- Log out
- Log in as that employee with password `employee123`
- View the timeline and generate an AI summary

## Credentials you need

### 1. Google Sheets

You need:

- `GOOGLE_SHEET_ID`
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

How to get them:

1. Create a Google Cloud project
2. Enable the Google Sheets API
3. Create a service account under IAM & Admin
4. Generate a JSON key for that service account
5. Open the JSON file and copy:
   - `client_email` into `GOOGLE_CLIENT_EMAIL`
   - `private_key` into `GOOGLE_PRIVATE_KEY`
6. Open your Google Sheet and copy the sheet ID from the URL into `GOOGLE_SHEET_ID`
7. Share the sheet with the service account email as an editor

### 2. Gemini API

You need:

- `GEMINI_API_KEY`
- optional: `GEMINI_MODEL`

How to get them:

1. Open Google AI Studio
2. Create a Gemini API key
3. Paste it into `GEMINI_API_KEY`
4. Leave `GEMINI_MODEL` as the default unless you want a different Gemini model

## SOP: How to use the app

This app is a simple monthly performance review system for a small team.

It has two roles:

- `Manager`: gives monthly scores and written feedback
- `Employee`: views personal review history and growth signals

### 1. Login

Open the app and choose a demo user.

- Manager demo:
  - Email: `sarah@crystalgroup.com`
  - Password: `manager123`
- Employee demo:
  - Any listed employee email
  - Password: `employee123`

### 2. What the manager does

After manager login, the manager workspace opens.

Main use:

- select an employee
- choose scores from `1` to `5` for:
  - Output Quality
  - Attendance
  - Teamwork
- write a review comment
- optionally refine the wording
- save the check-in

### 3. What the manager dashboard sections mean

#### Monthly Review Command Center

This is the top overview block.

- `Reviewed`: how many employees already have a review in the current month
- `Pending`: how many employees are still left this month
- `Average Score`: current-month average across all submitted reviews
- `Recent Review`: latest saved review with scores and comment
- `Trend and History`: recent monthly movement for the selected person

If you click the reviewed or pending card, a small panel opens showing:

- employees already reviewed
- employees still left

### 4. Performance Review section

This is where the real monthly review is submitted.

How to use it:

1. Select an employee
2. Pick the month cycle by using the current review form
3. Score all 3 areas
4. Write clear feedback
5. Click `Refine wording` if you want help improving the wording
6. Click `Save check-in`

What the scores mean:

- `1`: serious concern
- `2`: below expected level
- `3`: acceptable / mixed
- `4`: strong
- `5`: excellent

### 5. Score Fit

This checks whether the written feedback matches the scores.

Example:

- if scores are low but the wording sounds too positive, it may flag that
- if scores are high but the wording sounds too negative, it may also flag that

Use it to make reviews fair and easy to understand.

### 6. Team Signals

These cards help the manager quickly understand the month.

- `Load balance`: whether work seems evenly spread
- `Wellbeing watch`: whether someone may need support
- `Check-in watchlist`: who is still missing a review
- `Team pulse`: general team mood from recent feedback
- `Recognition notes`: strong work worth appreciating
- `Score alignment`: comments that may need a second look

Each card has an `i` icon.

Hover over it to see a simple explanation of what that card is for.

If a card says `Read more`, click it to open the full explanation.

### 7. People Lens

This area focuses on one selected employee.

It helps a manager understand:

- current direction
- average level
- strengths
- areas to improve
- learning actions
- skill signals

Use it before a one-to-one meeting or before writing the next review.

### 8. Recognition Notes

This section creates short praise messages for employees who are doing well.

Use cases:

- send appreciation in Slack
- copy a short message into email
- prepare for monthly recognition

### 9. What the employee sees

Employees do not see the manager overview.

They only see their own workspace and personal history.

Main sections:

- `Current Snapshot`: latest review level and category scores
- `Growth Story`: plain-English explanation of recent progress
- `Personal Focus`: strengths, actions, and skill signals
- `Score History`: all past review entries for that employee

### 10. How the employee should use it

Employees can use the app to:

- read the latest manager feedback
- understand which area is strongest
- understand what needs work
- track monthly score movement
- prepare for review discussions

### 11. Where the data is stored

Every saved review goes into Google Sheets.

Each row stores:

- timestamp
- monthKey
- employee email
- employee name
- manager email
- output quality score
- attendance score
- teamwork score
- comment

### 12. How the smart assistance is used

The app uses AI support to help with useful review tasks.

It is used for:

- rewriting rough feedback into clearer wording
- checking whether score and comment match
- creating employee growth summaries
- generating learning actions
- generating recognition messages
- building team insight summaries from review data

### 13. Recommended monthly workflow

For managers:

1. Open the app
2. Check reviewed vs pending employees
3. Start with employees still pending
4. Submit clear scores and written feedback
5. Use wording refinement where needed
6. Check score fit before saving if needed
7. Review team signals for follow-up actions
8. Use People Lens before one-to-one discussions

For employees:

1. Open the app
2. Read the latest review
3. Check the score history
4. Review personal focus actions
5. Use the feedback in the next month’s work plan

### 14. Best use cases

- monthly check-ins for a team of around 20 people
- internal performance tracking
- one-to-one preparation
- recognition and follow-up planning
- spotting missing reviews before month-end

### 15. Important note

This is a monthly review tool.

So trend, history, and comparisons are most useful when each employee has one review per month.
