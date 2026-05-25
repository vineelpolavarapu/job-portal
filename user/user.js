/* =========================================================
   user/user.js — Job Portal User SPA Logic
   =========================================================
   Loaded by user/index.html which contains all four
   user views as hidden <div data-page> sections.

   Navigation model:
     navigateTo('login')      → shows #page-login
     navigateTo('register')   → shows #page-register
     navigateTo('jobs')       → shows #page-jobs
     navigateTo('job-detail') → shows #page-job-detail

   HTML attributes used for navigation:
     data-nav="page-name"  → calls navigateTo()
     data-action="logout"  → clears session + goes to login

   Section map:
     1.  localStorage Helpers
     2.  Formatting Utilities
     3.  UI Helpers (error display)
     4.  SPA Router
     5.  Global Click Dispatcher
     6.  Entry Point — DOMContentLoaded
     7.  Login Page
     8.  Register Page
     9.  Jobs Page — filters, grid render
     10. Job Detail Page
     11. Save Job
   ========================================================= */

'use strict';


/* =========================================================
   SECTION 1: localStorage Helpers
   ========================================================= */

function getJobs() {
  try { return JSON.parse(localStorage.getItem('jobs') || '[]'); }
  catch (e) { return []; }
}

function getUsers() {
  try { return JSON.parse(localStorage.getItem('users') || '[]'); }
  catch (e) { return []; }
}

function saveUsers(users) {
  localStorage.setItem('users', JSON.stringify(users));
}

function getUserSession() {
  try { return JSON.parse(localStorage.getItem('userSession') || 'null'); }
  catch (e) { return null; }
}

function saveUserSession(session) {
  localStorage.setItem('userSession', JSON.stringify(session));
}

function clearUserSession() {
  localStorage.removeItem('userSession');
}

/* selectedJobId: set when user clicks a card, read on job-detail page */
function getSelectedJobId() {
  return localStorage.getItem('selectedJobId') || null;
}

function setSelectedJobId(id) {
  localStorage.setItem('selectedJobId', id);
}


/* =========================================================
   SECTION 2: Formatting Utilities
   ========================================================= */

function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('en-US',
    { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatSalary(salary, currency, period) {
  const num = Number(salary);
  if (isNaN(num)) return '—';
  return `${currency} ${num.toLocaleString('en-US')} / ${period}`;
}

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
   Hides all [data-page] sections, shows target,
   updates document.title, refreshes dynamic content.
   ========================================================= */

const USER_PAGE_TITLES = {
  'login':      'Login — Job Portal',
  'register':   'Register — Job Portal',
  'jobs':       'Browse Jobs — Job Portal',
  'job-detail': 'Job Details — Job Portal'
};

function navigateTo(page) {
  document.title = USER_PAGE_TITLES[page] || 'Job Portal';

  /* Hide all page sections */
  document.querySelectorAll('[data-page]').forEach(p => { p.hidden = true; });

  /* Show target section */
  const target = document.getElementById('page-' + page);
  if (target) target.hidden = false;

  /* Scroll to top on each navigation */
  window.scrollTo(0, 0);

  /* Refresh page-specific dynamic content */
  if (page === 'jobs')       refreshJobsPage();
  if (page === 'job-detail') refreshJobDetail();
  if (page === 'login')      resetLoginForm();
  if (page === 'register')   resetRegisterForm();
}


/* =========================================================
   SECTION 5: Global Click Dispatcher
   ========================================================= */

document.addEventListener('click', e => {
  /* data-nav: navigate to a section */
  const navEl = e.target.closest('[data-nav]');
  if (navEl) {
    e.preventDefault();
    navigateTo(navEl.dataset.nav);
    return;
  }

  /* data-action="logout": clear session and go to login */
  if (e.target.closest('[data-action="logout"]')) {
    clearUserSession();
    navigateTo('login');
  }
});


/* =========================================================
   SECTION 6: Entry Point — DOMContentLoaded
   Seeds demo jobs on first run, attaches all listeners once,
   then navigates to the appropriate starting page.
   ========================================================= */

/* Load data/jobs.json into localStorage if no jobs exist yet */
async function seedJobsIfEmpty() {
  if (getJobs().length > 0) return;
  try {
    const response = await fetch('../data/jobs.json');
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data.jobs) && data.jobs.length > 0) {
      localStorage.setItem('jobs', JSON.stringify(data.jobs));
    }
  } catch (e) { /* silently skip if file unavailable */ }
}

document.addEventListener('DOMContentLoaded', async () => {
  /* Seed 20 demo jobs on first run */
  await seedJobsIfEmpty();

  attachLoginForm();
  attachRegisterForm();
  attachFilterListeners();

  /* Start at jobs page if logged in, else login */
  navigateTo(getUserSession() ? 'jobs' : 'login');
});


/* =========================================================
   SECTION 7: Login Page
   ========================================================= */

function resetLoginForm() {
  const form = document.getElementById('userLoginForm');
  if (form) form.reset();
  const err = document.getElementById('loginGlobalError');
  if (err) err.classList.remove('visible');
  clearErrors(['loginEmailError', 'loginPasswordError']);
}

function attachLoginForm() {
  const form = document.getElementById('userLoginForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const email       = document.getElementById('loginEmail').value.trim();
    const password    = document.getElementById('loginPassword').value;
    const globalError = document.getElementById('loginGlobalError');

    clearErrors(['loginEmailError', 'loginPasswordError']);
    globalError.classList.remove('visible');

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

    /* Match credentials against localStorage "users" array */
    const matched = getUsers().find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (matched) {
      saveUserSession({ id: matched.id, name: matched.name, email: matched.email, savedJobs: matched.savedJobs || [] });
      navigateTo('jobs');
    } else {
      globalError.textContent = 'Invalid email or password. Please try again.';
      globalError.classList.add('visible');
    }
  });
}


/* =========================================================
   SECTION 8: Register Page
   ========================================================= */

function resetRegisterForm() {
  const form = document.getElementById('registerForm');
  if (form) form.reset();
  const err = document.getElementById('registerGlobalError');
  const suc = document.getElementById('registerGlobalSuccess');
  if (err) err.classList.remove('visible');
  if (suc) suc.classList.remove('visible');
  clearErrors(['fullNameError', 'regEmailError', 'regPasswordError', 'confirmPasswordError']);
  const btn = document.getElementById('registerSubmitBtn');
  if (btn) btn.disabled = false;
}

function attachRegisterForm() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const fullName        = document.getElementById('regFullName').value.trim();
    const email           = document.getElementById('regEmail').value.trim();
    const password        = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const globalError     = document.getElementById('registerGlobalError');
    const globalSuccess   = document.getElementById('registerGlobalSuccess');
    const submitBtn       = document.getElementById('registerSubmitBtn');

    clearErrors(['fullNameError', 'regEmailError', 'regPasswordError', 'confirmPasswordError']);
    globalError.classList.remove('visible');
    globalSuccess.classList.remove('visible');

    let hasError = false;
    if (!fullName) { showError('fullNameError', 'Full name is required.'); hasError = true; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('regEmailError', 'Please enter a valid email address.'); hasError = true;
    }
    if (!password || password.length < 6) {
      showError('regPasswordError', 'Password must be at least 6 characters.'); hasError = true;
    }
    if (password !== confirmPassword) {
      showError('confirmPasswordError', 'Passwords do not match.'); hasError = true;
    }
    if (hasError) return;

    /* Check for duplicate email */
    const users  = getUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      globalError.textContent = 'An account with this email already exists. Please login.';
      globalError.classList.add('visible');
      return;
    }

    /* Create and save new user */
    users.push({
      id:        Date.now().toString(),
      name:      fullName,
      email:     email,
      password:  password,
      savedJobs: [],
      createdAt: new Date().toISOString()
    });
    saveUsers(users);

    /* Show success then navigate to login */
    globalSuccess.textContent = 'Account created! Redirecting to login...';
    globalSuccess.classList.add('visible');
    submitBtn.disabled = true;

    setTimeout(() => navigateTo('login'), 1200);
  });
}


/* =========================================================
   SECTION 9: Jobs Page — Filters + Grid
   refreshJobsPage() is called every time the jobs section
   is shown. It reloads jobs, repopulates role dropdown,
   and re-renders the grid.
   Filter listeners are attached once in DOMContentLoaded.
   ========================================================= */

/* Module-level jobs array — reloaded on each jobs page visit */
let allJobs = [];

/* Called on each navigation to jobs page */
function refreshJobsPage() {
  const session = getUserSession();
  if (!session) { navigateTo('login'); return; }

  /* Update user name in navbar */
  const userNameEl = document.getElementById('jobsUserName');
  if (userNameEl) userNameEl.textContent = 'Hi, ' + session.name;

  /* Reload active jobs fresh from localStorage */
  allJobs = getJobs().filter(j => j.meta?.status === 'active');

  /* Rebuild role dropdown from current job data */
  populateRoleDropdown();

  /* Reset filter inputs and render all jobs */
  resetFilters();
  filterAndRender();
}

/* Resets all filter inputs to empty */
function resetFilters() {
  ['filterKeyword', 'filterRole', 'filterType', 'filterExperience', 'filterMinSalary']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
}

/* Populate the role dropdown from unique roles in loaded jobs */
function populateRoleDropdown() {
  const filterRole = document.getElementById('filterRole');
  if (!filterRole) return;

  const roles = [...new Set(
    allJobs.map(j => j.jobDetails?.role).filter(r => r && r.trim())
  )].sort();

  filterRole.innerHTML = '<option value="">All Roles</option>';
  roles.forEach(role => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = role;
    filterRole.appendChild(opt);
  });
}

/* Attach filter input/change listeners — called once in DOMContentLoaded */
function attachFilterListeners() {
  const keyword    = document.getElementById('filterKeyword');
  const role       = document.getElementById('filterRole');
  const type       = document.getElementById('filterType');
  const experience = document.getElementById('filterExperience');
  const minSalary  = document.getElementById('filterMinSalary');
  const clearBtn   = document.getElementById('clearFiltersBtn');

  if (keyword)    keyword.addEventListener('input',    filterAndRender);
  if (minSalary)  minSalary.addEventListener('input',  filterAndRender);
  if (role)       role.addEventListener('change',      filterAndRender);
  if (type)       type.addEventListener('change',      filterAndRender);
  if (experience) experience.addEventListener('change',filterAndRender);

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      resetFilters();
      filterAndRender();
    });
  }
}

/* Read current filter values from DOM */
function getFilterValues() {
  const val = id => (document.getElementById(id) || {}).value || '';
  return {
    keyword:    val('filterKeyword'),
    role:       val('filterRole'),
    type:       val('filterType'),
    experience: val('filterExperience'),
    minSalary:  parseFloat(val('filterMinSalary')) || 0
  };
}

/* Pure filter function — returns matching subset of jobs */
function filterJobs(jobs, filters) {
  return jobs.filter(job => {
    const d    = job.jobDetails   || {};
    const r    = job.requirements || {};
    const c    = job.compensation || {};
    const desc = job.description  || {};

    /* Keyword: matches title, company, role, or summary */
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      const searchable = [d.title, d.company, d.role, desc.summary].join(' ').toLowerCase();
      if (!searchable.includes(kw)) return false;
    }

    if (filters.role       && d.role       !== filters.role)       return false;
    if (filters.type       && d.type       !== filters.type)       return false;
    if (filters.experience && r.experience !== filters.experience) return false;
    if (filters.minSalary > 0 && Number(c.salary) < filters.minSalary) return false;

    return true;
  });
}

/* Filter allJobs and re-render grid with results */
function filterAndRender() {
  const filtered = filterJobs(allJobs, getFilterValues());

  const countEl = document.getElementById('resultsCount');
  if (countEl) countEl.textContent = `${filtered.length} job${filtered.length !== 1 ? 's' : ''} found`;

  renderJobCards(filtered);
}

/* Build and inject all job cards into the grid */
function renderJobCards(jobs) {
  const grid = document.getElementById('jobsGrid');
  if (!grid) return;

  if (jobs.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        <h3>No jobs found</h3>
        <p>Try adjusting your filters or search terms.</p>
      </div>`;
    return;
  }

  grid.innerHTML = jobs.map(buildJobCard).join('');

  /* "View Details" button click */
  grid.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      setSelectedJobId(btn.dataset.jobId);
      navigateTo('job-detail');
    });
  });

  /* Whole card click */
  grid.querySelectorAll('.job-card').forEach(card => {
    card.addEventListener('click', () => {
      setSelectedJobId(card.dataset.jobId);
      navigateTo('job-detail');
    });
  });
}

/* Returns an HTML string for a single job card */
function buildJobCard(job) {
  const d    = job.jobDetails   || {};
  const r    = job.requirements || {};
  const c    = job.compensation || {};
  const desc = job.description  || {};
  const salary = formatSalary(c.salary, c.currency, c.period);

  return `
    <div class="job-card" data-job-id="${escapeHtml(job.id)}">
      <div class="job-card-top">
        <div>
          <div class="job-title">${escapeHtml(d.title)}</div>
          <div class="job-company">${escapeHtml(d.company)}</div>
        </div>
        <span class="badge badge-type">${escapeHtml(d.type)}</span>
      </div>
      <div class="job-badges">
        <span class="badge badge-role">${escapeHtml(d.role)}</span>
      </div>
      <div class="job-meta">
        <div class="job-meta-row">
          <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          ${escapeHtml(d.location)}
        </div>
        <div class="job-meta-row">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
          ${escapeHtml(r.experience)}
        </div>
      </div>
      <p class="job-summary">${escapeHtml(desc.summary)}</p>
      <div class="job-card-footer">
        <span class="job-salary">${escapeHtml(salary)}</span>
        <button class="btn-view" data-job-id="${escapeHtml(job.id)}">View Details</button>
      </div>
    </div>`;
}


/* =========================================================
   SECTION 10: Job Detail Page
   refreshJobDetail() is called on each navigation to this
   section. It reads selectedJobId, finds the job, and
   rebuilds the full detail layout.
   ========================================================= */

function refreshJobDetail() {
  const session = getUserSession();
  if (!session) { navigateTo('login'); return; }

  /* Update user name in navbar */
  const userNameEl = document.getElementById('detailUserName');
  if (userNameEl) userNameEl.textContent = 'Hi, ' + session.name;

  /* Find selected job */
  const jobId    = getSelectedJobId();
  const job      = getJobs().find(j => j.id === jobId);
  const container = document.getElementById('jobDetailContent');
  if (!container) return;

  /* Job not found / deleted */
  if (!job) {
    container.innerHTML = `
      <div class="not-found">
        <h2>Job Not Found</h2>
        <p>This listing may have been removed.</p>
        <a href="#" data-nav="jobs">Browse all jobs</a>
      </div>`;
    return;
  }

  const d    = job.jobDetails   || {};
  const r    = job.requirements || {};
  const c    = job.compensation || {};
  const desc = job.description  || {};
  const m    = job.meta         || {};

  const salary         = formatSalary(c.salary, c.currency, c.period);
  const isAlreadySaved = (session.savedJobs || []).includes(job.id);
  const statusCls      = m.status === 'active' ? 'badge badge-active' : 'badge badge-inactive';

  /* Build list items */
  const respItems    = (desc.responsibilities || []).map(i => `<li>${escapeHtml(i)}</li>`).join('');
  const benefitItems = (desc.benefits         || []).map(i => `<li>${escapeHtml(i)}</li>`).join('');
  const skillTags    = (r.skills              || []).map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('');

  container.innerHTML = `
    <div class="detail-layout">

      <!-- Left: main job content -->
      <div class="left-col">

        <!-- Job header: title, company, badges -->
        <div class="job-header">
          <div class="job-header-top">
            <div>
              <h1 class="job-title">${escapeHtml(d.title)}</h1>
              <p class="job-company">${escapeHtml(d.company)}</p>
            </div>
            <span class="${statusCls}">${escapeHtml(m.status || 'active')}</span>
          </div>
          <div class="job-badges">
            <span class="badge badge-type">${escapeHtml(d.type)}</span>
            <span class="badge badge-role">${escapeHtml(d.role)}</span>
            <span class="badge badge-location">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:3px;">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              </svg>${escapeHtml(d.location)}
            </span>
          </div>
        </div>

        <!-- Summary -->
        <div class="section-card">
          <h2>
            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
            Job Summary
          </h2>
          <p class="summary-text">${escapeHtml(desc.summary)}</p>
        </div>

        <!-- Responsibilities -->
        ${respItems ? `
        <div class="section-card">
          <h2>
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            Responsibilities
          </h2>
          <ul class="detail-list">${respItems}</ul>
        </div>` : ''}

        <!-- Benefits -->
        ${benefitItems ? `
        <div class="section-card">
          <h2>
            <svg viewBox="0 0 24 24"><path d="M11.5 2C6.81 2 3 5.81 3 10.5S6.81 19 11.5 19h.5v3c4.86-2.34 8-7 8-11.5C20 5.81 16.19 2 11.5 2zm1 14.5h-2v-2h2v2zm0-4h-2c0-3.25 3-3 3-5 0-1.1-.9-2-2-2s-2 .9-2 2h-2c0-2.21 1.79-4 4-4s4 1.79 4 4c0 2.5-3 2.75-3 5z"/></svg>
            Benefits &amp; Perks
          </h2>
          <ul class="detail-list">${benefitItems}</ul>
        </div>` : ''}

      </div>

      <!-- Right: metadata sidebar -->
      <aside>
        <div class="meta-card">
          <h3>Job Details</h3>

          <div class="meta-row">
            <span class="meta-label">Salary</span>
            <span class="meta-value salary">${escapeHtml(salary)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Experience</span>
            <span class="meta-value">${escapeHtml(r.experience)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Education</span>
            <span class="meta-value">${escapeHtml(r.education)}</span>
          </div>
          ${skillTags ? `
          <div class="meta-row">
            <span class="meta-label">Skills Required</span>
            <div class="skills-tags">${skillTags}</div>
          </div>` : ''}

          <hr class="meta-divider" />

          <div class="meta-row">
            <span class="meta-label">Posted On</span>
            <span class="meta-value">${formatDate(m.createdAt)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Status</span>
            <span class="${statusCls}">${escapeHtml(m.status || 'active')}</span>
          </div>

          <!-- Save Job button -->
          <button class="save-btn" id="saveJobBtn" ${isAlreadySaved ? 'disabled' : ''}>
            ${isAlreadySaved
              ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Job Saved'
              : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg> Save Job'
            }
          </button>

        </div>
      </aside>

    </div>`;

  /* Attach Save Job handler if not already saved */
  if (!isAlreadySaved) {
    const saveBtn = document.getElementById('saveJobBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => saveJob(job.id));
  }
}


/* =========================================================
   SECTION 11: Save Job — saveJob(jobId)
   Adds jobId to userSession.savedJobs and syncs back
   into the "users" array so it persists across sessions.
   ========================================================= */

function saveJob(jobId) {
  const session = getUserSession();
  if (!session) return;

  const savedJobs = session.savedJobs || [];
  if (savedJobs.includes(jobId)) return;

  savedJobs.push(jobId);
  session.savedJobs = savedJobs;
  saveUserSession(session);

  /* Sync into persistent "users" array */
  const users   = getUsers();
  const userIdx = users.findIndex(u => u.id === session.id);
  if (userIdx !== -1) {
    users[userIdx].savedJobs = savedJobs;
    saveUsers(users);
  }

  /* Update button to saved state */
  const saveBtn = document.getElementById('saveJobBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg> Job Saved`;
  }
}
