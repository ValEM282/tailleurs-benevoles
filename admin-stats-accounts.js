/* Administration — comptes bénévoles */

(() => {
  const firstnameInput = document.getElementById("volunteer-accounts-firstname");
  const lastnameInput = document.getElementById("volunteer-accounts-lastname");
  const searchButton = document.getElementById("volunteer-accounts-search-button");
  const results = document.getElementById("volunteer-accounts-results");
  const body = document.getElementById("volunteer-accounts-body");

  if (!firstnameInput || !lastnameInput || !searchButton || !results || !body) return;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatFirstLogin(value) {
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

  function renderRows(rows) {
    results.hidden = false;

    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="3" class="stats-empty-row">Aucun compte bénévole ne correspond à la recherche.</td></tr>';
      return;
    }

    body.innerHTML = rows.map(row => `
      <tr>
        <td>${escapeHtml(row.prenom || "")}</td>
        <td><strong>${escapeHtml((row.nom || "").toUpperCase())}</strong></td>
        <td>${escapeHtml(formatFirstLogin(row.premiere_connexion))}</td>
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

    renderRows(Array.isArray(data) ? data : []);
  }

  searchButton.addEventListener("click", searchAccounts);

  [firstnameInput, lastnameInput].forEach(input => {
    input.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      searchAccounts();
    });
  });
})();
