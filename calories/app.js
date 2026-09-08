const state = {
  token: localStorage.getItem("calorie_token") || "",
  user: null,
  mediaRecorder: null,
  audioChunks: [],
  pendingSubmissions: 0,
};

const config = window.CALORIE_TRACKER_CONFIG || {};
const fileApiBaseUrl = window.location.protocol === "file:" ? "http://127.0.0.1:8000" : "";
const apiBaseUrl = (
  localStorage.getItem("calorie_api_base_url") ||
  config.apiBaseUrl ||
  fileApiBaseUrl ||
  ""
).replace(/\/$/, "");

const els = {
  apiStatus: document.querySelector("#apiStatus"),
  authView: document.querySelector("#authView"),
  appView: document.querySelector("#appView"),
  createUserForm: document.querySelector("#createUserForm"),
  loginForm: document.querySelector("#loginForm"),
  authMessage: document.querySelector("#authMessage"),
  username: document.querySelector("#username"),
  targetCalories: document.querySelector("#targetCalories"),
  targetProtein: document.querySelector("#targetProtein"),
  todayCalories: document.querySelector("#todayCalories"),
  todayProtein: document.querySelector("#todayProtein"),
  latestWeight: document.querySelector("#latestWeight"),
  logoutBtn: document.querySelector("#logoutBtn"),
  passwordForm: document.querySelector("#passwordForm"),
  savePasswordBtn: document.querySelector("#savePasswordBtn"),
  passwordState: document.querySelector("#passwordState"),
  settingsForm: document.querySelector("#settingsForm"),
  saveSettingsBtn: document.querySelector("#saveSettingsBtn"),
  settingsState: document.querySelector("#settingsState"),
  foodForm: document.querySelector("#foodForm"),
  weightForm: document.querySelector("#weightForm"),
  voicePanel: document.querySelector("#voicePanel"),
  tabs: document.querySelectorAll(".tab"),
  lastResult: document.querySelector("#lastResult"),
  logs: document.querySelector("#logs"),
  daily: document.querySelector("#daily"),
  calorieChart: document.querySelector("#calorieChart"),
  proteinChart: document.querySelector("#proteinChart"),
  weightChart: document.querySelector("#weightChart"),
  averageCalories: document.querySelector("#averageCalories"),
  averageProtein: document.querySelector("#averageProtein"),
  weightChange: document.querySelector("#weightChange"),
  refreshBtn: document.querySelector("#refreshBtn"),
  recordBtn: document.querySelector("#recordBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  voiceState: document.querySelector("#voiceState"),
  loggerState: document.querySelector("#loggerState"),
};

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof Blob)) {
    headers.set("Content-Type", "application/json");
  }
  if (state.token) {
    headers.set("X-Access-Token", state.token);
  }
  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || payload.message || `Request failed: ${response.status}`);
  }
  return payload;
}

function setResult(payload) {
  els.lastResult.textContent = JSON.stringify(payload, null, 2);
}

function setAuthMessage(message, isError = false) {
  els.authMessage.textContent = message;
  els.authMessage.classList.toggle("bad-text", isError);
}

function setLoggerState(message, type = "") {
  els.loggerState.textContent = message;
  els.loggerState.classList.toggle("bad-text", type === "error");
  els.loggerState.classList.toggle("good-text", type === "success");
  els.loggerState.classList.toggle("waiting-text", type === "waiting");
}

function beginSubmission(label, details = {}) {
  state.pendingSubmissions += 1;
  const submittedAt = new Date().toISOString();
  const pendingLabel = state.pendingSubmissions === 1 ? "item" : "items";
  setLoggerState(`${label} sent. ${state.pendingSubmissions} ${pendingLabel} processing...`, "waiting");
  setResult({
    status: "sent_for_processing",
    type: details.type,
    submitted_at: submittedAt,
    ...details,
  });

  return {
    submittedAt,
    finish(message, type = "success") {
      state.pendingSubmissions = Math.max(0, state.pendingSubmissions - 1);
      if (state.pendingSubmissions > 0) {
        const remainingLabel = state.pendingSubmissions === 1 ? "item" : "items";
        setLoggerState(`${message} ${state.pendingSubmissions} ${remainingLabel} still processing...`, type);
        return;
      }
      setLoggerState(message, type);
    },
  };
}

async function checkApi() {
  try {
    await api("/api/health");
    els.apiStatus.textContent = "API online";
    els.apiStatus.className = "status ok";
  } catch {
    els.apiStatus.textContent = "API offline";
    els.apiStatus.className = "status bad";
  }
}

async function loadMe() {
  if (!state.token) {
    showAuth();
    return;
  }
  try {
    const payload = await api("/api/me");
    state.user = payload.user;
    showApp();
    await refresh();
  } catch (error) {
    localStorage.removeItem("calorie_token");
    state.token = "";
    showAuth();
    setResult({ error: error.message });
  }
}

function showAuth() {
  els.authView.classList.remove("hidden");
  els.appView.classList.add("hidden");
}

function showApp() {
  els.authView.classList.add("hidden");
  els.appView.classList.remove("hidden");
  setAuthMessage("");
  els.username.textContent = state.user.username;
  els.targetCalories.textContent = `${state.user.calorie_target} kcal`;
  els.targetProtein.textContent = `${state.user.protein_target} g`;
  els.settingsForm.calorie_target.value = state.user.calorie_target;
  els.settingsForm.protein_target.value = state.user.protein_target;
  renderPasswordState();
}

function renderPasswordState(message = "") {
  els.savePasswordBtn.textContent = state.user?.has_password ? "Update password" : "Save password";
  els.passwordState.textContent = message || (state.user?.has_password ? "" : "Add a password before logging out.");
  els.passwordState.classList.remove("bad-text");
}

async function refresh() {
  const [logsPayload, summaryPayload] = await Promise.all([api("/api/logs"), api("/api/summary")]);
  renderLogs(logsPayload.logs);
  renderSummary(summaryPayload);
}

function renderLogs(logs) {
  if (!logs.length) {
    els.logs.innerHTML = `<p class="muted">No logs yet. Try "100 g patatas y 100 g pechuga de pollo".</p>`;
    return;
  }
  els.logs.innerHTML = logs
    .map((log) => {
      if (log.type === "weight_log") {
        return `
          <article class="log-item">
            <div class="log-head">
              <span>Weight</span>
              <div class="log-actions">
                <span>${formatDate(log.timestamp)}</span>
                <button class="danger ghost delete-log" type="button" data-log-type="weight" data-log-id="${log.id}">Delete</button>
              </div>
            </div>
            <strong>${log.weight_kg} kg</strong>
            <p class="muted">${escapeHtml(log.transcript || "")}</p>
          </article>
        `;
      }
      const rows = log.items
        .map(
          (item) => `
            <tr data-food-item-id="${item.id}">
              <td>
                <input
                  class="table-input food-item-name"
                  value="${escapeHtml(item.input_name || item.name)}"
                  aria-label="Food item name"
                />
              </td>
              <td>
                <div class="amount-edit">
                  <input
                    class="table-input amount-input"
                    type="number"
                    min="0.1"
                    max="10000"
                    step="0.1"
                    value="${item.amount_g ?? ""}"
                    aria-label="Amount in grams"
                  />
                  <span>g</span>
                </div>
              </td>
              <td>${item.calories ?? "-"}</td>
              <td>${item.protein_g ?? "-"}</td>
              <td>${item.carbs_g ?? "-"}</td>
              <td>${item.fat_g ?? "-"}</td>
              <td class="${item.status === "resolved" ? "" : "flag"}">${escapeHtml(item.status)}</td>
              <td><button class="secondary save-food-item" type="button">Save</button></td>
            </tr>
          `,
        )
        .join("");
      return `
        <article class="log-item">
          <div class="log-head">
            <span>Food</span>
            <div class="log-actions">
              <span>${formatDate(log.timestamp)}</span>
              <button class="danger ghost delete-log" type="button" data-log-type="food" data-log-id="${log.id}">Delete</button>
            </div>
          </div>
          <table class="item-table">
            <thead><tr><th>Item</th><th>Amount</th><th>kcal</th><th>P</th><th>C</th><th>F</th><th>Status</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p class="muted">${log.total_summary.calories} kcal total from resolved items.</p>
        </article>
      `;
    })
    .join("");
}

function renderSummary(summary) {
  state.user = summary.user;
  els.targetCalories.textContent = `${state.user.calorie_target} kcal`;
  els.targetProtein.textContent = `${state.user.protein_target} g`;
  els.settingsForm.calorie_target.value = state.user.calorie_target;
  els.settingsForm.protein_target.value = state.user.protein_target;
  const today = summary.today || new Date().toISOString().slice(0, 10);
  const todayRow = summary.daily.find((row) => row.day === today);
  els.todayCalories.textContent = `${todayRow?.calories || 0} kcal`;
  els.todayProtein.textContent = `${todayRow?.protein_g || 0} g`;
  els.latestWeight.textContent = summary.weights[0] ? `${summary.weights[0].weight_kg} kg` : "No data";
  renderProgressCharts(summary);

  if (!summary.daily.length) {
    els.daily.innerHTML = `<p class="muted">Daily totals appear after food logs.</p>`;
    return;
  }
  els.daily.innerHTML = summary.daily
    .map(
      (day) => `
        <article class="day-item">
          <span class="muted">${day.day}</span>
          <strong>${day.calories} kcal</strong>
          <span class="muted">P ${day.protein_g} g · C ${day.carbs_g} g · F ${day.fat_g} g</span>
        </article>
      `,
    )
    .join("");
}

function renderProgressCharts(summary) {
  const daily = [...summary.daily].reverse();
  const weights = [...summary.weights].reverse();
  renderCalorieChart(daily, summary.user.calorie_target);
  renderProteinChart(daily, summary.user.protein_target);
  renderWeightChart(weights);
}

function renderCalorieChart(daily, target) {
  if (!daily.length) {
    els.calorieChart.innerHTML = `<p class="muted empty-chart">Food logs will appear here as a calorie trend.</p>`;
    els.averageCalories.textContent = "0 kcal avg";
    return;
  }
  const width = 680;
  const height = 250;
  const padding = { top: 18, right: 18, bottom: 34, left: 46 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxCalories = Math.max(target, ...daily.map((day) => Number(day.calories) || 0), 100);
  const yMax = Math.ceil((maxCalories * 1.15) / 100) * 100;
  const barGap = 8;
  const barWidth = Math.max(10, (chartWidth - barGap * (daily.length - 1)) / daily.length);
  const yFor = (value) => padding.top + chartHeight - (Number(value) / yMax) * chartHeight;
  const targetY = yFor(target);
  const average = Math.round(daily.reduce((sum, day) => sum + (Number(day.calories) || 0), 0) / daily.length);

  const bars = daily
    .map((day, index) => {
      const calories = Number(day.calories) || 0;
      const x = padding.left + index * (barWidth + barGap);
      const y = yFor(calories);
      const h = padding.top + chartHeight - y;
      const label = formatShortDay(day.day);
      return `
        <g>
          <rect class="bar" x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="4"></rect>
          <text class="axis-label" x="${x + barWidth / 2}" y="${height - 10}" text-anchor="middle">${label}</text>
        </g>
      `;
    })
    .join("");

  els.averageCalories.textContent = `${average} kcal avg`;
  els.calorieChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily calories against goal">
      <line class="grid-line" x1="${padding.left}" x2="${width - padding.right}" y1="${padding.top}" y2="${padding.top}"></line>
      <line class="grid-line" x1="${padding.left}" x2="${width - padding.right}" y1="${padding.top + chartHeight}" y2="${padding.top + chartHeight}"></line>
      <text class="axis-label" x="8" y="${padding.top + 4}">${yMax}</text>
      <text class="axis-label" x="8" y="${padding.top + chartHeight + 4}">0</text>
      <line class="goal-line" x1="${padding.left}" x2="${width - padding.right}" y1="${targetY}" y2="${targetY}"></line>
      <text class="goal-label" x="${width - padding.right - 6}" y="${Math.max(14, targetY - 7)}" text-anchor="end">${target} kcal</text>
      ${bars}
    </svg>
  `;
}

function renderProteinChart(daily, target) {
  if (!daily.length) {
    els.proteinChart.innerHTML = `<p class="muted empty-chart">Food logs will appear here as a protein trend.</p>`;
    els.averageProtein.textContent = "0 g avg";
    return;
  }
  const width = 680;
  const height = 250;
  const padding = { top: 18, right: 18, bottom: 34, left: 46 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxProtein = Math.max(target, ...daily.map((day) => Number(day.protein_g) || 0), 10);
  const yMax = Math.ceil((maxProtein * 1.2) / 10) * 10;
  const barGap = 8;
  const barWidth = Math.max(10, (chartWidth - barGap * (daily.length - 1)) / daily.length);
  const yFor = (value) => padding.top + chartHeight - (Number(value) / yMax) * chartHeight;
  const targetY = yFor(target);
  const average = Math.round(daily.reduce((sum, day) => sum + (Number(day.protein_g) || 0), 0) / daily.length);

  const bars = daily
    .map((day, index) => {
      const protein = Number(day.protein_g) || 0;
      const x = padding.left + index * (barWidth + barGap);
      const y = yFor(protein);
      const h = padding.top + chartHeight - y;
      const label = formatShortDay(day.day);
      return `
        <g>
          <rect class="bar protein-bar" x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="4"></rect>
          <text class="axis-label" x="${x + barWidth / 2}" y="${height - 10}" text-anchor="middle">${label}</text>
        </g>
      `;
    })
    .join("");

  els.averageProtein.textContent = `${average} g avg`;
  els.proteinChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily protein against goal">
      <line class="grid-line" x1="${padding.left}" x2="${width - padding.right}" y1="${padding.top}" y2="${padding.top}"></line>
      <line class="grid-line" x1="${padding.left}" x2="${width - padding.right}" y1="${padding.top + chartHeight}" y2="${padding.top + chartHeight}"></line>
      <text class="axis-label" x="8" y="${padding.top + 4}">${yMax} g</text>
      <text class="axis-label" x="8" y="${padding.top + chartHeight + 4}">0</text>
      <line class="goal-line" x1="${padding.left}" x2="${width - padding.right}" y1="${targetY}" y2="${targetY}"></line>
      <text class="goal-label" x="${width - padding.right - 6}" y="${Math.max(14, targetY - 7)}" text-anchor="end">${target} g</text>
      ${bars}
    </svg>
  `;
}

function renderWeightChart(weights) {
  if (!weights.length) {
    els.weightChart.innerHTML = `<p class="muted empty-chart">Weight logs will appear here as a trend line.</p>`;
    els.weightChange.textContent = "No trend";
    return;
  }
  const width = 680;
  const height = 250;
  const padding = { top: 18, right: 18, bottom: 34, left: 46 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const values = weights.map((row) => Number(row.weight_kg));
  const minWeight = Math.min(...values);
  const maxWeight = Math.max(...values);
  const yMin = Math.floor((minWeight - 1) * 2) / 2;
  const yMax = Math.ceil((maxWeight + 1) * 2) / 2;
  const span = yMax - yMin || 1;
  const xFor = (index) => padding.left + (weights.length === 1 ? chartWidth / 2 : (index / (weights.length - 1)) * chartWidth);
  const yFor = (value) => padding.top + chartHeight - ((value - yMin) / span) * chartHeight;
  const points = weights.map((row, index) => `${xFor(index)},${yFor(Number(row.weight_kg))}`).join(" ");
  const dots = weights
    .map((row, index) => {
      const x = xFor(index);
      const y = yFor(Number(row.weight_kg));
      return `
        <g>
          <circle class="line-dot" cx="${x}" cy="${y}" r="4"></circle>
          <text class="axis-label" x="${x}" y="${height - 10}" text-anchor="middle">${formatShortDay(row.timestamp.slice(0, 10))}</text>
        </g>
      `;
    })
    .join("");
  const change = values[values.length - 1] - values[0];

  els.weightChange.textContent = weights.length > 1 ? `${formatSigned(change)} kg` : `${values[0]} kg`;
  els.weightChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Weight trend">
      <line class="grid-line" x1="${padding.left}" x2="${width - padding.right}" y1="${padding.top}" y2="${padding.top}"></line>
      <line class="grid-line" x1="${padding.left}" x2="${width - padding.right}" y1="${padding.top + chartHeight}" y2="${padding.top + chartHeight}"></line>
      <text class="axis-label" x="8" y="${padding.top + 4}">${yMax} kg</text>
      <text class="axis-label" x="8" y="${padding.top + chartHeight + 4}">${yMin} kg</text>
      <polyline class="weight-line" points="${points}"></polyline>
      ${dots}
    </svg>
  `;
}

els.createUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  try {
    const payload = await api("/api/users", {
      method: "POST",
      body: JSON.stringify({
        username: data.username,
        password: data.password,
        calorie_target: Number(data.calorie_target || 2200),
        protein_target: Number(data.protein_target || 140),
      }),
    });
    state.token = payload.token;
    localStorage.setItem("calorie_token", state.token);
    setResult({ status: "signed_in", user: payload.user });
    setAuthMessage("");
    await loadMe();
  } catch (error) {
    setAuthMessage(error.message, true);
  }
});

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  try {
    const payload = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: data.username,
        password: data.password,
      }),
    });
    state.token = payload.token;
    localStorage.setItem("calorie_token", state.token);
    setResult({ status: "signed_in", user: payload.user });
    setAuthMessage("");
    await loadMe();
  } catch (error) {
    setAuthMessage(error.message, true);
  }
});

els.logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("calorie_token");
  state.token = "";
  state.user = null;
  showAuth();
});

els.passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  els.savePasswordBtn.disabled = true;
  try {
    const payload = await api("/api/password", {
      method: "POST",
      body: JSON.stringify({ password: data.password }),
    });
    state.user = payload.user;
    form.reset();
    renderPasswordState("Password saved.");
  } catch (error) {
    els.passwordState.textContent = error.message;
    els.passwordState.classList.add("bad-text");
  } finally {
    els.savePasswordBtn.disabled = false;
  }
});

els.settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  els.saveSettingsBtn.disabled = true;
  els.settingsState.textContent = "";
  els.settingsState.classList.remove("bad-text");
  try {
    const payload = await api("/api/settings", {
      method: "POST",
      body: JSON.stringify({
        calorie_target: Number(data.calorie_target),
        protein_target: Number(data.protein_target),
      }),
    });
    state.user = payload.user;
    els.targetCalories.textContent = `${state.user.calorie_target} kcal`;
    els.targetProtein.textContent = `${state.user.protein_target} g`;
    els.settingsState.textContent = "Goals saved.";
    await refresh();
  } catch (error) {
    els.settingsState.textContent = error.message;
    els.settingsState.classList.add("bad-text");
  } finally {
    els.saveSettingsBtn.disabled = false;
  }
});

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((item) => item.classList.toggle("active", item === tab));
    const active = tab.dataset.tab;
    els.foodForm.classList.toggle("hidden", active !== "food");
    els.weightForm.classList.toggle("hidden", active !== "weight");
    els.voicePanel.classList.toggle("hidden", active !== "voice");
  });
});

els.foodForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const text = (data.text || "").trim();
  if (!text) {
    return;
  }
  const submission = beginSubmission("Food log", { type: "food_log", text });
  form.reset();

  try {
    const payload = await api("/api/logs/text", {
      method: "POST",
      body: JSON.stringify({ text, timestamp: submission.submittedAt }),
    });
    setResult(payload);
    await refresh();
    submission.finish("Food log processed.", "success");
  } catch (error) {
    setResult({ error: error.message });
    submission.finish(`Food log was not processed: ${error.message}`, "error");
  }
});

els.weightForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const weight = data.weight;
  if (!weight) {
    return;
  }
  const submission = beginSubmission("Weight log", { type: "weight_log", weight_kg: Number(weight) });
  form.reset();

  try {
    const payload = await api("/api/logs/text", {
      method: "POST",
      body: JSON.stringify({ text: `peso ${weight} kg`, timestamp: submission.submittedAt }),
    });
    setResult(payload);
    await refresh();
    submission.finish("Weight log processed.", "success");
  } catch (error) {
    setResult({ error: error.message });
    submission.finish(`Weight log was not processed: ${error.message}`, "error");
  }
});

els.refreshBtn.addEventListener("click", async () => {
  try {
    await refresh();
  } catch (error) {
    setResult({ error: error.message });
  }
});

els.logs.addEventListener("click", async (event) => {
  const saveButton = event.target.closest(".save-food-item");
  if (saveButton) {
    await saveFoodItem(saveButton);
    return;
  }

  const button = event.target.closest(".delete-log");
  if (!button) {
    return;
  }
  const logType = button.dataset.logType;
  const logId = button.dataset.logId;
  const confirmed = window.confirm("Delete this saved log?");
  if (!confirmed) {
    return;
  }
  button.disabled = true;
  try {
    const payload = await api(`/api/logs/${logType}/${logId}`, { method: "DELETE" });
    setResult(payload);
    await refresh();
  } catch (error) {
    button.disabled = false;
    setResult({ error: error.message });
  }
});

els.logs.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") {
    return;
  }
  const row = event.target.closest("tr[data-food-item-id]");
  if (!row) {
    return;
  }
  event.preventDefault();
  const saveButton = row.querySelector(".save-food-item");
  if (saveButton) {
    await saveFoodItem(saveButton);
  }
});

els.recordBtn.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.audioChunks = [];
    state.mediaRecorder = new MediaRecorder(stream);
    state.mediaRecorder.addEventListener("dataavailable", (event) => state.audioChunks.push(event.data));
    state.mediaRecorder.addEventListener("stop", uploadAudio);
    state.mediaRecorder.start();
    els.recordBtn.disabled = true;
    els.stopBtn.disabled = false;
    els.voiceState.textContent = "Recording...";
  } catch (error) {
    els.voiceState.textContent = `Microphone unavailable: ${error.message}`;
  }
});

els.stopBtn.addEventListener("click", () => {
  if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
    state.mediaRecorder.stop();
    state.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
  }
  els.recordBtn.disabled = false;
  els.stopBtn.disabled = true;
});

async function uploadAudio() {
  const mimeType = state.mediaRecorder.mimeType || state.audioChunks[0]?.type || "audio/webm";
  const blob = new Blob(state.audioChunks, { type: mimeType });
  const submission = beginSubmission("Audio log", { type: "audio_log", size_bytes: blob.size });
  els.voiceState.textContent = "Audio sent. Processing...";
  try {
    const payload = await api("/api/logs/audio", {
      method: "POST",
      headers: { "Content-Type": mimeType },
      body: blob,
    });
    setResult(payload);
    els.voiceState.textContent = "Audio processed.";
    await refresh();
    submission.finish("Audio log processed.", "success");
  } catch (error) {
    els.voiceState.textContent = error.message;
    setResult({ status: "audio_not_processed", message: error.message });
    submission.finish(`Audio log was not processed: ${error.message}`, "error");
  }
}

async function saveFoodItem(button) {
  const row = button.closest("tr[data-food-item-id]");
  if (!row) {
    return;
  }
  const itemId = row.dataset.foodItemId;
  const name = row.querySelector(".food-item-name").value.trim();
  const amount = row.querySelector(".amount-input").value;
  if (!name || !amount) {
    setLoggerState("Food item and amount are required before saving.", "error");
    return;
  }

  button.disabled = true;
  setLoggerState("Checking food composition...", "waiting");
  try {
    const payload = await api(`/api/logs/food-items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ name, amount_g: Number(amount) }),
    });
    setResult(payload);
    await refresh();
    setLoggerState("Entry updated.", "success");
  } catch (error) {
    setResult({ error: error.message });
    setLoggerState(`Entry was not updated: ${error.message}`, "error");
    button.disabled = false;
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatShortDay(value) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatSigned(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

await checkApi();
await loadMe();
