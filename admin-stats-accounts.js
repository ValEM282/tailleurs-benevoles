/* Administration — comptes bénévoles */

(() => {
  const firstnameInput = document.getElementById("volunteer-accounts-firstname");
  const lastnameInput = document.getElementById("volunteer-accounts-lastname");
  const searchButton = document.getElementById("volunteer-accounts-search-button");
  const results = document.getElementById("volunteer-accounts-results");
  const body = document.getElementById("volunteer-accounts-body");

  if (!firstnameInput || !lastnameInput || !searchButton || !results || !body) return;

  const sortButtons = [...document.querySelectorAll("[data-account-sort]")];
  let currentRows = [];
  let sortField = null;
  let sortDirection = "asc";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatLastLogin(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    const day = new Intl.DateTimeFormat("fr-BE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/Brussels"
    }).format(date);

    const time = new Intl.DateTimeFormat("fr-BE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/Brussels"
    }).format(date);

    return `${day} - ${time}`;
  }

  function sortedRows(rows) {
    if (!sortField) return [...rows];
    return [...rows].sort((a, b) => {
      let result = 0;
      if (sortField === "nom") {
        result = String(a.nom || "").localeCompare(String(b.nom || ""), "fr", { sensitivity: "base" });
      } else {
        const at = a.derniere_connexion ? new Date(a.derniere_connexion).getTime() : 0;
        const bt = b.derniere_connexion ? new Date(b.derniere_connexion).getTime() : 0;
        result = at - bt;
      }
      return sortDirection === "asc" ? result : -result;
    });
  }

  function updateSortIndicators() {
    document.querySelectorAll("[data-account-sort-indicator]").forEach(indicator => {
      indicator.textContent = indicator.dataset.accountSortIndicator === sortField
        ? (sortDirection === "asc" ? "↑" : "↓") : "↕";
    });
  }

  function renderRows(rows) {
    results.hidden = false;
    const displayedRows = sortedRows(rows);

    if (!displayedRows.length) {
      body.innerHTML = '<tr><td colspan="3" class="stats-empty-row">Aucun compte bénévole ne correspond à la recherche.</td></tr>';
      return;
    }

    body.innerHTML = displayedRows.map(row => `
      <tr>
        <td>${escapeHtml(row.prenom || "")}</td>
        <td><strong>${escapeHtml((row.nom || "").toUpperCase())}</strong></td>
        <td>${escapeHtml(formatLastLogin(row.derniere_connexion))}</td>
      </tr>
    `).join("");
  }

  async function searchAccounts() {
    searchButton.disabled = true;
    searchButton.textContent = "Recherche…";

    const { data, error } = await PortalAuth.client.rpc("admin_search_volunteer_accounts", {
      p_prenom: firstnameInput.value.trim() || null,
      p_nom: lastnameInput.value.trim() || null
    });

    searchButton.disabled = false;
    searchButton.textContent = "Rechercher";

    if (error) {
      console.error("Impossible de rechercher les comptes bénévoles :", error);
      results.hidden = false;
      body.innerHTML = '<tr><td colspan="3" class="stats-empty-row">Impossible de charger les comptes bénévoles pour le moment.</td></tr>';
      return;
    }

    currentRows = Array.isArray(data) ? data : [];
    renderRows(currentRows);
  }

  sortButtons.forEach(button => {
    button.addEventListener("click", () => {
      const field = button.dataset.accountSort;
      if (sortField === field) sortDirection = sortDirection === "asc" ? "desc" : "asc";
      else { sortField = field; sortDirection = "asc"; }
      updateSortIndicators();
      renderRows(currentRows);
    });
  });
  updateSortIndicators();

  searchButton.addEventListener("click", searchAccounts);

  [firstnameInput, lastnameInput].forEach(input => {
    input.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      searchAccounts();
    });
  });
})();
