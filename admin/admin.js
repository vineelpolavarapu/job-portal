/* =========================================================
   admin/admin.js — Job Portal Admin SPA Logic
   =========================================================
   Loaded by admin/index.html which contains all three
   admin views as hidden <div data-page> sections.

   Navigation model:
     navigateTo('login')     → shows #page-login
     navigateTo('dashboard') → shows #page-dashboard
     navigateTo('post-job')  → shows #page-post-job

   HTML attributes used for navigation:
     data-nav="page-name"  → calls navigateTo()
     data-action="logout"  → clears session + goes to login

   Section map:
     1. localStorage Helpers
     2. Formatting Utilities
     3. UI Helpers (error display)
     4. SPA Router
     5. Global Click Dispatcher
     6. Entry Point — DOMContentLoaded
     7. Login Page
     8. Dashboard Page
     9. Post Job Page
   ========================================================= */

'use strict';


/* =========================================================
   SECTION 1: localStorage Helpers
   ========================================================= */

function getJobs() {
  try { return JSON.parse(localStorage.getItem('jobs') || '[]'); }
  catch (e) { return []; }
}

function saveJobs(jobs) {
  localStorage.setItem('jobs', JSON.stringify(jobs));
}

function getAdminSession() {
  try { return JSON.parse(localStorage.getItem('adminSession') || 'null'); }
  catch (e) { return null; }
}

function saveAdminSession(session) {
  localStorage.setItem('adminSession', JSON.stringify(session));
}

function clearAdminSession() {
  localStorage.removeItem('adminSession');
}


/* =========================================================
   SECTION 2: Formatting Utilities
   ========================================================= */

/* ISO timestamp → "Jan 1, 2024" */
function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('en-US',
    { year: 'numeric', month: 'short', day: 'numeric' });
}

/* salary + currency + period → "USD 80,000 / Annual" */
function formatSalary(salary, currency, period) {
  const num = Number(salary);
  if (isNaN(num)) return '—';
  return `${currency} ${num.toLocaleString('en-US')} / ${period}`;
}

/* Escape strings before inserting into innerHTML */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


/* =========================================================
   SECTION 3: UI Helpers — Error Display
   ========================================================= */

/* Show message by element ID; pass '' to hide */
function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (message) { el.textContent = message; el.classList.add('visible'); }
  else { el.classList.remove('visible'); }
}

function clearErrors(ids) {
  ids.forEach(id => showError(id, ''));
}


/* =========================================================
   SECTION 4: SPA Router — navigateTo(page)
   Hides all [data-page] sections, shows the target one,
   updates document.title, and refreshes dynamic content.
   ========================================================= */

const ADMIN_PAGE_TITLES = {
  'login':     'Admin Login — Job Portal',
  'dashboard': 'Dashboard — Job Portal Admin',
  'post-job':  'Post a Job — Job Portal Admin'
};

function navigateTo(page) {
  /* Update browser tab title */
  document.title = ADMIN_PAGE_TITLES[page] || 'Job Portal Admin';

  /* Hide all page sections */
  document.querySelectorAll('[data-page]').forEach(p => { p.hidden = true; });

  /* Show the target section */
  const target = document.getElementById('page-' + page);
  if (target) target.hidden = false;

  /* Refresh page-specific dynamic content */
  if (page === 'dashboard') refreshDashboard();
  if (page === 'post-job')  refreshPostJob();
  if (page === 'login')     resetLoginForm();
}


/* =========================================================
   SECTION 5: Global Click Dispatcher
   Intercepts all clicks on elements with data-nav or
   data-action attributes so the HTML stays script-free.
   ========================================================= */

document.addEventListener('click', e => {
  /* ── data-nav: navigate to a page section ── */
  const navEl = e.target.closest('[data-nav]');
  if (navEl) {
    e.preventDefault();
    navigateTo(navEl.dataset.nav);
    return;
  }

  /* ── data-action="logout": clear session and go to login ── */
  if (e.target.closest('[data-action="logout"]')) {
    clearAdminSession();
    navigateTo('login');
  }
});


/* =========================================================
   SECTION 6: Entry Point — DOMContentLoaded
   Seeds demo jobs on first run, attaches all form listeners
   once, then navigates to the appropriate starting page.
   ========================================================= */

/* Load data/jobs.json into localStorage if no jobs exist yet */
async function seedJobsIfEmpty() {
  if (getJobs().length > 0) return;
  try {
    const response = await fetch('../data/jobs.json');
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data.jobs) && data.jobs.length > 0) {
      saveJobs(data.jobs);
    }
  } catch (e) { /* silently skip if file unavailable */ }
}

document.addEventListener('DOMContentLoaded', async () => {
  /* Seed 20 demo jobs on first run */
  await seedJobsIfEmpty();

  /* Attach all event listeners (forms, buttons) once */
  attachLoginForm();
  attachPostJobForm();

  /* Navigate to dashboard if already logged in, else login */
  navigateTo(getAdminSession() ? 'dashboard' : 'login');
});


/* =========================================================
   SECTION 7: Login Page
   Fetches ../data/admins.json, matches credentials,
   saves adminSession, navigates to dashboard.
   ========================================================= */

/* Reset login form state when returning to it */
function resetLoginForm() {
  const form = document.getElementById('adminLoginForm');
  if (form) form.reset();
  const globalError = document.getElementById('loginGlobalError');
  if (globalError) globalError.classList.remove('visible');
  clearErrors(['loginEmailError', 'loginPasswordError']);
}

function attachLoginForm() {
  const form = document.getElementById('adminLoginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailInput  = document.getElementById('loginEmail');
    const passInput   = document.getElementById('loginPassword');
    const submitBtn   = document.getElementById('loginSubmitBtn');
    const globalError = document.getElementById('loginGlobalError');

    const email    = emailInput.value.trim();
    const password = passInput.value;

    /* Clear previous errors */
    clearErrors(['loginEmailError', 'loginPasswordError']);
    globalError.classList.remove('visible');

    /* Validate */
    let hasError = false;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('loginEmailError', 'Please enter a valid email address.');
      hasError = true;
    }
    if (!password) {
      showError('loginPasswordError', 'Password is required.');
      hasError = true;
    }
    if (hasError) return;

    /* Disable button during fetch */
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const response = await fetch('../data/admins.json');
      if (!response.ok) throw new Error('Could not load admin data.');

      const data    = await response.json();
      const admins  = data.admins || [];
      const matched = admins.find(
        a => a.email.toLowerCase() === email.toLowerCase() && a.password === password
      );

      if (matched) {
        /* Save minimal session (no password) and go to dashboard */
        saveAdminSession({ id: matched.id, name: matched.name, email: matched.email });
        navigateTo('dashboard');
      } else {
        globalError.textContent = 'Invalid admin credentials. Please check your email and password.';
        globalError.classList.add('visible');
      }
    } catch (err) {
      globalError.textContent = 'An error occurred: ' + err.message;
      globalError.classList.add('visible');
    } finally {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Sign In';
    }
  });
}


/* =========================================================
   SECTION 8: Dashboard Page
   refreshDashboard() is called every time the dashboard
   section is shown — updates admin name, stats, and table.
   deleteJob() is exposed globally for table row onclick.
   ========================================================= */

function refreshDashboard() {
  const session = getAdminSession();
  if (!session) { navigateTo('login'); return; }

  /* Inject admin name into navbar */
  const adminNameEl = document.getElementById('dashAdminName');
  if (adminNameEl) adminNameEl.textContent = 'Welcome, ' + session.name;

  renderDashboard();
}

/* Re-builds stats counters and jobs table */
function renderDashboard() {
  const jobs      = getJobs();
  const container = document.getElementById('tableContainer');
  if (!container) return;

  /* Update stat counters */
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('statTotal',    jobs.length);
  set('statActive',   jobs.filter(j => j.meta?.status === 'active').length);
  set('statFullTime', jobs.filter(j => j.jobDetails?.type === 'Full-Time').length);
  set('statIntern',   jobs.filter(j => j.jobDetails?.type === 'Internship').length);

  /* Empty state */
  if (jobs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.1 15.9 0 13.36 0c-1.46 0-2.73.67-3.6 1.72L12 4.5l2.23-2.78C14.85 1.28 15.59 1 16.36 1 18.36 1 20 2.64 20 4.64c0 1.01-.39 1.93-1.03 2.63L12 14 5.03 7.27C4.39 6.57 4 5.65 4 4.64 4 2.64 5.64 1 7.64 1c.77 0 1.51.28 2.13.72L12 4.5l2.24-2.78C13.37.67 12.1 0 10.64 0 8.1 0 6 2.1 6 4.64c0 .48.11.92.18 1.36H4C2.9 6 2 6.9 2 8v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 14H4V8h16v12z"/></svg>
        <h3>No jobs posted yet</h3>
        <p>Create your first job posting to get started.</p>
        <button class="btn btn-accent" data-nav="post-job" style="margin-top:12px;">
          + Post First Job
        </button>
      </div>`;
    return;
  }

  /* Build table rows */
  const rows = jobs.map(job => {
    const d = job.jobDetails || {};
    const m = job.meta       || {};
    const statusCls = m.status === 'active' ? 'badge badge-active' : 'badge badge-inactive';
    return `
      <tr>
        <td class="td-title">${escapeHtml(d.title || '—')}</td>
        <td>${escapeHtml(d.company || '—')}</td>
        <td>${escapeHtml(d.role || '—')}</td>
        <td><span class="badge badge-type">${escapeHtml(d.type || '—')}</span></td>
        <td>${escapeHtml(d.location || '—')}</td>
        <td class="muted">${formatDate(m.createdAt)}</td>
        <td><span class="${statusCls}">${escapeHtml(m.status || 'active')}</span></td>
        <td><button class="btn btn-danger-sm" onclick="deleteJob('${escapeHtml(job.id)}')">Delete</button></td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Title</th><th>Company</th><th>Role</th><th>Type</th>
            <th>Location</th><th>Posted Date</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* Delete job by ID — exposed globally for onclick in table rows */
function deleteJob(jobId) {
  if (!confirm('Delete this job posting? This cannot be undone.')) return;
  saveJobs(getJobs().filter(j => j.id !== jobId));
  renderDashboard();
}
window.deleteJob = deleteJob;


/* =========================================================
   SECTION 9: Post Job Page
   refreshPostJob() injects admin name on each visit.
   attachPostJobForm() handles the submit event once.
   resetPostJobForm() clears form state on each visit.
   ========================================================= */

/* Inject admin name and reset form every time this page is shown */
function refreshPostJob() {
  const session = getAdminSession();
  if (!session) { navigateTo('login'); return; }

  const adminNameEl = document.getElementById('postJobAdminName');
  if (adminNameEl) adminNameEl.textContent = 'Welcome, ' + session.name;

  resetPostJobForm();
}

/* Clear all form fields and error states */
function resetPostJobForm() {
  const form = document.getElementById('postJobForm');
  if (form) form.reset();
  clearErrors([
    'titleError', 'companyError', 'roleError', 'typeError', 'locationError',
    'experienceError', 'educationError', 'skillsError',
    'salaryError', 'currencyError', 'periodError',
    'summaryError', 'responsibilitiesError', 'benefitsError'
  ]);
  const submitBtn = document.getElementById('postJobSubmitBtn');
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Post Job'; }
}

function attachPostJobForm() {
  const form = document.getElementById('postJobForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const session = getAdminSession();
    if (!session) { navigateTo('login'); return; }

    /* Read all field values */
    const title               = document.getElementById('jobTitle').value.trim();
    const company             = document.getElementById('jobCompany').value.trim();
    const role                = document.getElementById('jobRole').value.trim();
    const type                = document.getElementById('jobType').value;
    const location            = document.getElementById('jobLocation').value.trim();
    const experience          = document.getElementById('jobExperience').value;
    const education           = document.getElementById('jobEducation').value.trim();
    const skillsRaw           = document.getElementById('jobSkills').value.trim();
    const salaryRaw           = document.getElementById('jobSalary').value.trim();
    const currency            = document.getElementById('jobCurrency').value;
    const period              = document.getElementById('jobPeriod').value;
    const summary             = document.getElementById('jobSummary').value.trim();
    const responsibilitiesRaw = document.getElementById('jobResponsibilities').value.trim();
    const benefitsRaw         = document.getElementById('jobBenefits').value.trim();

    /* Clear previous errors */
    clearErrors([
      'titleError', 'companyError', 'roleError', 'typeError', 'locationError',
      'experienceError', 'educationError', 'skillsError',
      'salaryError', 'currencyError', 'periodError',
      'summaryError', 'responsibilitiesError', 'benefitsError'
    ]);

    /* Validate all required fields */
    let hasError = false;
    if (!title)              { showError('titleError',           'Job title is required.');              hasError = true; }
    if (!company)            { showError('companyError',          'Company name is required.');           hasError = true; }
    if (!role)               { showError('roleError',             'Role is required.');                   hasError = true; }
    if (!type)               { showError('typeError',             'Please select a job type.');           hasError = true; }
    if (!location)           { showError('locationError',         'Location is required.');               hasError = true; }
    if (!experience)         { showError('experienceError',       'Please select an experience level.');  hasError = true; }
    if (!education)          { showError('educationError',        'Education is required.');              hasError = true; }
    if (!skillsRaw)          { showError('skillsError',           'At least one skill is required.');     hasError = true; }
    if (!salaryRaw || isNaN(Number(salaryRaw)) || Number(salaryRaw) < 0)
                             { showError('salaryError',           'Please enter a valid salary.');        hasError = true; }
    if (!currency)           { showError('currencyError',         'Please select a currency.');           hasError = true; }
    if (!period)             { showError('periodError',           'Please select a pay period.');         hasError = true; }
    if (!summary)            { showError('summaryError',          'Job summary is required.');            hasError = true; }
    if (!responsibilitiesRaw){ showError('responsibilitiesError', 'At least one responsibility required.'); hasError = true; }
    if (!benefitsRaw)        { showError('benefitsError',         'At least one benefit required.');      hasError = true; }

    if (hasError) {
      const firstErr = form.querySelector('.error-msg.visible');
      if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    /* Parse array fields */
    const skills           = skillsRaw.split(',').map(s => s.trim()).filter(Boolean);
    const responsibilities = responsibilitiesRaw.split('\n').map(s => s.trim()).filter(Boolean);
    const benefits         = benefitsRaw.split('\n').map(s => s.trim()).filter(Boolean);

    /* Build Universal Job Schema object */
    const job = {
      id: Date.now().toString(),
      meta: {
        createdAt: new Date().toISOString(),
        createdBy: session.email,
        status: 'active'
      },
      jobDetails:   { title, company, role, type, location },
      requirements: { experience, skills, education },
      compensation: { salary: Number(salaryRaw), currency, period },
      description:  { summary, responsibilities, benefits }
    };

    /* Save and navigate to dashboard */
    const jobs = getJobs();
    jobs.unshift(job);     /* newest first */
    saveJobs(jobs);
    navigateTo('dashboard');
  });
}
