/* =========================================================
   ADMINISTRATION — LISTE DES BÉNÉVOLES
   ========================================================= */

const tableBody = document.getElementById("volunteers-table-body");
const countElement = document.getElementById("volunteers-count");
const errorElement = document.getElementById("volunteers-error");
const logoutButton = document.getElementById("logout-button");
const sortButtons = [...document.querySelectorAll(".sort-button")];

let volunteers = [];
let currentUser = null;
let sortField = "nom";
let sortDirection = "asc";

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

function compareFrench(a, b) {
  return normalizeText(a).localeCompare(normalizeText(b), "fr", {
    sensitivity: "base",
    ignorePunctuation: true
  });
}

function sortedVolunteers() {
  return [...volunteers].sort((a, b) => {
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

function renderTable() {
  const rows = sortedVolunteers();

  if (!rows.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" class="volunteers-empty">Aucun bénévole à afficher.</td>
      </tr>
    `;
    countElement.textContent = "0 bénévole";
    updateSortIndicators();
    return;
  }

  tableBody.innerHTML = rows.map(volunteer => `
    <tr>
      <td class="volunteer-name">${escapeHtml(volunteer.prenom || "—")}</td>
      <td class="volunteer-name">${escapeHtml(volunteer.nom || "—")}</td>
      <td>${formatPhoneLink(volunteer.telephone)}</td>
      <td>${formatEmailLink(volunteer.email)}</td>
    </tr>
  `).join("");

  countElement.textContent = `${rows.length} bénévole${rows.length > 1 ? "s" : ""}`;
  updateSortIndicators();
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
