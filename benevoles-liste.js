/* =========================================================
   ADMINISTRATION — LISTE DES BÉNÉVOLES
   ========================================================= */

const tableBody = document.getElementById("volunteers-table-body");
const countElement = document.getElementById("volunteers-count");
const errorElement = document.getElementById("volunteers-error");
const logoutButton = document.getElementById("logout-button");
const printButton = document.getElementById("print-volunteers-button");
const activityFilterButton = document.getElementById("activity-filter-button");
const sortButtons = [...document.querySelectorAll(".sort-button")];

const searchParams = new URLSearchParams(window.location.search);
const searchFirstname = (searchParams.get("prenom") || "").trim();
const searchLastname = (searchParams.get("nom") || "").trim();
const hasSearch = Boolean(searchFirstname || searchLastname);

let volunteers = [];
let currentUser = null;
let sortField = "nom";
let sortDirection = "asc";
let activityFilter = "all"; // all -> active -> inactive -> all

function unlockStorageKey() {
  return currentUser ? `portalAdminUnlockedUntil:${currentUser.id}` : "";
}

function isLocallyUnlocked() {
  if (!currentUser) return false;
  const until = Number(sessionStorage.getItem(unlockStorageKey()) || 0);
  return until > Date.now();
}

function showError(message) {
  errorElement.textContent = message;
  errorElement.hidden = false;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeSearch(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
}

function matchesSearch(volunteer) {
  if (!hasSearch) return true;

  const firstnameMatches = !searchFirstname ||
    normalizeSearch(volunteer.prenom).includes(normalizeSearch(searchFirstname));

  const lastnameMatches = !searchLastname ||
    normalizeSearch(volunteer.nom).includes(normalizeSearch(searchLastname));

  return firstnameMatches && lastnameMatches;
}

function matchesActivityFilter(volunteer) {
  if (activityFilter === "active") return Boolean(volunteer.en_poste);
  if (activityFilter === "inactive") return !volunteer.en_poste;
  return true;
}

function compareFrench(a, b) {
  return normalizeText(a).localeCompare(normalizeText(b), "fr", {
    sensitivity: "base",
    ignorePunctuation: true
  });
}

function filteredVolunteers() {
  return volunteers.filter(volunteer =>
    matchesSearch(volunteer) && matchesActivityFilter(volunteer)
  );
}

function sortedVolunteers() {
  return filteredVolunteers().sort((a, b) => {
    let result = compareFrench(a[sortField], b[sortField]);

    if (result === 0) {
      const secondaryField = sortField === "nom" ? "prenom" : "nom";
      result = compareFrench(a[secondaryField], b[secondaryField]);
    }

    return sortDirection === "asc" ? result : -result;
  });
}

function formatPhoneLink(phone) {
  const value = normalizeText(phone);
  if (!value) return "—";

  const href = value.replace(/[^+\d]/g, "");
  return `<a class="volunteer-phone" href="tel:${href}">${escapeHtml(value)}</a>`;
}

function formatEmailLink(email) {
  const value = normalizeText(email);
  if (!value) return "—";

  return `<a class="volunteer-email" href="mailto:${encodeURIComponent(value)}">${escapeHtml(value)}</a>`;
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  return escapeHtml(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateSortIndicators() {
  document.querySelectorAll(".sort-indicator").forEach(indicator => {
    const field = indicator.dataset.indicator;

    if (field !== sortField) {
      indicator.textContent = "↕";
      return;
    }

    indicator.textContent = sortDirection === "asc" ? "↑" : "↓";
  });

  sortButtons.forEach(button => {
    const field = button.dataset.sort;
    const label = field === "prenom" ? "prénom" : "nom";

    button.setAttribute(
      "aria-label",
      field === sortField
        ? `Trier par ${label}, ordre actuellement ${sortDirection === "asc" ? "croissant" : "décroissant"}`
        : `Trier par ${label}`
    );
  });
}

function updateActivityFilterButton() {
  if (!activityFilterButton) return;

  activityFilterButton.classList.remove(
    "activity-filter-all",
    "activity-filter-active",
    "activity-filter-inactive"
  );

  if (activityFilter === "active") {
    activityFilterButton.classList.add("activity-filter-active");
    activityFilterButton.title = "Bénévoles actuellement en poste";
    activityFilterButton.setAttribute(
      "aria-label",
      "Filtre actuel : bénévoles actuellement en poste. Cliquer pour afficher les bénévoles qui ne sont pas actuellement en poste."
    );
    return;
  }

  if (activityFilter === "inactive") {
    activityFilterButton.classList.add("activity-filter-inactive");
    activityFilterButton.title = "Bénévoles qui ne sont pas actuellement en poste";
    activityFilterButton.setAttribute(
      "aria-label",
      "Filtre actuel : bénévoles qui ne sont pas actuellement en poste. Cliquer pour afficher tous les bénévoles."
    );
    return;
  }

  activityFilterButton.classList.add("activity-filter-all");
  activityFilterButton.title = "Tous les bénévoles";
  activityFilterButton.setAttribute(
    "aria-label",
    "Filtre actuel : tous les bénévoles. Cliquer pour afficher uniquement les bénévoles actuellement en poste."
  );
}

function kitCheckbox(volunteer) {
  const checked = volunteer.kit_ok ? "checked" : "";
  const label = `${volunteer.prenom || ""} ${volunteer.nom || ""}`.trim() || "ce bénévole";

  return `
    <label class="kit-checkbox-wrap" title="Valider la remise du kit à ${escapeHtml(label)}">
      <input
        type="checkbox"
        class="kit-checkbox"
        data-participation-id="${escapeHtml(volunteer.participation_id)}"
        ${checked}
        aria-label="Kit remis à ${escapeHtml(label)}"
      >
      <span class="kit-checkbox-mark" aria-hidden="true"></span>
    </label>
  `;
}

function scheduleButton(volunteer) {
  const label = `${volunteer.prenom || ""} ${volunteer.nom || ""}`.trim() || "ce bénévole";
  const params = new URLSearchParams({
    id: volunteer.id,
    prenom: volunteer.prenom || "",
    nom: volunteer.nom || ""
  });

  const activeClass = volunteer.en_poste ? " schedule-view-button-active" : "";
  const activeText = volunteer.en_poste ? " — actuellement en poste" : "";

  return `
    <a
      class="schedule-view-button${activeClass}"
      href="benevole-horaires-admin.html?${params.toString()}"
      title="Voir les horaires de ${escapeHtml(label)}${activeText}"
      aria-label="Voir les horaires de ${escapeHtml(label)}${activeText}"
    >🕥</a>
  `;
}

function emptyMessage() {
  if (activityFilter === "active") {
    return hasSearch
      ? "Aucun bénévole correspondant à cette recherche n'est actuellement en poste."
      : "Aucun bénévole n'est actuellement en poste.";
  }

  if (activityFilter === "inactive") {
    return hasSearch
      ? "Aucun bénévole correspondant à cette recherche n'est actuellement hors poste."
      : "Aucun bénévole hors poste à afficher.";
  }

  return hasSearch
    ? "Aucun bénévole ne correspond à cette recherche."
    : "Aucun bénévole à afficher.";
}

function renderTable() {
  const rows = sortedVolunteers();

  if (!rows.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" class="volunteers-empty">${emptyMessage()}</td>
      </tr>
    `;
    countElement.textContent = "0 bénévole";
    updateSortIndicators();
    updateActivityFilterButton();
    return;
  }

  tableBody.innerHTML = rows.map(volunteer => `
    <tr>
      <td class="schedule-view-cell">${scheduleButton(volunteer)}</td>
      <td class="volunteer-name">${escapeHtml(volunteer.prenom || "—")}</td>
      <td class="volunteer-name">${escapeHtml(volunteer.nom || "—")}</td>
      <td>${formatPhoneLink(volunteer.telephone)}</td>
      <td>${formatEmailLink(volunteer.email)}</td>
      <td class="logistics-cell">${formatValue(volunteer.tshirt)}</td>
      <td class="logistics-cell">${formatValue(volunteer.tailloux)}</td>
      <td class="logistics-cell sandwich-cell">${formatValue(volunteer.sandwich)}</td>
      <td class="kit-ok-cell">${kitCheckbox(volunteer)}</td>
    </tr>
  `).join("");

  countElement.textContent = `${rows.length} bénévole${rows.length > 1 ? "s" : ""}`;
  updateSortIndicators();
  updateActivityFilterButton();
}

async function updateKitStatus(checkbox) {
  const participationId = checkbox.dataset.participationId;
  const newValue = checkbox.checked;
  const previousValue = !newValue;

  checkbox.disabled = true;

  const { error } = await PortalAuth.client.rpc("admin_set_benevole_kit_ok", {
    p_participation_id: participationId,
    p_kit_ok: newValue
  });

  if (error) {
    console.error("Impossible de mettre à jour la remise du kit :", error);
    checkbox.checked = previousValue;
    showError("La validation du kit n'a pas pu être enregistrée.");
  } else {
    const volunteer = volunteers.find(item => item.participation_id === participationId);
    if (volunteer) volunteer.kit_ok = newValue;
    errorElement.hidden = true;
  }

  checkbox.disabled = false;
}

function printVolunteersList() {
  sortField = "nom";
  sortDirection = "asc";
  renderTable();

  requestAnimationFrame(() => {
    window.print();
  });
}

async function loadVolunteers() {
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

  const { data, error } = await PortalAuth.client.rpc("admin_list_benevoles");

  if (error) {
    console.error("Impossible de charger la liste des bénévoles :", error);
    tableBody.innerHTML = "";
    showError("Impossible de charger la liste des bénévoles pour le moment.");
    return;
  }

  volunteers = Array.isArray(data) ? data : [];
  renderTable();
}

sortButtons.forEach(button => {
  button.addEventListener("click", () => {
    const field = button.dataset.sort;

    if (sortField === field) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortField = field;
      sortDirection = "asc";
    }

    renderTable();
  });
});

if (activityFilterButton) {
  activityFilterButton.addEventListener("click", () => {
    if (activityFilter === "all") {
      activityFilter = "active";
    } else if (activityFilter === "active") {
      activityFilter = "inactive";
    } else {
      activityFilter = "all";
    }

    renderTable();
  });
}

tableBody.addEventListener("change", event => {
  const checkbox = event.target.closest(".kit-checkbox");
  if (!checkbox) return;
  updateKitStatus(checkbox);
});

if (printButton) {
  printButton.addEventListener("click", printVolunteersList);
}

logoutButton.addEventListener("click", async () => {
  if (currentUser) {
    sessionStorage.removeItem(unlockStorageKey());
  }

  logoutButton.disabled = true;
  logoutButton.textContent = "Déconnexion...";

  const success = await PortalAuth.logout();

  if (!success) {
    logoutButton.disabled = false;
    logoutButton.textContent = "Se déconnecter";
  }
});

loadVolunteers();
