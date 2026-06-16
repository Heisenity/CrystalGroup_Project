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
