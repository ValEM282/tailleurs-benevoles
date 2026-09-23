/* =========================================================
   ADMINISTRATION — LISTE DES RESPONSABLES
   ========================================================= */

const responsablesTableBody = document.getElementById("responsables-table-body");
const responsablesCount = document.getElementById("responsables-count");
const responsablesError = document.getElementById("responsables-error");
const responsablesLogoutButton = document.getElementById("logout-button");
const responsablesPrintButton = document.getElementById("print-responsables-button");
const responsablesSortButtons = [...document.querySelectorAll(".sort-button")];

const responsablesSearchParams = new URLSearchParams(window.location.search);
const responsablesSearchFirstname = (responsablesSearchParams.get("prenom") || "").trim();
const responsablesSearchLastname = (responsablesSearchParams.get("nom") || "").trim();
const responsablesHasSearch = Boolean(responsablesSearchFirstname || responsablesSearchLastname);

let responsables = [];
let responsablesCurrentUser = null;
let responsablesSortField = "nom";
let responsablesSortDirection = "asc";

function responsablesUnlockStorageKey() {
  return responsablesCurrentUser ? `portalAdminUnlockedUntil:${responsablesCurrentUser.id}` : "";
}

function responsablesIsLocallyUnlocked() {
  if (!responsablesCurrentUser) return false;
  const until = Number(sessionStorage.getItem(responsablesUnlockStorageKey()) || 0);
  return until > Date.now();
}

function responsablesShowError(message) {
  responsablesError.textContent = message;
  responsablesError.hidden = false;
}

function responsablesNormalizeText(value) {
  return String(value ?? "").trim();
}

function responsablesNormalizeSearch(value) {
  return responsablesNormalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
}

function responsablesEscapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function responsablesMatchesSearch(person) {
  if (!responsablesHasSearch) return true;

  const firstnameMatches = !responsablesSearchFirstname ||
    responsablesNormalizeSearch(person.prenom).includes(responsablesNormalizeSearch(responsablesSearchFirstname));
  const lastnameMatches = !responsablesSearchLastname ||
    responsablesNormalizeSearch(person.nom).includes(responsablesNormalizeSearch(responsablesSearchLastname));

  return firstnameMatches && lastnameMatches;
}

function responsablesCompareFrench(a, b) {
  return responsablesNormalizeText(a).localeCompare(responsablesNormalizeText(b), "fr", {
    sensitivity: "base",
    ignorePunctuation: true
  });
}

function responsablesSortedRows() {
  return responsables
    .filter(responsablesMatchesSearch)
    .sort((a, b) => {
      let result = responsablesCompareFrench(a[responsablesSortField], b[responsablesSortField]);
      if (result === 0) {
        const secondary = responsablesSortField === "nom" ? "prenom" : "nom";
        result = responsablesCompareFrench(a[secondary], b[secondary]);
      }
      return responsablesSortDirection === "asc" ? result : -result;
    });
}

function responsablesUpdateSortIndicators() {
  document.querySelectorAll(".sort-indicator").forEach(indicator => {
    const field = indicator.dataset.indicator;
    if (field !== responsablesSortField) {
      indicator.textContent = "↕";
      return;
    }
    indicator.textContent = responsablesSortDirection === "asc" ? "↑" : "↓";
  });
}

function responsablesPostList(value) {
  const posts = Array.isArray(value) ? value.filter(Boolean) : [];
  if (!posts.length) return '<span class="responsibility-empty">—</span>';

  return `
    <div class="responsibility-list">
      ${posts.map(post => `<span class="responsibility-item">${responsablesEscapeHtml(post)}</span>`).join("")}
    </div>
  `;
}

function responsablesEditableContact(person, field) {
  const value = responsablesNormalizeText(person[field]);
  const label = field === "telephone" ? "numéro de téléphone" : "adresse e-mail";
  return `
    <div class="contact-display">
      <button
        type="button"
        class="contact-edit-button"
        data-personne-id="${responsablesEscapeHtml(person.id)}"
        data-field="${field}"
        title="Modifier le ${label}"
        aria-label="Modifier le ${label}"
      >✏️</button>
      <span class="contact-value">${responsablesEscapeHtml(value || "—")}</span>
    </div>
  `;
}

function responsablesRenderTable() {
  const rows = responsablesSortedRows();

  if (!rows.length) {
    responsablesTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="volunteers-empty">
          ${responsablesHasSearch ? "Aucun responsable ne correspond à cette recherche." : "Aucun responsable à afficher."}
        </td>
      </tr>
    `;
    responsablesCount.textContent = "0 responsable";
    responsablesUpdateSortIndicators();
    return;
  }

  responsablesTableBody.innerHTML = rows.map(person => `
    <tr>
      <td class="volunteer-name">${responsablesEscapeHtml(person.prenom || "—")}</td>
      <td class="volunteer-name">${responsablesEscapeHtml(person.nom || "—")}</td>
      <td class="contact-cell contact-phone-cell">${responsablesEditableContact(person, "telephone")}</td>
      <td class="contact-cell contact-email-cell">${responsablesEditableContact(person, "email")}</td>
      <td>${responsablesPostList(person.responsable_postes)}</td>
      <td>${responsablesPostList(person.co_responsable_postes)}</td>
    </tr>
  `).join("");

  responsablesCount.textContent = `${rows.length} responsable${rows.length > 1 ? "s" : ""}`;
  responsablesUpdateSortIndicators();
}

function responsablesValidatePhone(value) {
  const trimmed = responsablesNormalizeText(value);
  if (!trimmed) return { ok: true, value: "" };

  if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
    if (trimmed.startsWith("+32") || trimmed.startsWith("0032")) {
      return { ok: false, message: "Un numéro belge doit être au format 04XX XX XX XX." };
    }
    return { ok: true, value: trimmed };
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!/^04\d{8}$/.test(digits)) {
    return { ok: false, message: "Format attendu : 04XX XX XX XX (sauf indicatif étranger)." };
  }

  return {
    ok: true,
    value: `${digits.slice(0, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`
  };
}

function responsablesValidateEmail(value) {
  const trimmed = responsablesNormalizeText(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    ? { ok: true, value: trimmed }
    : { ok: false, message: "Adresse e-mail invalide." };
}

function responsablesOpenContactEditor(button) {
  const personId = button.dataset.personneId;
  const field = button.dataset.field;
  const person = responsables.find(item => item.id === personId);
  const cell = button.closest("td");
  if (!person || !cell) return;

  const currentValue = responsablesNormalizeText(person[field]);
  const inputType = field === "email" ? "email" : "text";
  const inputMode = field === "email" ? "email" : "tel";

  cell.innerHTML = `
    <div class="contact-editor" data-personne-id="${responsablesEscapeHtml(personId)}" data-field="${field}">
      <input
        type="${inputType}"
        inputmode="${inputMode}"
        class="contact-edit-input"
        value="${responsablesEscapeHtml(currentValue)}"
        ${field === "telephone" ? 'placeholder="04XX XX XX XX"' : 'placeholder="nom@exemple.be"'}
        aria-label="Nouvelle valeur"
      >
      <button type="button" class="contact-save-button" title="Valider" aria-label="Valider">✓</button>
      <button type="button" class="contact-cancel-button" title="Annuler" aria-label="Annuler">✕</button>
      <span class="contact-edit-error" aria-live="polite"></span>
    </div>
  `;

  const input = cell.querySelector(".contact-edit-input");
  input.focus();
  input.select();
}

function responsablesShowContactEditError(editor, message) {
  const error = editor.querySelector(".contact-edit-error");
  const input = editor.querySelector(".contact-edit-input");
  if (error) error.textContent = message;
  if (input) {
    input.classList.add("contact-edit-input-error");
    input.focus();
  }
}

async function responsablesSaveContactEditor(button) {
  const editor = button.closest(".contact-editor");
  if (!editor) return;

  const personId = editor.dataset.personneId;
  const field = editor.dataset.field;
  const input = editor.querySelector(".contact-edit-input");
  const saveButton = editor.querySelector(".contact-save-button");
  const cancelButton = editor.querySelector(".contact-cancel-button");

  const validation = field === "telephone"
    ? responsablesValidatePhone(input.value)
    : responsablesValidateEmail(input.value);

  if (!validation.ok) {
    responsablesShowContactEditError(editor, validation.message);
    return;
  }

  saveButton.disabled = true;
  cancelButton.disabled = true;
  input.disabled = true;

  const { data, error } = await PortalAuth.client.rpc("admin_update_benevole_contact", {
    p_benevole_id: personId,
    p_field: field,
    p_value: validation.value
  });

  if (error) {
    console.error("Impossible de modifier le contact :", error);
    saveButton.disabled = false;
    cancelButton.disabled = false;
    input.disabled = false;
    responsablesShowContactEditError(editor, error.message || "La modification n'a pas pu être enregistrée.");
    return;
  }

  const updated = Array.isArray(data) ? data[0] : data;
  const person = responsables.find(item => item.id === personId);
  if (person) {
    person.telephone = updated?.telephone ?? person.telephone;
    person.email = updated?.email ?? person.email;
  }

  responsablesError.hidden = true;
  responsablesRenderTable();
}

responsablesTableBody.addEventListener("click", event => {
  const editButton = event.target.closest(".contact-edit-button");
  if (editButton) {
    responsablesOpenContactEditor(editButton);
    return;
  }

  const saveButton = event.target.closest(".contact-save-button");
  if (saveButton) {
    responsablesSaveContactEditor(saveButton);
    return;
  }

  const cancelButton = event.target.closest(".contact-cancel-button");
  if (cancelButton) responsablesRenderTable();
});

responsablesSortButtons.forEach(button => {
  button.addEventListener("click", () => {
    const field = button.dataset.sort;
    if (field === responsablesSortField) {
      responsablesSortDirection = responsablesSortDirection === "asc" ? "desc" : "asc";
    } else {
      responsablesSortField = field;
      responsablesSortDirection = "asc";
    }
    responsablesRenderTable();
  });
});

if (responsablesPrintButton) {
  responsablesPrintButton.addEventListener("click", () => {
    window.print();
  });
}

if (responsablesLogoutButton) {
  responsablesLogoutButton.addEventListener("click", async () => {
    if (responsablesCurrentUser) {
      sessionStorage.removeItem(responsablesUnlockStorageKey());
    }
    responsablesLogoutButton.disabled = true;
    responsablesLogoutButton.textContent = "Déconnexion...";
    const success = await PortalAuth.logout();
    if (!success) {
      responsablesLogoutButton.disabled = false;
      responsablesLogoutButton.textContent = "Se déconnecter";
    }
  });
}

async function loadResponsables() {
  const user = await PortalAuth.requireAuth();
  if (!user) return;

  responsablesCurrentUser = user;

  const { data: isAdmin, error: roleError } = await PortalAuth.client.rpc("is_current_portal_admin");
  if (roleError || !isAdmin) {
    window.location.replace("dashboard.html");
    return;
  }

  if (!responsablesIsLocallyUnlocked()) {
    window.location.replace("admin.html");
    return;
  }

  const { data, error } = await PortalAuth.client.rpc("admin_list_responsables");
  if (error) {
    console.error("Impossible de charger la liste des responsables :", error);
    responsablesTableBody.innerHTML = "";
    responsablesShowError("Impossible de charger la liste des responsables pour le moment.");
    responsablesCount.textContent = "";
    return;
  }

  responsables = Array.isArray(data) ? data : [];
  responsablesError.hidden = true;
  responsablesRenderTable();
}

loadResponsables();
