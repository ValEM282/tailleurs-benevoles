/* Administration — responsables / co-responsables */

(() => {
  const listButton = document.getElementById("admin-responsible-list");
  const searchButton = document.getElementById("admin-responsible-search");
  const searchFirstname = document.getElementById("responsible-search-firstname");
  const searchLastname = document.getElementById("responsible-search-lastname");
  const addButton = document.getElementById("admin-responsible-add");
  const createPanel = document.getElementById("admin-responsible-create-panel");
  const createForm = document.getElementById("admin-responsible-create-form");
  const cancelButton = document.getElementById("admin-responsible-create-cancel");
  const errorElement = document.getElementById("admin-responsible-create-error");
  const firstnameInput = document.getElementById("new-responsible-firstname");
  const lastnameInput = document.getElementById("new-responsible-lastname");
  const phoneInput = document.getElementById("new-responsible-phone");
  const emailInput = document.getElementById("new-responsible-email");
  const mainPosts = document.getElementById("new-responsible-main-posts");
  const coPosts = document.getElementById("new-responsible-co-posts");

  if (!listButton || !searchButton || !addButton || !createPanel || !createForm) return;

  let postsLoaded = false;
  let postsLoading = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function openSearch() {
    const prenom = (searchFirstname?.value || "").trim();
    const nom = (searchLastname?.value || "").trim();
    const params = new URLSearchParams();
    if (prenom) params.set("prenom", prenom);
    if (nom) params.set("nom", nom);
    const query = params.toString();
    window.location.href = query
      ? `responsables-liste.html?${query}`
      : "responsables-liste.html";
  }

  function formatBelgianPhoneDigits(digits) {
    return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8), digits.slice(8, 10)]
      .filter(Boolean)
      .join(" ");
  }

  function formatPhoneInput(input) {
    const original = input.value;
    const trimmedStart = original.trimStart();
    if (trimmedStart.startsWith("+") || trimmedStart.startsWith("00")) return;

    const cursor = input.selectionStart ?? original.length;
    const digitsBeforeCursor = original.slice(0, cursor).replace(/\D/g, "").length;
    const formatted = formatBelgianPhoneDigits(original.replace(/\D/g, "").slice(0, 10));
    if (formatted === original) return;

    input.value = formatted;
    let newCursor = 0;
    let digitsSeen = 0;
    while (newCursor < formatted.length && digitsSeen < digitsBeforeCursor) {
      if (/\d/.test(formatted[newCursor])) digitsSeen += 1;
      newCursor += 1;
    }
    const finalCursor = cursor === original.length ? formatted.length : newCursor;
    input.setSelectionRange(finalCursor, finalCursor);
  }

  function normalizePhone(value) {
    const phone = String(value || "").trim();
    if (!phone) return { value: null };

    if (phone.startsWith("+") || phone.startsWith("00")) {
      if (phone.startsWith("+32") || phone.startsWith("0032")) {
        return { error: "Un numéro belge doit être au format 04XX XX XX XX." };
      }
      return { value: phone };
    }

    const digits = phone.replace(/\D/g, "");
    if (!/^04\d{8}$/.test(digits)) {
      return { error: "Format attendu : 04XX XX XX XX (sauf indicatif étranger)." };
    }
    return { value: formatBelgianPhoneDigits(digits) };
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

  function selectedPostIds(container) {
    return [...container.querySelectorAll('input[type="checkbox"]:checked')]
      .map(input => Number(input.value))
      .filter(Number.isFinite);
  }

  function renderPosts(posts) {
    const makeChoices = kind => posts.map(post => `
      <label class="admin-post-choice">
        <input type="checkbox" value="${post.id}" data-responsibility-kind="${kind}">
        <span>${escapeHtml(post.nom)}</span>
      </label>
    `).join("");

    if (!posts.length) {
      const empty = '<p class="admin-post-choice-empty">Aucun poste actif.</p>';
      mainPosts.innerHTML = empty;
      coPosts.innerHTML = empty;
      return;
    }

    mainPosts.innerHTML = makeChoices("main");
    coPosts.innerHTML = makeChoices("co");
  }

  async function loadPosts() {
    if (postsLoaded || postsLoading) return;
    postsLoading = true;
    mainPosts.textContent = "Chargement des postes…";
    coPosts.textContent = "Chargement des postes…";

    const { data, error } = await PortalAuth.client.rpc("admin_list_responsable_postes");
    postsLoading = false;

    if (error) {
      console.error("Impossible de charger les postes :", error);
      mainPosts.innerHTML = '<p class="admin-post-choice-empty">Impossible de charger les postes.</p>';
      coPosts.innerHTML = '<p class="admin-post-choice-empty">Impossible de charger les postes.</p>';
      showError("Impossible de charger la liste des postes pour le moment.");
      return;
    }

    renderPosts(Array.isArray(data) ? data : []);
    postsLoaded = true;
  }

  function setCreateOpen(open) {
    createPanel.hidden = !open;
    addButton.setAttribute("aria-expanded", String(open));
    clearError();

    if (open) {
      loadPosts();
      firstnameInput.focus();
      return;
    }

    createForm.reset();
    addButton.focus();
  }

  function handleExclusivePostChoice(event) {
    const input = event.target.closest('input[type="checkbox"][data-responsibility-kind]');
    if (!input || !input.checked) return;

    const opposite = input.dataset.responsibilityKind === "main" ? coPosts : mainPosts;
    const counterpart = [...opposite.querySelectorAll('input[type="checkbox"]')]
      .find(item => item.value === input.value);
    if (counterpart) counterpart.checked = false;
  }

  listButton.addEventListener("click", () => {
    window.location.href = "responsables-liste.html";
  });

  searchButton.addEventListener("click", openSearch);

  [searchFirstname, searchLastname].forEach(input => {
    if (!input) return;
    input.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      openSearch();
    });
  });

  addButton.addEventListener("click", () => {
    setCreateOpen(createPanel.hidden);
  });

  cancelButton.addEventListener("click", () => {
    setCreateOpen(false);
  });

  lastnameInput.addEventListener("change", () => {
    lastnameInput.value = lastnameInput.value.trim().toLocaleUpperCase("fr");
  });

  phoneInput.addEventListener("input", () => {
    formatPhoneInput(phoneInput);
  });

  mainPosts.addEventListener("change", handleExclusivePostChoice);
  coPosts.addEventListener("change", handleExclusivePostChoice);

  createForm.addEventListener("submit", async event => {
    event.preventDefault();

    const prenom = firstnameInput.value.trim();
    const nom = lastnameInput.value.trim().toLocaleUpperCase("fr");
    const email = emailInput.value.trim().toLowerCase();
    const phone = normalizePhone(phoneInput.value);
    const responsableIds = selectedPostIds(mainPosts);
    const coResponsableIds = selectedPostIds(coPosts);

    lastnameInput.value = nom;
    if (!phone.error) phoneInput.value = phone.value || "";

    if (!prenom || !nom) {
      showError("Indique le prénom et le NOM.", !prenom ? firstnameInput : lastnameInput);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError("Adresse e-mail invalide.", emailInput);
      return;
    }

    if (phone.error) {
      showError(phone.error, phoneInput);
      return;
    }

    if (!responsableIds.length && !coResponsableIds.length) {
      showError("Choisis au moins un poste comme Responsable ou Co-responsable.");
      return;
    }

    clearError();
    const submit = createForm.querySelector('[type="submit"]');
    submit.disabled = true;
    cancelButton.disabled = true;

    try {
      const { error } = await PortalAuth.client.rpc("admin_create_responsable", {
        p_prenom: prenom,
        p_nom: nom,
        p_telephone: phone.value,
        p_email: email,
        p_responsable_poste_ids: responsableIds,
        p_co_responsable_poste_ids: coResponsableIds
      });

      if (error) {
        console.error("Impossible de créer le responsable :", error);
        showError(error.message || "Impossible d'enregistrer cette personne pour le moment.");
        return;
      }

      const params = new URLSearchParams({ prenom, nom });
      window.location.href = `responsables-liste.html?${params.toString()}`;
    } catch (error) {
      console.error("Impossible de créer le responsable :", error);
      showError("Impossible d'enregistrer cette personne pour le moment.");
    } finally {
      submit.disabled = false;
      cancelButton.disabled = false;
    }
  });
})();

/* Navigation de l'encadré Postes */
(() => {
  const listButton = document.getElementById("admin-post-list");
  const searchButton = document.getElementById("admin-post-search");
  const searchInput = document.getElementById("post-search-name");

  if (!listButton || !searchButton || !searchInput) return;

  function openPostSearch() {
    const poste = searchInput.value.trim();
    const params = new URLSearchParams();
    if (poste) params.set("poste", poste);
    const query = params.toString();
    window.location.href = query ? `postes-liste.html?${query}` : "postes-liste.html";
  }

  listButton.addEventListener("click", () => {
    window.location.href = "postes-liste.html";
  });

  searchButton.addEventListener("click", openPostSearch);

  searchInput.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    openPostSearch();
  });
})();
