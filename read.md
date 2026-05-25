# Job Portal — Master Prompt

> You are a senior web developer. Build a complete Job Portal website using **pure HTML, CSS, and JavaScript only**.
> No frameworks, no libraries, no backend. All data lives in `localStorage`.

---

## Project Structure

```
/job-portal
├── admin/
│   ├── login.html          → Admin login page
│   ├── dashboard.html      → Lists all posted jobs with New Job button
│   ├── post-job.html       → Dynamic form to post a new job
│   └── admin.js            → All admin-side JS logic
│
├── user/
│   ├── login.html          → User login page
│   ├── register.html       → User registration page
│   ├── jobs.html           → Search + browse all job listings
│   ├── job-detail.html     → Full job detail view
│   └── user.js             → All user-side JS logic
│
└── data/
    └── admins.json         → Static file with hardcoded admin credentials only
```

> **Rule:** Users and jobs are never stored in static files.
> Users come from registration (stored in localStorage).
> Jobs come from admin form submissions (stored in localStorage).

---

## Universal JSON Schema

This is the single blueprint used for every job posting.
When the admin submits the job form, the JS maps all form fields into this exact schema and pushes it into the `jobs` array in `localStorage`.

```json
{
  "id": "auto-generated → Date.now() as string",
  "meta": {
    "createdAt": "ISO timestamp → new Date().toISOString()",
    "createdBy": "admin email from localStorage session",
    "status": "active"
  },
  "jobDetails": {
    "title": "string → from form input",
    "company": "string → from form input",
    "role": "string → from form dropdown or input",
    "type": "Full-Time | Part-Time | Contract | Internship → dropdown",
    "location": "string → from form input"
  },
  
  "requirements": {
    "experience": "0-1 years | 1-3 years | 3-5 years | 5+ years → dropdown",
    "skills": ["array of strings → comma-separated input, split into array on save"],
    "education": "string → from form input"
  },
  "compensation": {
    "salary": "number → from form number input",
    "period": "Annual | Monthly → dropdown"
  },
  "description": {
    "summary": "string → textarea",
    "responsibilities": ["array of strings → one per line textarea, split on newline"],
    "benefits": ["array of strings → one per line textarea, split on newline"]
  }
}
```

### How localStorage stores jobs

```js
// Key: "jobs"
// Value: array of job objects following the universal schema above

const existingJobs = JSON.parse(localStorage.getItem("jobs")) || [];
existingJobs.push(newJobObject);
localStorage.setItem("jobs", JSON.stringify(existingJobs));
```

---

## Section 1 — Admin

### `data/admins.json`

Static file. Fetched once at admin login. Never modified by the app.

```json
{
  "admins": [
    {
      "id": "a001",
      "name": "Admin User",
      "email": "admin@jobportal.com",
      "password": "admin123"
    }
  ]
}
```

---

### `admin/login.html`

- Centered login form with email and password fields and a Submit button
- On submit → fetch `../data/admins.json` → match credentials
- On match → save admin object to `localStorage` as `adminSession` → redirect to `dashboard.html`
- On fail → show inline error: "Invalid admin credentials"
- On page load → if `adminSession` already exists in `localStorage`, skip and redirect to `dashboard.html`

---

### `admin/dashboard.html`

- On page load → check `localStorage` for `adminSession` → if missing, redirect to `login.html`
- Top navbar showing admin name and a Logout button
  - Logout clears `adminSession` from `localStorage` and redirects to `login.html`
- Fetch all jobs from `localStorage` key `"jobs"` and render them as a simple table or card list
- Each row/card shows: Title, Company, Role, Type, Location, Posted Date, Status
- A prominent **"+ New Job Posting"** button at the top → navigates to `post-job.html`
- If no jobs exist yet, show: "No jobs posted yet"

---

### `admin/post-job.html`

- On page load → check `adminSession` in `localStorage` → if missing, redirect to `login.html`
- Render a form with these fields mapped to the Universal Schema:

| Field Label | Input Type | Maps To |
|---|---|---|
| Job Title | text input | `jobDetails.title` |
| Company Name | text input | `jobDetails.company` |
| Role / Department | text input | `jobDetails.role` |
| Job Type | dropdown | `jobDetails.type` |
| Location | text input | `jobDetails.location` |
| Experience Required | dropdown | `requirements.experience` |
| Skills Required | text input (comma-separated) | `requirements.skills` → split by comma into array |
| Education | text input | `requirements.education` |
| Salary | number input | `compensation.salary` |
| Currency | dropdown | `compensation.currency` |
| Salary Period | dropdown | `compensation.period` |
| Job Summary | textarea | `description.summary` |
| Responsibilities | textarea (one per line) | `description.responsibilities` → split by newline into array |
| Benefits | textarea (one per line) | `description.benefits` → split by newline into array |

- On form submit:
  1. Read all field values
  2. Build one object using the Universal JSON Schema exactly
  3. Set `id` = `Date.now().toString()`
  4. Set `meta.createdAt` = `new Date().toISOString()`
  5. Set `meta.createdBy` = `adminSession.email` from `localStorage`
  6. Set `meta.status` = `"active"`
  7. Push object into `jobs` array in `localStorage`
  8. Redirect back to `dashboard.html`

---

## Section 2 — User

### `user/register.html`

- Form with: Full Name, Email, Password, Confirm Password
- On submit → validate that passwords match → if not, show inline error
- Check if email already exists in `localStorage` key `"users"` → if yes, show "Email already registered"
- On success → build user object and push to `users` array in `localStorage`:

```json
{
  "id": "Date.now().toString()",
  "name": "string",
  "email": "string",
  "password": "string",
  "registeredAt": "ISO timestamp",
  "savedJobs": []
}
```

- After saving → redirect to `login.html`
- Show a link: "Already have an account? Login"

---

### `user/login.html`

- Form with Email and Password fields
- On submit → read `users` array from `localStorage` → match credentials
- On match → save matched user object to `localStorage` as `userSession` → redirect to `jobs.html`
- On fail → show inline error: "Invalid email or password"
- On page load → if `userSession` already exists, redirect to `jobs.html`
- Show a link: "Don't have an account? Register"

---

### `user/jobs.html`

- On page load → check `localStorage` for `userSession` → if missing, redirect to `login.html`
- Show top navbar with logged-in user's name and a Logout button
  - Logout clears `userSession` and redirects to `login.html`
- Read all jobs from `localStorage` key `"jobs"` and render as cards
- Each card shows: Title, Company, Role, Experience, Salary + Currency + Period, Location, Type, Posted Date, and a **"View Details"** button
- **Search and Filter bar** above the cards with:
  - Text input → keyword search (matches title, company, role, summary)
  - Dropdown → filter by Role (dynamically populated from loaded jobs)
  - Dropdown → filter by Job Type
  - Dropdown → filter by Experience
  - Number input → minimum salary filter
- On any input change → run JS filter against full jobs array → re-render matching cards only
- If no results → show: "No jobs found matching your search"

---

### `user/job-detail.html`

- When user clicks "View Details" on any job card → store that job's `id` in `localStorage` as `"selectedJobId"` → navigate to `job-detail.html`
- On page load → read `selectedJobId` → read full `jobs` array → find the matching job → render all fields:
  - Title, Company, Role, Type, Location
  - Experience, Skills (as tags or comma list), Education
  - Salary + Currency + Period
  - Summary, Responsibilities (as bullet list), Benefits (as bullet list)
  - Posted Date and Status
- **"Save Job"** button → on click, push job `id` into `userSession.savedJobs` in `localStorage` and update `userSession`
  - If job already saved, change button text to "Job Saved ✓" and disable it
- **"Back to Jobs"** link → navigates back to `jobs.html`

---

## localStorage Key Reference

| Key | Type | Set By | Read By |
|---|---|---|---|
| `"adminSession"` | Object | Admin login | Admin pages |
| `"jobs"` | Array of job objects | Admin post-job form | Admin dashboard, User jobs page |
| `"users"` | Array of user objects | User registration | User login |
| `"userSession"` | Object | User login | User pages |
| `"selectedJobId"` | String | User jobs page | User job-detail page |

---

## JS Rules

- All admin JS goes in `admin/admin.js` — no inline scripts in HTML
- All user JS goes in `user/user.js` — no inline scripts in HTML
- Use `async/await` for all fetch calls
- Use `DOMContentLoaded` event to run page-specific logic
- Detect which page you are on by checking `window.location.pathname` or use separate functions per page called inside `DOMContentLoaded`
- No jQuery, no React, no Tailwind, no external libraries

---

## Build Sequence

1. Create folder structure
2. Create `data/admins.json`
3. Build `admin/login.html` + admin auth logic in `admin.js`
4. Build `admin/post-job.html` + universal schema mapping logic in `admin.js`
5. Build `admin/dashboard.html` + job listing from localStorage in `admin.js`
6. Build `user/register.html` + registration logic in `user.js`
7. Build `user/login.html` + user auth logic in `user.js`
8. Build `user/jobs.html` + search/filter logic in `user.js`
9. Build `user/job-detail.html` + detail render + save job in `user.js`