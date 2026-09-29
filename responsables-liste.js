/* =========================================================
   ADMINISTRATION — LISTE DES RESPONSABLES
   ========================================================= */

const responsablesTableBody = document.getElementById("responsables-table-body");
const responsablesCount = document.getElementById("responsables-count");
const responsablesError = document.getElementById("responsables-error");
const responsablesLogoutButton = document.getElementById("logout-button");
const responsablesPrintButton = document.getElementById("print-responsables-button");
const responsablesSortButtons = [...document.querySelectorAll(".sort-button")];
const responsablesPrintSelectedLabelsButton = document.getElementById("print-selected-responsables-labels-button");
const responsablesSelectAllLabels = document.getElementById("select-all-responsables-labels");
const responsablesSelectedLabelIds = new Set();

const responsablesSearchParams = new URLSearchParams(window.location.search);
const responsablesSearchFirstname = (responsablesSearchParams.get("prenom") || "").trim();
const responsablesSearchLastname = (responsablesSearchParams.get("nom") || "").trim();
const responsablesHasSearch = Boolean(responsablesSearchFirstname || responsablesSearchLastname);

let responsables = [];
let responsablesCurrentUser = null;
let responsablesSortField = "nom";
let responsablesSortDirection = "asc";
let responsablesActivityFilter = "all"; // all -> active -> inactive -> all

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

function responsablesMatchesActivity(person) {
  if (responsablesActivityFilter === "active") return Boolean(person.en_poste);
  if (responsablesActivityFilter === "inactive") return !person.en_poste;
  return true;
}

function responsablesSortedRows() {
  return responsables
    .filter(person => responsablesMatchesSearch(person) && responsablesMatchesActivity(person))
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
  return `<div class="responsibility-list">${posts.map(post => `<span class="responsibility-item">${responsablesEscapeHtml(post)}</span>`).join("")}</div>`;
}

function responsablesEditablePosts(person, kind) {
  const field = kind === "responsable" ? "responsable_postes" : "co_responsable_postes";
  const label = kind === "responsable" ? "Responsable" : "Co-responsable";
  return `<div class="responsibility-display">
    <button type="button" class="responsibility-edit-button" data-personne-id="${responsablesEscapeHtml(person.id)}" data-kind="${kind}" title="Modifier ${label}" aria-label="Modifier ${label}">✏️</button>
    <div class="responsibility-values">${responsablesPostList(person[field])}</div>
  </div>`;
}

async function responsablesOpenPostsEditor(button) {
  const personId=button.dataset.personneId, kind=button.dataset.kind;
  const person=responsables.find(x=>x.id===personId), cell=button.closest("td");
  if(!person||!cell) return;
  const field=kind==="responsable"?"responsable_postes":"co_responsable_postes";
  const current=new Set(Array.isArray(person[field])?person[field]:[]);
  const {data,error}=await PortalAuth.client.rpc("admin_get_schedule_edit_options");
  if(error){responsablesShowError("Impossible de charger les postes."); return;}
  const posts=(data?.postes||data?.posts||[]).filter(p=>p?.actif!==false);
  const options=posts.map(p=>`<label class="responsibility-option"><input type="checkbox" value="${p.id}" ${current.has(p.nom)?"checked":""}><span>${responsablesEscapeHtml(p.nom)}</span></label>`).join("");
  cell.innerHTML=`<div class="responsibility-editor" data-personne-id="${responsablesEscapeHtml(personId)}" data-kind="${kind}">
    <div class="responsibility-options">${options||"<span>Aucun poste disponible.</span>"}</div>
    <div class="responsibility-editor-actions"><button type="button" class="contact-save-button responsibility-save-button" title="Valider">✓</button><button type="button" class="contact-cancel-button responsibility-cancel-button" title="Annuler">✕</button></div>
    <span class="contact-edit-error" aria-live="polite"></span>
  </div>`;
}

async function responsablesSavePostsEditor(button){
 const editor=button.closest(".responsibility-editor"); if(!editor)return;
 const ids=[...editor.querySelectorAll('input[type="checkbox"]:checked')].map(x=>Number(x.value));
 const save=editor.querySelector(".responsibility-save-button"), cancel=editor.querySelector(".responsibility-cancel-button");
 save.disabled=true; cancel.disabled=true;
 const {error}=await PortalAuth.client.rpc("admin_set_person_responsibilities",{p_personne_id:editor.dataset.personneId,p_kind:editor.dataset.kind,p_poste_ids:ids});
 if(error){save.disabled=false;cancel.disabled=false;editor.querySelector(".contact-edit-error").textContent=error.message||"Modification impossible.";return;}
 const refreshed=await PortalAuth.client.rpc("admin_list_responsables");
 if(refreshed.error){responsablesShowError("Modification enregistrée, mais la liste n’a pas pu être actualisée.");return;}
 responsables=Array.isArray(refreshed.data)?refreshed.data:[]; responsablesError.hidden=true; responsablesRenderTable();
}

function responsablesScheduleButton(person) {
  const label = `${person.prenom || ""} ${person.nom || ""}`.trim() || "cette personne";
  const params = new URLSearchParams({ id: person.id, prenom: person.prenom || "", nom: person.nom || "" });
  const activeClass = person.en_poste ? " schedule-view-button-active" : "";
  return `<a class="schedule-view-button${activeClass}" href="benevole-horaires-admin.html?${params.toString()}" title="Voir ou créer un horaire pour ${responsablesEscapeHtml(label)}" aria-label="Voir ou créer un horaire pour ${responsablesEscapeHtml(label)}">🕥</a>`;
}

function responsablesActivityFilterButton() {
  const cls = responsablesActivityFilter === "active" ? "activity-filter-active" : responsablesActivityFilter === "inactive" ? "activity-filter-inactive" : "activity-filter-all";
  const title = responsablesActivityFilter === "active" ? "Responsables actuellement en poste" : responsablesActivityFilter === "inactive" ? "Responsables qui ne sont pas actuellement en poste" : "Tous les responsables";
  return `<button type="button" id="responsables-activity-filter-button" class="activity-filter-button ${cls}" title="${title}" aria-label="${title}">🕥</button>`;
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
        <td colspan="7" class="volunteers-empty">
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
      <td class="label-select-cell"><input type="checkbox" class="label-select-checkbox responsable-label-select" data-personne-id="${responsablesEscapeHtml(person.id)}" ${responsablesSelectedLabelIds.has(person.id) ? "checked" : ""} aria-label="Sélectionner ${responsablesEscapeHtml((person.prenom || "") + " " + (person.nom || ""))} pour l’impression d’étiquette"></td>
      <td class="volunteer-name"><span class="responsable-name-with-schedule">${responsablesScheduleButton(person)}<span>${responsablesEscapeHtml(person.prenom || "—")}</span></span></td>
      <td class="volunteer-name">${responsablesEscapeHtml(person.nom || "—")}</td>
      <td class="contact-cell contact-phone-cell">${responsablesEditableContact(person, "telephone")}</td>
      <td class="contact-cell contact-email-cell">${responsablesEditableContact(person, "email")}</td>
      <td class="responsibility-cell">${responsablesEditablePosts(person, "responsable")}</td>
      <td class="responsibility-cell">${responsablesEditablePosts(person, "co_responsable")}</td>
    </tr>
  `).join("");

  responsablesCount.textContent = `${rows.length} responsable${rows.length > 1 ? "s" : ""}`;
  responsablesUpdateSortIndicators();
  responsablesUpdateLabelSelection();
}

function responsablesUpdateLabelSelection() {
  const visible = responsablesSortedRows();
  const selectedVisible = visible.filter(p => responsablesSelectedLabelIds.has(p.id)).length;
  if (responsablesSelectAllLabels) {
    responsablesSelectAllLabels.checked = visible.length > 0 && selectedVisible === visible.length;
    responsablesSelectAllLabels.indeterminate = selectedVisible > 0 && selectedVisible < visible.length;
  }
  if (responsablesPrintSelectedLabelsButton) {
    responsablesPrintSelectedLabelsButton.disabled = responsablesSelectedLabelIds.size === 0;
    responsablesPrintSelectedLabelsButton.textContent = responsablesSelectedLabelIds.size
      ? `Imprimer ${responsablesSelectedLabelIds.size} étiquette${responsablesSelectedLabelIds.size > 1 ? "s" : ""}`
      : "Imprimer les étiquettes sélectionnées";
  }
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

document.addEventListener("click", event => {
  const filter = event.target.closest("#responsables-activity-filter-button");
  if (filter) {
    responsablesActivityFilter = responsablesActivityFilter === "all" ? "active" : responsablesActivityFilter === "active" ? "inactive" : "all";
    responsablesRenderTable();
    const heading = document.getElementById("responsables-prenom-heading");
    if (heading) heading.innerHTML = responsablesActivityFilterButton() + heading.dataset.label;
    return;
  }
});

responsablesTableBody.addEventListener("change", event => {
  const checkbox = event.target.closest(".responsable-label-select");
  if (!checkbox) return;
  checkbox.checked ? responsablesSelectedLabelIds.add(checkbox.dataset.personneId) : responsablesSelectedLabelIds.delete(checkbox.dataset.personneId);
  responsablesUpdateLabelSelection();
});

if (responsablesSelectAllLabels) responsablesSelectAllLabels.addEventListener("change", () => {
  responsablesSortedRows().forEach(p => responsablesSelectAllLabels.checked ? responsablesSelectedLabelIds.add(p.id) : responsablesSelectedLabelIds.delete(p.id));
  responsablesRenderTable();
});

if (responsablesPrintSelectedLabelsButton) responsablesPrintSelectedLabelsButton.addEventListener("click", () => {
  if (!responsablesSelectedLabelIds.size) return;
  const params = new URLSearchParams({ print: "1", ids: [...responsablesSelectedLabelIds].join(","), source: "responsables" });
  window.location.href = `etiquettes-benevoles.html?${params.toString()}`;
});

responsablesTableBody.addEventListener("click", event => {
  const responsibilityEdit = event.target.closest(".responsibility-edit-button");
  if (responsibilityEdit) { responsablesOpenPostsEditor(responsibilityEdit); return; }
  const responsibilitySave = event.target.closest(".responsibility-save-button");
  if (responsibilitySave) { responsablesSavePostsEditor(responsibilitySave); return; }
  const responsibilityCancel = event.target.closest(".responsibility-cancel-button");
  if (responsibilityCancel) { responsablesRenderTable(); return; }

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
