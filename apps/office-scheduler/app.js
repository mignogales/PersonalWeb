const LEGACY_API_BASE_KEY = "office-scheduler-api-base";
const SESSION_KEY = "office-scheduler-session";
const CONFIG_JSON_PATH = "config.json";
const LOCAL_API_BASE = "http://127.0.0.1:8789";
const runtimeConfig = await loadRuntimeConfig();

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
  apiBase: normalizeApiBase(runtimeConfig.apiBase || getLocalApiFallback()),
  token: "",
  userName: "",
  schedule: {},
  selectedDates: new Set(),
  visibleMonth: startOfMonth(new Date()),
  dirty: false
};

todayLabel.textContent = formatLongDate(toDateKey(new Date()));
clearLegacyApiBase();
setStatus(
  loginStatus,
  state.apiBase
    ? "Backend configured. Sign in when the Pi API is running."
    : "Backend is not configured yet.",
  state.apiBase ? "" : "error"
);

restoreSession();
renderShell();

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const password = passwordInput.value;

  setStatus(loginStatus, "Signing in...");

  try {
    const result = await apiRequest("/api/login", {
      method: "POST",
      body: {
        name,
        password
      },
      includeAuth: false
    });

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
  }
});

logoutButton.addEventListener("click", () => {
  clearSession();
  state.token = "";
  state.userName = "";
  state.schedule = {};
  state.selectedDates = new Set();
  state.dirty = false;
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
  saveButton.disabled = true;
  setStatus(calendarStatus, "Saving days...");

  try {
    const result = await apiRequest("/api/schedule/me", {
      method: "PUT",
      body: {
        dates: Array.from(state.selectedDates).sort()
      }
    });

    state.schedule = result.schedule.dates || {};
    syncSelectedDatesFromSchedule();
    state.dirty = false;
    setStatus(calendarStatus, "Days saved.", "success");
    renderCalendar();
  } catch (error) {
    setStatus(calendarStatus, error.message || "Could not save days.", "error");
  } finally {
    saveButton.disabled = false;
  }
});

calendarGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".day-button");

  if (!button) {
    return;
  }

  const dateKey = button.dataset.date;

  if (state.selectedDates.has(dateKey)) {
    state.selectedDates.delete(dateKey);
  } else {
    state.selectedDates.add(dateKey);
  }

  state.dirty = true;
  setStatus(calendarStatus, "Unsaved changes.");
  renderCalendar();
});

async function refreshSchedule() {
  if (!state.token) {
    return;
  }

  try {
    const result = await apiRequest("/api/schedule");
    state.schedule = result.schedule.dates || {};
    syncSelectedDatesFromSchedule();
    setStatus(calendarStatus, "Calendar loaded.", "success");
  } catch (error) {
    clearSession();
    state.token = "";
    state.userName = "";
    setStatus(loginStatus, error.message || "Please sign in again.", "error");
  }

  renderShell();
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

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index
    );
    const dateKey = toDateKey(date);
    const names = state.schedule[dateKey] || [];
    const isSelected = state.selectedDates.has(dateKey);
    const isCurrentMonth = date.getMonth() === month;
    const button = document.createElement("button");
    button.type = "button";
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
  const count = state.selectedDates.size;
  selectionSummary.textContent = `${count} office ${count === 1 ? "day" : "days"} selected.`;
  saveButton.textContent = state.dirty ? "Save changes" : "Save days";
}

function renderMonthList() {
  const year = state.visibleMonth.getFullYear();
  const month = state.visibleMonth.getMonth();
  const monthDates = Object.entries(state.schedule)
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
}

async function apiRequest(path, options = {}) {
  if (!state.apiBase) {
    throw new Error(getApiNotConfiguredMessage());
  }

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
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch {
    throw new Error("Office Scheduler API is not reachable. Start the Pi backend or check the tunnel/config URL.");
  }

  let payload = {};

  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with ${response.status}.`);
  }

  return payload;
}

function saveSession(expiresAt) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({
    token: state.token,
    userName: state.userName,
    expiresAt
  }));
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
  window.localStorage.removeItem(SESSION_KEY);
}

function clearLegacyApiBase() {
  try {
    window.localStorage.removeItem(LEGACY_API_BASE_KEY);
  } catch {
    // Old editable API values are intentionally ignored now.
  }
}

async function loadRuntimeConfig() {
  const inlineConfig = getInlineConfig();

  if (inlineConfig.apiBase) {
    return inlineConfig;
  }

  return getCloudflareConfig();
}

function getInlineConfig() {
  const config = window.OFFICE_SCHEDULER_CONFIG || {};
  return {
    apiBase: config.apiBase || window.OFFICE_API_BASE || ""
  };
}

async function getCloudflareConfig() {
  if (window.location.protocol === "file:") {
    return {};
  }

  try {
    const response = await fetch(CONFIG_JSON_PATH, {
      cache: "no-store"
    });

    if (!response.ok) {
      return {};
    }

    const config = await response.json();
    return {
      apiBase: config.apiBase || ""
    };
  } catch {
    return {};
  }
}

function getLocalApiFallback() {
  const hostname = window.location.hostname;
  const isLocalPage =
    window.location.protocol === "file:" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1";

  return isLocalPage ? LOCAL_API_BASE : "";
}

function normalizeApiBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function getApiNotConfiguredMessage() {
  return "Office Scheduler API is not configured. Add apps/office-scheduler/config.js locally or set OFFICE_SCHEDULER_API_BASE in Cloudflare.";
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
