/* Administration — navigation et création des lieux */

(() => {
  const listButton = document.getElementById("admin-place-list");
  const searchButton = document.getElementById("admin-place-search");
  const searchInput = document.getElementById("place-search-name");
  const addButton = document.getElementById("admin-place-add");

  if (!listButton || !searchButton || !searchInput || !addButton) return;

  const section = addButton.closest(".admin-management-section");
  const searchGrid = searchInput.closest(".admin-search-grid");
  if (!section || !searchGrid) return;

  let createPanel = document.getElementById("admin-place-create-panel");
  if (!createPanel) {
    createPanel = document.createElement("div");
    createPanel.id = "admin-place-create-panel";
    createPanel.className = "admin-volunteer-create-panel";
    createPanel.hidden = true;
    createPanel.innerHTML = `
      <h3>Ajouter un lieu</h3>
      <form id="admin-place-create-form">
        <div class="admin-volunteer-create-grid">
          <div class="admin-search-field">
            <label for="new-place-name">Nom du Lieu</label>
            <input id="new-place-name" name="nom" type="text" autocomplete="off" required>
          </div>
          <div class="admin-search-field">
            <label for="new-place-google-maps">Google Maps</label>
            <input id="new-place-google-maps" name="google_maps_url" type="url" autocomplete="off" placeholder="https://maps.app.goo.gl/…">
          </div>
        </div>
        <p id="admin-place-create-error" class="admin-volunteer-create-error" role="alert" hidden></p>
        <div class="admin-volunteer-create-actions">
          <button type="button" class="admin-secondary-button" id="admin-place-create-cancel">Annuler</button>
          <button type="submit" class="admin-primary-button">Valider</button>
        </div>
      </form>
    `;
    searchGrid.insertAdjacentElement("afterend", createPanel);
  }

  addButton.setAttribute("aria-controls", "admin-place-create-panel");
  addButton.setAttribute("aria-expanded", "false");

  const form = createPanel.querySelector("#admin-place-create-form");
  const cancelButton = createPanel.querySelector("#admin-place-create-cancel");
  const nameInput = createPanel.querySelector("#new-place-name");
  const mapInput = createPanel.querySelector("#new-place-google-maps");
  const errorElement = createPanel.querySelector("#admin-place-create-error");

  function openSearch() {
    const lieu = searchInput.value.trim();
    const params = new URLSearchParams();
    if (lieu) params.set("lieu", lieu);
    const query = params.toString();
    window.location.href = query ? `lieux-liste.html?${query}` : "lieux-liste.html";
  }

  function showError(message, input) {
    errorElement.textContent = message;
    errorElement.hidden = false;
    input?.focus();
  }

  function setCreateOpen(open) {
    createPanel.hidden = !open;
    addButton.setAttribute("aria-expanded", String(open));
    errorElement.hidden = true;
    errorElement.textContent = "";

    if (open) {
      nameInput.focus();
    } else {
      form.reset();
      addButton.focus();
    }
  }

  listButton.addEventListener("click", () => {
    window.location.href = "lieux-liste.html";
  });

  searchButton.addEventListener("click", openSearch);
  searchInput.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    openSearch();
  });

  addButton.addEventListener("click", () => {
    setCreateOpen(createPanel.hidden);
  });

  cancelButton.addEventListener("click", () => {
    setCreateOpen(false);
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const nom = nameInput.value.trim();
    const url = mapInput.value.trim();

    if (!nom) {
      showError("Indique le nom du lieu.", nameInput);
      return;
    }

    if (url && !/^https:\/\//i.test(url)) {
      showError("Le lien Google Maps doit commencer par https://", mapInput);
      return;
    }

    errorElement.hidden = true;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    cancelButton.disabled = true;

    try {
      const { error } = await PortalAuth.client.rpc("admin_create_lieu", {
        p_nom: nom,
        p_google_maps_url: url || null
      });

      if (error) {
        console.error("Impossible de créer le lieu :", error);
        showError(error.message || "Impossible de créer le lieu pour le moment.");
        return;
      }

      const params = new URLSearchParams({ lieu: nom });
      window.location.href = `lieux-liste.html?${params.toString()}`;
    } catch (error) {
      console.error("Impossible de créer le lieu :", error);
      showError("Impossible de créer le lieu pour le moment.");
    } finally {
      submit.disabled = false;
      cancelButton.disabled = false;
    }
  });
})();
