/* Administration — statistiques */

const loadingElement = document.getElementById("stats-loading");
const errorElement = document.getElementById("stats-error");
const contentElement = document.getElementById("stats-content");
const daySelect = document.getElementById("stats-day");
const logoutButton = document.getElementById("logout-button");

const volunteerStat = document.getElementById("stat-volunteers");
const postStat = document.getElementById("stat-posts");
const placeStat = document.getElementById("stat-places");
const absentStat = document.getElementById("stat-absent");
const availableStat = document.getElementById("stat-available");

const saturdayLabel = document.getElementById("sandwich-saturday-label");
const saturdayStat = document.getElementById("sandwich-saturday");
const sundayLabel = document.getElementById("sandwich-sunday-label");
const sundayStat = document.getElementById("sandwich-sunday");

const postPeriod = document.getElementById("post-stats-period");
const postBody = document.getElementById("post-stats-body");
const dailyBody = document.getElementById("daily-stats-body");

let currentUser = null;
let daysInitialized = false;

function unlockStorageKey() {
  return currentUser ? `portalAdminUnlockedUntil:${currentUser.id}` : "";
}

function isLocallyUnlocked() {
  if (!currentUser) return false;
  const until = Number(sessionStorage.getItem(unlockStorageKey()) || 0);
  return until > Date.now();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value, includeYear = false) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("fr-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(includeYear ? { year: "numeric" } : {}),
    timeZone: "Europe/Brussels"
  }).format(date);
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function numberValue(value) {
  return Number(value || 0);
}

function initializeDays(days) {
  if (daysInitialized) return;

  const normalizedDays = Array.isArray(days) ? days : [];
  normalizedDays.forEach(day => {
    const option = document.createElement("option");
    option.value = day;
    option.textContent = capitalize(formatDate(day, false));
    daySelect.appendChild(option);
  });

  daySelect.disabled = false;
  daysInitialized = true;
}

function renderSummary(summary = {}) {
  volunteerStat.textContent = numberValue(summary.benevoles);
  postStat.textContent = numberValue(summary.postes);
  placeStat.textContent = numberValue(summary.lieux);
  absentStat.textContent = numberValue(summary.absents);
  availableStat.textContent = numberValue(summary.disponibles);
}

function renderSandwiches(sandwiches = {}) {
  saturdayStat.textContent = numberValue(sandwiches.samedi);
  sundayStat.textContent = numberValue(sandwiches.dimanche);

  saturdayLabel.textContent = sandwiches.samedi_date
    ? capitalize(formatDate(sandwiches.samedi_date, false))
    : "Samedi";

  sundayLabel.textContent = sandwiches.dimanche_date
    ? capitalize(formatDate(sandwiches.dimanche_date, false))
    : "Dimanche";
}

function renderPosts(rows, selectedDay) {
  const postRows = Array.isArray(rows) ? rows : [];
  postPeriod.textContent = selectedDay
    ? capitalize(formatDate(selectedDay, false))
    : "Toute l’édition";

  if (!postRows.length) {
    postBody.innerHTML = '<tr><td colspan="3" class="stats-empty-row">Aucun bénévole planifié pour cette période.</td></tr>';
    return;
  }

  postBody.innerHTML = postRows.map(row => {
    const isTotal = row.is_total === true;
    return `
      <tr${isTotal ? ' class="stats-post-total"' : ''}>
        <td>${isTotal ? `<strong>${escapeHtml(row.poste || "—")}</strong>` : escapeHtml(row.poste || "—")}</td>
        <td>${isTotal ? "<strong>Total du poste</strong>" : escapeHtml(row.sous_poste || "—")}</td>
        <td class="stats-number">${isTotal ? `<strong>${numberValue(row.benevoles)}</strong>` : numberValue(row.benevoles)}</td>
      </tr>
    `;
  }).join("");
}

function renderDaily(rows) {
  const dailyRows = Array.isArray(rows) ? rows : [];

  if (!dailyRows.length) {
    dailyBody.innerHTML = '<tr><td colspan="6" class="stats-empty-row">Aucune journée configurée.</td></tr>';
    return;
  }

  dailyBody.innerHTML = dailyRows.map(row => `
    <tr>
      <td>
        <button type="button" class="stats-day-button" data-day="${escapeHtml(row.jour)}">
          ${escapeHtml(capitalize(formatDate(row.jour, false)))}
        </button>
      </td>
      <td>${numberValue(row.benevoles)}</td>
      <td>${numberValue(row.postes)}</td>
      <td>${numberValue(row.lieux)}</td>
      <td>${numberValue(row.absents)}</td>
      <td>${numberValue(row.disponibles)}</td>
    </tr>
  `).join("");
}

function renderStats(data, selectedDay) {
  initializeDays(data?.days);
  renderSummary(data?.summary);
  renderSandwiches(data?.sandwiches);
  renderPosts(data?.by_post, selectedDay);
  renderDaily(data?.daily);

  loadingElement.hidden = true;
  errorElement.hidden = true;
  contentElement.hidden = false;
}

async function loadStats(selectedDay = "") {
  loadingElement.hidden = false;
  loadingElement.textContent = "Chargement des statistiques…";
  errorElement.hidden = true;

  const { data, error } = await PortalAuth.client.rpc("admin_get_stats", {
    p_day: selectedDay || null
  });

  if (error) {
    console.error("Impossible de charger les statistiques :", error);
    loadingElement.hidden = true;
    errorElement.textContent = "Impossible de charger les statistiques pour le moment.";
    errorElement.hidden = false;
    return;
  }

  renderStats(data || {}, selectedDay);
}

async function initStatsPage() {
  const user = await PortalAuth.requireAuth();
  if (!user) return;

  currentUser = user;

  const { data: isAdmin, error: roleError } = await PortalAuth.client.rpc("is_current_portal_admin");
  if (roleError || !isAdmin) {
    window.location.replace("dashboard.html");
    return;
  }

  if (!isLocallyUnlocked()) {
    window.location.replace("admin.html");
    return;
  }

  await loadStats("");
}

daySelect.addEventListener("change", () => {
  loadStats(daySelect.value);
});

dailyBody.addEventListener("click", event => {
  const button = event.target.closest(".stats-day-button");
  if (!button) return;

  const day = button.dataset.day || "";
  daySelect.value = day;
  loadStats(day);
  window.scrollTo({ top: 0, behavior: "smooth" });
});

logoutButton.addEventListener("click", async () => {
  if (currentUser) sessionStorage.removeItem(unlockStorageKey());

  logoutButton.disabled = true;
  logoutButton.textContent = "Déconnexion...";

  const success = await PortalAuth.logout();
  if (!success) {
    logoutButton.disabled = false;
    logoutButton.textContent = "Se déconnecter";
  }
});

initStatsPage();
