const LEGACY_API_BASE_KEY = "office-scheduler-api-base";
const SESSION_KEY = "office-scheduler-session";

const loginView = document.getElementById("login-view");
const calendarView = document.getElementById("calendar-view");
const loginForm = document.getElementById("login-form");
const nameInput = document.getElementById("name-input");
const passwordInput = document.getElementById("password-input");
const loginStatus = document.getElementById("login-status");
const calendarStatus = document.getElementById("calendar-status");
const todayLabel = document.getElementById("today-label");
const logoutButton = document.getElementById("logout-button");
const signedInName = document.getElementById("signed-in-name");
const selectionSummary = document.getElementById("selection-summary");
const saveButton = document.getElementById("save-button");
const previousMonthButton = document.getElementById("previous-month");
const nextMonthButton = document.getElementById("next-month");
const calendarTitle = document.getElementById("calendar-title");
const calendarGrid = document.getElementById("calendar-grid");
const monthList = document.getElementById("month-list");
const monthCount = document.getElementById("month-count");

const state = {
  apiBase: "/api/office",
  token: "",
  userName: "",
  schedule: {},
  selectedDates: new Set(),
  visibleMonth: startOfMonth(new Date()),
  generation: 0,
  saving: false,
  refreshing: false,
  changes: {},
  dirty: false
};

todayLabel.textContent = formatLongDate(toDateKey(new Date()));
clearLegacyApiBase();
setStatus(
  loginStatus,
  "Sign in to see your team’s plans and choose your office days.",
  state.apiBase ? "" : "error"
);

restoreSession();
renderShell();

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const password = passwordInput.value;

  const submit = loginForm.querySelector("button[type=submit]");
  submit.disabled = true;
  setStatus(loginStatus, "Signing in...");

  try {
    const result = await apiRequest("/login", {
      method: "POST",
      body: {
        name,
        password
      },
      includeAuth: false
    });

    state.changes = {};
    state.dirty = false;
    state.token = result.token;
    state.userName = result.user.name;
    state.schedule = result.schedule.dates || {};
    syncSelectedDatesFromSchedule();
    saveSession(result.expiresAt);
    passwordInput.value = "";
    setStatus(calendarStatus, "Calendar loaded.", "success");
    renderShell();
  } catch (error) {
    setStatus(loginStatus, error.message || "Could not sign in.", "error");
  } finally {
    submit.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  if (state.dirty && !window.confirm("Sign out and discard your unsaved changes?")) return;
  try { await apiRequest("/logout", { method: "POST", body: {} }); } catch {
    setStatus(loginStatus, "Signed out on this device. The server session could not be revoked.");
  }
  clearSession();
  state.token = "";
  state.userName = "";
  state.schedule = {};
  state.selectedDates = new Set();
  state.dirty = false;
  state.changes = {};
  renderShell();
});

previousMonthButton.addEventListener("click", () => {
  state.visibleMonth = new Date(
    state.visibleMonth.getFullYear(),
    state.visibleMonth.getMonth() - 1,
    1
  );
  renderCalendar();
});

nextMonthButton.addEventListener("click", () => {
  state.visibleMonth = new Date(
    state.visibleMonth.getFullYear(),
    state.visibleMonth.getMonth() + 1,
    1
  );
  renderCalendar();
});

saveButton.addEventListener("click", async () => {
  if (state.saving || !state.dirty) return;
  state.generation += 1;
  state.saving = true;
  const token = state.token;
  saveButton.disabled = true;
  logoutButton.disabled = true;
  renderCalendar();
  setStatus(calendarStatus, "Saving days...");

  try {
    const result = await apiRequest("/schedule/me", {
      method: "PUT",
      body: {
        changes: { ...state.changes }
      }
    });

    if (token !== state.token) return;
    state.schedule = result.schedule.dates || {};
    state.changes = {};
    syncSelectedDatesFromSchedule();
    state.dirty = false;
    setStatus(calendarStatus, "Days saved.", "success");
    renderCalendar();
  } catch (error) {
    setStatus(calendarStatus, error.message || "Could not save days.", "error");
  } finally {
    state.saving = false;
    logoutButton.disabled = false;
    renderCalendar();
  }
});

calendarGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".day-button");

  if (!button || state.saving) {
    return;
  }

  const dateKey = button.dataset.date;

  if (state.selectedDates.has(dateKey)) {
    state.selectedDates.delete(dateKey);
  } else {
    state.selectedDates.add(dateKey);
  }

  const saved = (state.schedule[dateKey] || []).some(name => isSameName(name, state.userName));
  if (saved === state.selectedDates.has(dateKey)) delete state.changes[dateKey];
  else state.changes[dateKey] = state.selectedDates.has(dateKey);
  state.dirty = Object.keys(state.changes).length > 0;
  setStatus(calendarStatus, state.dirty ? "Unsaved changes. Save to share with your team." : "All changes saved.");
  renderCalendar();
});

async function refreshSchedule() {
  if (!state.token || state.refreshing || state.saving) return;
  state.refreshing = true;
  const generation = state.generation;
  const token = state.token;
  try {
    const result = await apiRequest("/schedule");
    if (token !== state.token || state.saving || generation !== state.generation) return;
    state.schedule = result.schedule.dates || {};
    syncSelectedDatesFromSchedule();
    setStatus(calendarStatus, state.dirty ? "Team updated. Your unsaved changes are kept." : "Up to date · shared with your team", "success");
  } catch (error) {
    if (token !== state.token) return;
    setStatus(calendarStatus, error.message, "error");
    if (error.status === 401 && !state.dirty) {
      clearSession();
      state.token = "";
      state.userName = "";
      setStatus(loginStatus, "Your session expired. Please sign in again.", "error");
    }
  } finally {
    state.refreshing = false;
    renderShell();
  }
}

setInterval(() => { if (!document.hidden) refreshSchedule(); }, 15000);
window.addEventListener("online", refreshSchedule);
window.addEventListener("focus", refreshSchedule);
window.addEventListener("beforeunload", event => {
  if (state.dirty) { event.preventDefault(); event.returnValue = ""; }
});
document.getElementById("today-button").addEventListener("click", () => {
  state.visibleMonth = startOfMonth(new Date());
  renderCalendar();
});
document.getElementById("refresh-button").addEventListener("click", refreshSchedule);
document.getElementById("discard-button").addEventListener("click", () => {
  state.changes = {};
  state.dirty = false;
  syncSelectedDatesFromSchedule();
  setStatus(calendarStatus, "Unsaved changes discarded.");
  renderCalendar();
});

function previewSchedule() {
  const schedule = Object.fromEntries(Object.entries(state.schedule).map(([day, names]) => [day, [...names]]));
  for (const [day, going] of Object.entries(state.changes)) {
    schedule[day] = (schedule[day] || []).filter(name => !isSameName(name, state.userName));
    if (going) schedule[day].push(state.userName);
  }
  return schedule;
}

function renderShell() {
  const isSignedIn = Boolean(state.token);
  loginView.hidden = isSignedIn;
  calendarView.hidden = !isSignedIn;
  logoutButton.hidden = !isSignedIn;

  if (isSignedIn) {
    signedInName.textContent = state.userName;
    renderCalendar();
  }
}

function renderCalendar() {
  calendarTitle.textContent = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric"
  }).format(state.visibleMonth);

  calendarGrid.replaceChildren();

  const year = state.visibleMonth.getFullYear();
  const month = state.visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);

  const preview = previewSchedule();
  const cells = Math.ceil((startOffset + new Date(year, month + 1, 0).getDate()) / 7) * 7;
  for (let index = 0; index < cells; index += 1) {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index
    );
    const dateKey = toDateKey(date);
    const names = preview[dateKey] || [];
    const isSelected = state.selectedDates.has(dateKey);
    const isCurrentMonth = date.getMonth() === month;
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = state.saving;
    button.className = [
      "day-button",
      isCurrentMonth ? "" : "is-muted",
      isSelected ? "is-selected" : "",
      dateKey === toDateKey(new Date()) ? "is-today" : ""
    ].filter(Boolean).join(" ");
    button.dataset.date = dateKey;
    button.setAttribute("aria-pressed", String(isSelected));
    button.setAttribute("aria-label", getDayLabel(dateKey, names, isSelected));

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = String(date.getDate());

    const namesWrap = document.createElement("span");
    namesWrap.className = "day-names";

    const visibleNames = names.slice(0, 3);
    visibleNames.forEach((name) => {
      const pill = document.createElement("span");
      pill.className = [
        "person-pill",
        isSameName(name, state.userName) ? "is-me" : ""
      ].filter(Boolean).join(" ");
      pill.textContent = name;
      namesWrap.append(pill);
    });

    if (names.length > visibleNames.length) {
      const extra = document.createElement("span");
      extra.className = "person-pill";
      extra.textContent = `+${names.length - visibleNames.length}`;
      namesWrap.append(extra);
    }

    button.append(number, document.createElement("span"), namesWrap);
    calendarGrid.append(button);
  }

  renderSummary();
  renderMonthList();
}

function renderSummary() {
  const prefix = `${state.visibleMonth.getFullYear()}-${String(state.visibleMonth.getMonth() + 1).padStart(2, "0")}`;
  const count = [...state.selectedDates].filter(day => day.startsWith(prefix)).length;
  selectionSummary.textContent = `${count} office ${count === 1 ? "day" : "days"} this month.`;
  saveButton.textContent = state.saving ? "Saving…" : state.dirty ? "Save changes" : "All changes saved";
  saveButton.disabled = state.saving || !state.dirty;
  document.getElementById("discard-button").disabled = state.saving || !state.dirty;
}

function renderMonthList() {
  const year = state.visibleMonth.getFullYear();
  const month = state.visibleMonth.getMonth();
  const monthDates = Object.entries(previewSchedule())
    .filter(([dateKey, names]) => {
      const date = parseDateKey(dateKey);
      return date.getFullYear() === year && date.getMonth() === month && names.length > 0;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  monthCount.textContent = String(monthDates.length);
  monthList.replaceChildren();

  if (monthDates.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No office days yet.";
    monthList.append(empty);
    return;
  }

  monthDates.forEach(([dateKey, names]) => {
    const item = document.createElement("article");
    item.className = "month-item";

    const date = document.createElement("strong");
    date.textContent = formatLongDate(dateKey);

    const people = document.createElement("span");
    people.textContent = names.join(", ");

    item.append(date, people);
    monthList.append(item);
  });
}

function syncSelectedDatesFromSchedule() {
  state.selectedDates = new Set(
    Object.entries(state.schedule)
      .filter(([, names]) => names.some((name) => isSameName(name, state.userName)))
      .map(([dateKey]) => dateKey)
  );
  for (const [day, going] of Object.entries(state.changes)) {
    if (going) state.selectedDates.add(day); else state.selectedDates.delete(day);
  }
}

async function apiRequest(path, options = {}) {
  const includeAuth = options.includeAuth !== false;
  const headers = {
    "Content-Type": "application/json"
  };

  if (includeAuth && state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  let response;

  try {
    response = await fetch(`${state.apiBase}${path}`, {
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch {
    throw new Error("Cannot reach the shared calendar. Check your connection and try again; unsaved selections are kept.");
  }

  let payload = {};

  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const error = new Error(payload.error || `Request failed with ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

function saveSession(expiresAt) {
  try { window.localStorage.setItem(SESSION_KEY, JSON.stringify({
    token: state.token,
    userName: state.userName,
    expiresAt
  })); } catch { /* The current session still works without persistent storage. */ }
}

function restoreSession() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SESSION_KEY) || "{}");
    const expiryTime = Date.parse(saved.expiresAt || "");

    if (!saved.token || !saved.userName || !Number.isFinite(expiryTime) || expiryTime <= Date.now()) {
      clearSession();
      return;
    }

    state.token = saved.token;
    state.userName = saved.userName;
    refreshSchedule();
  } catch {
    clearSession();
  }
}

function clearSession() {
  try { window.localStorage.removeItem(SESSION_KEY); } catch {}
}

function clearLegacyApiBase() {
  try {
    window.localStorage.removeItem(LEGACY_API_BASE_KEY);
  } catch {
    // Old editable API values are intentionally ignored now.
  }
}

function setStatus(element, message, kind = "") {
  element.textContent = message;
  element.dataset.kind = kind;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLongDate(dateKey) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parseDateKey(dateKey));
}

function getDayLabel(dateKey, names, isSelected) {
  const people = names.length > 0 ? ` People: ${names.join(", ")}.` : "";
  const selection = isSelected ? " You are going." : " You are not going.";
  return `${formatLongDate(dateKey)}.${people}${selection}`;
}

function isSameName(first, second) {
  return first.trim().toLowerCase() === second.trim().toLowerCase();
}
