/* Administration — création des postes / sous-postes */

(() => {
  const listButton = document.getElementById("admin-post-list");
  const searchButton = document.getElementById("admin-post-search");
  const searchInput = document.getElementById("post-search-name");
  const addButton = document.getElementById("admin-post-add");
  const panel = document.getElementById("admin-post-create-panel");
  const form = document.getElementById("admin-post-create-form");
  const cancelButton = document.getElementById("admin-post-create-cancel");
  const errorElement = document.getElementById("admin-post-create-error");
  const nameInput = document.getElementById("new-post-name");
  const subpostInput = document.getElementById("new-subpost-name");
  const lieuxContainer = document.getElementById("new-post-lieux");
  const responsablesContainer = document.getElementById("new-post-responsables");
  const coresponsablesContainer = document.getElementById("new-post-coresponsables");

  if (!listButton || !searchButton || !searchInput || !addButton || !panel || !form) return;

  let optionsLoaded = false;
  let optionsLoading = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function openSearch() {
    const poste = searchInput.value.trim();
    const params = new URLSearchParams();
    if (poste) params.set("poste", poste);
    const query = params.toString();
    window.location.href = query ? `postes-liste.html?${query}` : "postes-liste.html";
  }

  function showError(message, input) {
    errorElement.textContent = message;
    errorElement.hidden = false;
    if (input) input.focus();
  }

  function clearError() {
    errorElement.textContent = "";
    errorElement.hidden = true;
  }

  function choiceList(options, kind) {
    if (!options.length) return '<p class="admin-post-choice-empty">Aucun élément disponible.</p>';

    return options.map(option => `
      <label class="admin-post-choice">
        <input type="checkbox" value="${escapeHtml(option.id)}" data-post-create-kind="${kind}">
        <span>${escapeHtml(option.label)}</span>
      </label>
    `).join("");
  }

  async function loadOptions() {
    if (optionsLoaded || optionsLoading) return;
    optionsLoading = true;

    lieuxContainer.textContent = "Chargement des lieux…";
    responsablesContainer.textContent = "Chargement des personnes…";
    coresponsablesContainer.textContent = "Chargement des personnes…";

    const [lieuxResult, personnesResult] = await Promise.all([
      PortalAuth.client.rpc("admin_list_lieux_options"),
      PortalAuth.client.rpc("admin_list_responsable_options")
    ]);

    optionsLoading = false;

    if (lieuxResult.error || personnesResult.error) {
      console.error("Impossible de charger les options du poste :", lieuxResult.error || personnesResult.error);
      lieuxContainer.innerHTML = '<p class="admin-post-choice-empty">Impossible de charger les lieux.</p>';
      responsablesContainer.innerHTML = '<p class="admin-post-choice-empty">Impossible de charger les personnes.</p>';
      coresponsablesContainer.innerHTML = '<p class="admin-post-choice-empty">Impossible de charger les personnes.</p>';
      showError("Impossible de charger les choix pour le moment.");
      return;
    }

    const lieux = (Array.isArray(lieuxResult.data) ? lieuxResult.data : []).map(lieu => ({
      id: lieu.id,
      label: lieu.nom
    }));

    const personnes = (Array.isArray(personnesResult.data) ? personnesResult.data : []).map(person => ({
      id: person.id,
      label: `${person.prenom || ""} ${person.nom || ""}`.trim()
    }));

    lieuxContainer.innerHTML = choiceList(lieux, "lieu");
    responsablesContainer.innerHTML = choiceList(personnes, "responsable");
    coresponsablesContainer.innerHTML = choiceList(personnes, "coresponsable");
    optionsLoaded = true;
  }

  function setOpen(open) {
    panel.hidden = !open;
    addButton.setAttribute("aria-expanded", String(open));
    clearError();

    if (open) {
      loadOptions();
      nameInput.focus();
      return;
    }

    form.reset();
    addButton.focus();
  }

  function selectedIds(container) {
    return [...container.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
  }

  function selectedNumberIds(container) {
    return [...container.querySelectorAll('input[type="checkbox"]:checked')]
      .map(input => Number(input.value))
      .filter(Number.isFinite);
  }

  function enforceExclusive(event) {
    const input = event.target.closest('input[type="checkbox"][data-post-create-kind]');
    if (!input || !input.checked) return;

    const opposite = input.dataset.postCreateKind === "responsable"
      ? coresponsablesContainer
      : input.dataset.postCreateKind === "coresponsable"
        ? responsablesContainer
        : null;

    if (!opposite) return;
    const counterpart = [...opposite.querySelectorAll('input[type="checkbox"]')]
      .find(item => item.value === input.value);
    if (counterpart) counterpart.checked = false;
  }

  listButton.addEventListener("click", () => {
    window.location.href = "postes-liste.html";
  });

  searchButton.addEventListener("click", openSearch);
  searchInput.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    openSearch();
  });

  addButton.addEventListener("click", () => setOpen(panel.hidden));
  cancelButton.addEventListener("click", () => setOpen(false));
  responsablesContainer.addEventListener("change", enforceExclusive);
  coresponsablesContainer.addEventListener("change", enforceExclusive);

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const posteNom = nameInput.value.trim();
    const sousPosteNom = subpostInput.value.trim();
    const lieuIds = selectedNumberIds(lieuxContainer);
    const responsableIds = selectedIds(responsablesContainer);
    const coresponsableIds = selectedIds(coresponsablesContainer);

    if (!posteNom) {
      showError("Indique le nom du poste.", nameInput);
      return;
    }

    clearError();
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    cancelButton.disabled = true;

    try {
      const { error } = await PortalAuth.client.rpc("admin_create_poste", {
        p_poste_nom: posteNom,
        p_sous_poste_nom: sousPosteNom || null,
        p_lieu_ids: lieuIds,
        p_responsable_ids: responsableIds,
        p_coresponsable_ids: coresponsableIds
      });

      if (error) {
        console.error("Impossible de créer le poste :", error);
        showError(error.message || "Impossible de créer le poste pour le moment.");
        return;
      }

      const params = new URLSearchParams({ poste: posteNom });
      window.location.href = `postes-liste.html?${params.toString()}`;
    } catch (error) {
      console.error("Impossible de créer le poste :", error);
      showError("Impossible de créer le poste pour le moment.");
    } finally {
      submit.disabled = false;
      cancelButton.disabled = false;
    }
  });
})();

// Charge la gestion de l'encadré LIEUX sans dupliquer le code dans admin.html.
(() => {
  if (document.querySelector('script[data-admin-lieux-loader="true"]')) return;
  const script = document.createElement("script");
  script.src = "admin-lieux.js?v=20260924-2";
  script.dataset.adminLieuxLoader = "true";
  document.body.appendChild(script);
})();

// Ajoute l'encadré HORAIRES VACANTS juste avant STATS si nécessaire.
(() => {
  const management = document.querySelector(".admin-management");
  const statsSection = document.querySelector('[aria-labelledby="admin-stats-title"]');

  if (management && !document.getElementById("admin-open-shifts-title")) {
    const section = document.createElement("section");
    section.className = "admin-management-section";
    section.setAttribute("aria-labelledby", "admin-open-shifts-title");
    section.innerHTML = `
      <div class="admin-section-heading">
        <h2 id="admin-open-shifts-title">HORAIRES VACANTS</h2>
      </div>
      <a
        href="admin-horaires-completer.html"
        class="admin-search-button"
        style="display:flex;align-items:center;justify-content:center;width:100%;text-decoration:none;box-sizing:border-box;"
      >
        Voir
      </a>
    `;

    if (statsSection) management.insertBefore(section, statsSection);
    else management.appendChild(section);
  }

  const openShiftsTitle = document.getElementById("admin-open-shifts-title");
  if (openShiftsTitle) openShiftsTitle.textContent = "HORAIRES VACANTS";

  const openShiftsSection = openShiftsTitle?.closest(".admin-management-section");
  const openShiftsLink = openShiftsSection?.querySelector('a[href="admin-horaires-completer.html"]');
  if (openShiftsLink) openShiftsLink.textContent = "Voir";

  const statsLink = document.querySelector('a[href="admin-stats.html"]');
  if (statsLink) statsLink.textContent = "Voir";
})();
