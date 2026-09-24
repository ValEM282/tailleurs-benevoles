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
const vacantPostsStat = document.getElementById("stat-vacant-posts");
const vacantPlacesStat = document.getElementById("stat-vacant-places");
const vacantHoursStat = document.getElementById("stat-vacant-hours");
const mealGrid = document.getElementById("meal-grid");

const volunteerHoursPeriod = document.getElementById("volunteer-hours-period");
const volunteerHoursHead = document.getElementById("volunteer-hours-head");
const volunteerHoursBody = document.getElementById("volunteer-hours-body");
const volunteerHoursFirstname = document.getElementById("volunteer-hours-firstname");
const volunteerHoursLastname = document.getElementById("volunteer-hours-lastname");
const volunteerHoursSearchButton = document.getElementById("volunteer-hours-search-button");
const postPeriod = document.getElementById("post-stats-period");
const postBody = document.getElementById("post-stats-body");
const dailyBody = document.getElementById("daily-stats-body");

let currentUser = null;
let daysInitialized = false;
let volunteerHoursData = { days: [], rows: [] };
let volunteerHoursFilters = { prenom: "", nom: "" };
let volunteerHoursSort = { key: "nom", direction: "asc" };

const volunteerHoursCollator = new Intl.Collator("fr", {
  sensitivity: "base",
  numeric: true
});

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

function formatDayMonth(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("fr-BE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Brussels"
  }).format(date);
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function numberValue(value) {
  return Number(value || 0);
}

function formattedNumber(value, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("fr-BE", { maximumFractionDigits }).format(numberValue(value));
}

function formatDurationHours(value) {
  const totalMinutes = Math.max(0, Math.round(numberValue(value) * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${String(minutes).padStart(2, "0")}`;
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .trim();
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

function renderSummary(summary = {}, vacancySummary = {}) {
  volunteerStat.textContent = numberValue(summary.benevoles);
  postStat.textContent = numberValue(summary.postes);
  placeStat.textContent = numberValue(summary.lieux);
  absentStat.textContent = numberValue(summary.absents);
  availableStat.textContent = numberValue(summary.disponibles);
  vacantPostsStat.textContent = numberValue(vacancySummary.postes);
  vacantPlacesStat.textContent = numberValue(vacancySummary.places);
  vacantHoursStat.textContent = formattedNumber(vacancySummary.heures);
}

function renderMeals(rows) {
  const meals = Array.isArray(rows) ? rows : [];

  if (!meals.length) {
    mealGrid.innerHTML = '<p class="stats-empty-row">Aucun jour de repas configuré.</p>';
    return;
  }

  mealGrid.innerHTML = meals.map(row => {
    const isSandwich = String(row.type || "").toLocaleLowerCase("fr").includes("sandwich");
    const dateLabel = row.date ? capitalize(formatDate(row.date, false)) : escapeHtml(row.label || "—");
    const typeLabel = escapeHtml(row.type || "Repas");

    return `
      <article class="meal-card ${isSandwich ? "meal-card-sandwich" : "meal-card-common"}">
        <div class="meal-card-copy">
          <strong class="meal-card-date">${escapeHtml(dateLabel)}</strong>
          <span class="meal-card-type">${typeLabel}</span>
        </div>
        <div class="meal-card-count">
          <strong>${numberValue(row.personnes)}</strong>
          <span>personne${numberValue(row.personnes) > 1 ? "s" : ""}</span>
        </div>
      </article>
    `;
  }).join("");
}

function volunteerHoursSortIndicator(key) {
  if (volunteerHoursSort.key !== key) return "";
  return volunteerHoursSort.direction === "asc" ? "▲" : "▼";
}

function getFilteredVolunteerHourRows() {
  const rows = Array.isArray(volunteerHoursData?.rows) ? [...volunteerHoursData.rows] : [];
  const prenomFilter = normalizeSearchText(volunteerHoursFilters.prenom);
  const nomFilter = normalizeSearchText(volunteerHoursFilters.nom);

  const filtered = rows.filter(row => {
    if (prenomFilter && !normalizeSearchText(row.prenom).includes(prenomFilter)) return false;
    if (nomFilter && !normalizeSearchText(row.nom).includes(nomFilter)) return false;
    return true;
  });

  const key = volunteerHoursSort.key;
  const direction = volunteerHoursSort.direction === "desc" ? -1 : 1;
  const secondaryKey = key === "prenom" ? "nom" : "prenom";

  filtered.sort((a, b) => {
    const primary = volunteerHoursCollator.compare(a[key] || "", b[key] || "");
    if (primary !== 0) return primary * direction;
    return volunteerHoursCollator.compare(a[secondaryKey] || "", b[secondaryKey] || "");
  });

  return filtered;
}

function renderVolunteerHoursTable() {
  const days = Array.isArray(volunteerHoursData?.days) ? volunteerHoursData.days : [];
  const rows = getFilteredVolunteerHourRows();

  volunteerHoursPeriod.textContent = "01/10 au 05/10";

  volunteerHoursHead.innerHTML = `
    <tr>
      <th scope="col" class="volunteer-hours-person-column">
        <button type="button" class="volunteer-hours-sort-button" data-sort-key="prenom">
          Prénom <span aria-hidden="true">${volunteerHoursSortIndicator("prenom")}</span>
        </button>
      </th>
      <th scope="col" class="volunteer-hours-person-column">
        <button type="button" class="volunteer-hours-sort-button" data-sort-key="nom">
          NOM <span aria-hidden="true">${volunteerHoursSortIndicator("nom")}</span>
        </button>
      </th>
      <th scope="col" class="volunteer-hours-number volunteer-hours-total">Total</th>
      ${days.map(day => `<th scope="col" class="volunteer-hours-number">${escapeHtml(formatDayMonth(day))}</th>`).join("")}
    </tr>
  `;

  if (!rows.length) {
    volunteerHoursBody.innerHTML = `<tr><td colspan="${Math.max(3, days.length + 3)}" class="stats-empty-row">Aucun bénévole ne correspond à la recherche.</td></tr>`;
    return;
  }

  volunteerHoursBody.innerHTML = rows.map(row => {
    const dayValues = row.jours && typeof row.jours === "object" ? row.jours : {};
    return `
      <tr>
        <td class="volunteer-hours-person-column">${escapeHtml(row.prenom || "")}</td>
        <td class="volunteer-hours-person-column"><strong>${escapeHtml((row.nom || "").toUpperCase())}</strong></td>
        <td class="volunteer-hours-number volunteer-hours-total"><strong>${escapeHtml(formatDurationHours(row.total))}</strong></td>
        ${days.map(day => `<td class="volunteer-hours-number">${escapeHtml(formatDurationHours(dayValues[day]))}</td>`).join("")}
      </tr>
    `;
  }).join("");
}

function renderVolunteerHours(data) {
  volunteerHoursData = {
    days: Array.isArray(data?.days) ? data.days : [],
    rows: Array.isArray(data?.rows) ? data.rows : []
  };
  renderVolunteerHoursTable();
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

function renderDaily(rows, vacancyRows) {
  const dailyRows = Array.isArray(rows) ? rows : [];
  const vacancies = Array.isArray(vacancyRows) ? vacancyRows : [];
  const dailyMap = new Map(dailyRows.map(row => [row.jour, row]));
  const vacancyMap = new Map(vacancies.map(row => [row.jour, row]));
  const days = [...new Set([...dailyMap.keys(), ...vacancyMap.keys()])].sort();

  if (!days.length) {
    dailyBody.innerHTML = '<tr><td colspan="9" class="stats-empty-row">Aucune journée configurée.</td></tr>';
    return;
  }

  dailyBody.innerHTML = days.map(day => {
    const row = dailyMap.get(day) || {};
    const vacancy = vacancyMap.get(day) || {};
    return `
      <tr>
        <td>
          <button type="button" class="stats-day-button" data-day="${escapeHtml(day)}">
            ${escapeHtml(capitalize(formatDate(day, false)))}
          </button>
        </td>
        <td>${numberValue(row.benevoles)}</td>
        <td>${numberValue(row.postes)}</td>
        <td>${numberValue(row.lieux)}</td>
        <td>${numberValue(row.absents)}</td>
        <td>${numberValue(row.disponibles)}</td>
        <td>${numberValue(vacancy.postes)}</td>
        <td>${numberValue(vacancy.places)}</td>
        <td>${formattedNumber(vacancy.heures)}</td>
      </tr>
    `;
  }).join("");
}

function renderStats(data, vacancyData, volunteerHoursResult, selectedDay) {
  initializeDays(data?.days);
  renderSummary(data?.summary, vacancyData?.summary);
  renderMeals(data?.meals);
  renderVolunteerHours(volunteerHoursResult);
  renderPosts(data?.by_post, selectedDay);
  renderDaily(data?.daily, vacancyData?.daily);

  loadingElement.hidden = true;
  errorElement.hidden = true;
  contentElement.hidden = false;
}

async function loadStats(selectedDay = "") {
  loadingElement.hidden = false;
  loadingElement.textContent = "Chargement des statistiques…";
  errorElement.hidden = true;

  const [statsResult, vacancyResult, volunteerHoursResult] = await Promise.all([
    PortalAuth.client.rpc("admin_get_stats", { p_day: selectedDay || null }),
    PortalAuth.client.rpc("admin_get_vacancy_stats", { p_day: selectedDay || null }),
    PortalAuth.client.rpc("admin_get_volunteer_hours", { p_day: null })
  ]);

  const error = statsResult.error || vacancyResult.error || volunteerHoursResult.error;
  if (error) {
    console.error("Impossible de charger les statistiques :", error);
    loadingElement.hidden = true;
    errorElement.textContent = "Impossible de charger les statistiques pour le moment.";
    errorElement.hidden = false;
    return;
  }

  renderStats(
    statsResult.data || {},
    vacancyResult.data || {},
    volunteerHoursResult.data || {},
    selectedDay
  );
}

function applyVolunteerHoursSearch() {
  volunteerHoursFilters = {
    prenom: volunteerHoursFirstname.value.trim(),
    nom: volunteerHoursLastname.value.trim()
  };
  renderVolunteerHoursTable();
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

volunteerHoursSearchButton.addEventListener("click", applyVolunteerHoursSearch);

[volunteerHoursFirstname, volunteerHoursLastname].forEach(input => {
  input.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyVolunteerHoursSearch();
  });
});

volunteerHoursHead.addEventListener("click", event => {
  const button = event.target.closest(".volunteer-hours-sort-button");
  if (!button) return;

  const key = button.dataset.sortKey;
  if (!key || !["prenom", "nom"].includes(key)) return;

  if (volunteerHoursSort.key === key) {
    volunteerHoursSort.direction = volunteerHoursSort.direction === "asc" ? "desc" : "asc";
  } else {
    volunteerHoursSort = { key, direction: "asc" };
  }

  renderVolunteerHoursTable();
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