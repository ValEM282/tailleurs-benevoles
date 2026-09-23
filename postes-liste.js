/* =========================================================
   ADMINISTRATION — LISTE ÉDITABLE DES POSTES
   ========================================================= */

const postesTableBody = document.getElementById("postes-table-body");
const postesCount = document.getElementById("postes-count");
const postesError = document.getElementById("postes-error");
const postesLogoutButton = document.getElementById("logout-button");
const postesPrintButton = document.getElementById("print-postes-button");

const postesSearchParams = new URLSearchParams(window.location.search);
const postesSearchText = (postesSearchParams.get("poste") || "").trim();

let postesRows = [];
let postesLieux = [];
let postesResponsables = [];
let postesCurrentUser = null;

function postesUnlockStorageKey() {
  return postesCurrentUser ? `portalAdminUnlockedUntil:${postesCurrentUser.id}` : "";
}

function postesIsLocallyUnlocked() {
  if (!postesCurrentUser) return false;
  const until = Number(sessionStorage.getItem(postesUnlockStorageKey()) || 0);
  return until > Date.now();
}

function postesEscapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function postesNormalize(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
}

function postesShowError(message) {
  postesError.textContent = message;
  postesError.hidden = false;
}

function postesFilteredRows() {
  if (!postesSearchText) return postesRows;
  const needle = postesNormalize(postesSearchText);
  return postesRows.filter(row =>
    postesNormalize(row.poste_nom).includes(needle) ||
    postesNormalize(row.sous_poste_nom).includes(needle)
  );
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const text = String(value || "").trim();
    const key = text.toLocaleLowerCase("fr");
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function postesPills(values) {
  const items = uniqueStrings(values);
  if (!items.length) return '<span class="post-muted">—</span>';
  return `<div class="post-pill-list">${items.map(item => `<span class="post-pill">${postesEscapeHtml(item)}</span>`).join("")}</div>`;
}

function postesNameCell(row, kind) {
  const isParent = kind === "parent";
  const id = isParent ? row.poste_id : row.sous_poste_id;
  const value = isParent ? row.poste_nom : row.sous_poste_nom;

  if (!id) return '<span class="post-muted">—</span>';

  return `
    <div class="post-editable-display">
      <button type="button" class="post-edit-button" data-action="edit-name" data-kind="${kind}" data-id="${id}" title="Modifier" aria-label="Modifier ${isParent ? "le nom du poste" : "le nom du sous-poste"}">✏️</button>
      <span class="post-cell-value">${postesEscapeHtml(value || "—")}</span>
    </div>
  `;
}

function postesListCell(row, kind, values) {
  return `
    <div class="post-editable-display">
      <button type="button" class="post-edit-button" data-action="edit-${kind}" data-row-id="${row.ligne_poste_id}" title="Modifier" aria-label="Modifier ${kind === "lieux" ? "les lieux associés" : "les responsables"}">✏️</button>
      <div class="post-cell-value">${postesPills(values)}</div>
    </div>
  `;
}

function postesEffectiveResponsables(row) {
  return uniqueStrings([...(row.parent_responsables || []), ...(row.child_responsables || [])]);
}

function postesRenderTable() {
  const rows = postesFilteredRows();

  if (!rows.length) {
    postesTableBody.innerHTML = `<tr><td colspan="4" class="volunteers-empty">${postesSearchText ? "Aucun poste ne correspond à cette recherche." : "Aucun poste à afficher."}</td></tr>`;
    postesCount.textContent = "0 poste";
    return;
  }

  postesTableBody.innerHTML = rows.map(row => `
    <tr data-parent-id="${row.poste_id}" data-child-id="${row.sous_poste_id || ""}" data-row-id="${row.ligne_poste_id}">
      <td>${postesNameCell(row, "parent")}</td>
      <td>${postesNameCell(row, "child")}</td>
      <td>${postesListCell(row, "lieux", row.lieux || [])}</td>
      <td>${postesListCell(row, "responsables", postesEffectiveResponsables(row))}</td>
    </tr>
  `).join("");

  const parents = new Set(rows.map(row => row.poste_id));
  postesCount.textContent = `${parents.size} poste${parents.size > 1 ? "s" : ""} · ${rows.length} ligne${rows.length > 1 ? "s" : ""}`;
}

function postesFindRow(rowId) {
  return postesRows.find(row => String(row.ligne_poste_id) === String(rowId));
}

function postesOpenNameEditor(button) {
  const kind = button.dataset.kind;
  const id = Number(button.dataset.id);
  const row = postesRows.find(item => Number(kind === "parent" ? item.poste_id : item.sous_poste_id) === id);
  const cell = button.closest("td");
  if (!row || !cell) return;

  const value = kind === "parent" ? row.poste_nom : row.sous_poste_nom;
  cell.innerHTML = `
    <div class="post-editor-panel post-name-editor" data-editor="name" data-id="${id}">
      <input class="post-editor-input" type="text" value="${postesEscapeHtml(value || "")}" aria-label="Nouveau nom">
      <button type="button" class="contact-save-button" data-action="save-name" title="Valider" aria-label="Valider">✓</button>
      <button type="button" class="contact-cancel-button" data-action="cancel-editor" title="Annuler" aria-label="Annuler">✕</button>
      <span class="post-editor-error"></span>
    </div>
  `;
  const input = cell.querySelector(".post-editor-input");
  input.focus();
  input.select();
}

function postesChoiceList(options, selectedIds, group, filter = "") {
  const selected = new Set((selectedIds || []).map(String));
  const needle = postesNormalize(filter);
  return options
    .filter(option => !needle || postesNormalize(`${option.prenom || ""} ${option.nom || ""} ${option.label || ""}`).includes(needle))
    .map(option => {
      const id = option.id;
      const label = option.label || `${option.prenom || ""} ${option.nom || ""}`.trim();
      return `
        <label class="post-editor-choice">
          <input type="checkbox" data-choice-group="${group}" value="${postesEscapeHtml(id)}" ${selected.has(String(id)) ? "checked" : ""}>
          <span>${postesEscapeHtml(label)}</span>
        </label>
      `;
    }).join("") || '<span class="post-muted">Aucun résultat.</span>';
}

function postesOpenLieuxEditor(button) {
  const row = postesFindRow(button.dataset.rowId);
  const cell = button.closest("td");
  if (!row || !cell) return;

  cell.innerHTML = `
    <div class="post-editor-panel" data-editor="lieux" data-row-id="${row.ligne_poste_id}">
      <div class="post-editor-section-title">Lieu(s) associé(s)</div>
      <div class="post-editor-choice-list">
        ${postesLieux.map(lieu => `
          <label class="post-editor-choice">
            <input type="checkbox" data-choice-group="lieux" value="${lieu.id}" ${(row.lieu_ids || []).map(String).includes(String(lieu.id)) ? "checked" : ""}>
            <span>${postesEscapeHtml(lieu.nom)}</span>
          </label>
        `).join("")}
      </div>
      <div class="post-editor-actions">
        <button type="button" class="post-editor-cancel" data-action="cancel-editor">Annuler</button>
        <button type="button" class="post-editor-save" data-action="save-lieux">Valider</button>
      </div>
      <div class="post-editor-error"></div>
    </div>
  `;
}

function postesResponsableSection(title, help, group, selectedIds) {
  return `
    <div class="post-editor-section" data-responsable-section="${group}">
      <div class="post-editor-section-title">${postesEscapeHtml(title)}</div>
      ${help ? `<p class="post-editor-help">${postesEscapeHtml(help)}</p>` : ""}
      <input type="search" class="post-editor-search" data-filter-group="${group}" placeholder="Rechercher une personne…">
      <div class="post-editor-choice-list" data-choice-list="${group}">
        ${postesChoiceList(postesResponsables, selectedIds, group)}
      </div>
    </div>
  `;
}

function postesOpenResponsablesEditor(button) {
  const row = postesFindRow(button.dataset.rowId);
  const cell = button.closest("td");
  if (!row || !cell) return;

  const childSection = row.sous_poste_id
    ? postesResponsableSection(
        `Responsable(s) du sous-poste « ${row.sous_poste_nom} »`,
        "Ces responsables s’ajoutent à ceux du poste principal.",
        "child",
        row.child_responsable_ids || []
      )
    : "";

  cell.innerHTML = `
    <div class="post-editor-panel" data-editor="responsables" data-row-id="${row.ligne_poste_id}">
      ${postesResponsableSection(
        `Responsable(s) du poste « ${row.poste_nom} »`,
        row.sous_poste_id ? "Ce choix s’applique à tous les sous-postes de ce poste." : "",
        "parent",
        row.parent_responsable_ids || []
      )}
      ${childSection}
      <div class="post-editor-actions">
        <button type="button" class="post-editor-cancel" data-action="cancel-editor">Annuler</button>
        <button type="button" class="post-editor-save" data-action="save-responsables">Valider</button>
      </div>
      <div class="post-editor-error"></div>
    </div>
  `;
}

function postesEditorError(editor, message) {
  const target = editor.querySelector(".post-editor-error");
  if (target) target.textContent = message;
}

async function postesReload() {
  const { data, error } = await PortalAuth.client.rpc("admin_list_postes_details");
  if (error) throw error;
  postesRows = Array.isArray(data) ? data : [];
  postesRenderTable();
}

async function postesSaveName(button) {
  const editor = button.closest(".post-editor-panel");
  const input = editor?.querySelector(".post-editor-input");
  if (!editor || !input) return;

  const id = Number(editor.dataset.id);
  const nom = input.value.trim();
  if (!nom) {
    postesEditorError(editor, "Le nom ne peut pas être vide.");
    input.focus();
    return;
  }

  button.disabled = true;
  const cancel = editor.querySelector('[data-action="cancel-editor"]');
  if (cancel) cancel.disabled = true;

  const { error } = await PortalAuth.client.rpc("admin_update_poste_name", { p_poste_id: id, p_nom: nom });
  if (error) {
    console.error("Impossible de modifier le nom du poste :", error);
    button.disabled = false;
    if (cancel) cancel.disabled = false;
    postesEditorError(editor, error.message || "Modification impossible.");
    return;
  }

  try {
    await postesReload();
    postesError.hidden = true;
  } catch (reloadError) {
    console.error(reloadError);
    postesShowError("Le nom a été enregistré, mais la liste n'a pas pu être rechargée.");
  }
}

async function postesSaveLieux(button) {
  const editor = button.closest(".post-editor-panel");
  const row = postesFindRow(editor?.dataset.rowId);
  if (!editor || !row) return;

  const ids = [...editor.querySelectorAll('input[data-choice-group="lieux"]:checked')].map(input => Number(input.value));
  button.disabled = true;
  const cancel = editor.querySelector('[data-action="cancel-editor"]');
  if (cancel) cancel.disabled = true;

  const { error } = await PortalAuth.client.rpc("admin_set_poste_lieux", {
    p_poste_id: row.ligne_poste_id,
    p_lieu_ids: ids
  });

  if (error) {
    console.error("Impossible de modifier les lieux :", error);
    button.disabled = false;
    if (cancel) cancel.disabled = false;
    postesEditorError(editor, error.message || "Modification impossible.");
    return;
  }

  await postesReload();
  postesError.hidden = true;
}

function postesSelectedIds(editor, group) {
  return [...editor.querySelectorAll(`input[data-choice-group="${group}"]:checked`)].map(input => input.value);
}

async function postesSaveResponsables(button) {
  const editor = button.closest(".post-editor-panel");
  const row = postesFindRow(editor?.dataset.rowId);
  if (!editor || !row) return;

  const parentIds = postesSelectedIds(editor, "parent");
  const childIds = row.sous_poste_id ? postesSelectedIds(editor, "child") : [];

  button.disabled = true;
  const cancel = editor.querySelector('[data-action="cancel-editor"]');
  if (cancel) cancel.disabled = true;

  const { error } = await PortalAuth.client.rpc("admin_set_poste_responsables_scope", {
    p_parent_poste_id: row.poste_id,
    p_child_poste_id: row.sous_poste_id || null,
    p_parent_personne_ids: parentIds,
    p_child_personne_ids: childIds
  });

  if (error) {
    console.error("Impossible de modifier les responsables :", error);
    button.disabled = false;
    if (cancel) cancel.disabled = false;
    postesEditorError(editor, error.message || "Modification impossible.");
    return;
  }

  await postesReload();
  postesError.hidden = true;
}

function postesFilterChoices(input) {
  const editor = input.closest(".post-editor-panel");
  const group = input.dataset.filterGroup;
  const list = editor?.querySelector(`[data-choice-list="${group}"]`);
  if (!editor || !list) return;

  const selectedIds = postesSelectedIds(editor, group);
  list.innerHTML = postesChoiceList(postesResponsables, selectedIds, group, input.value);
}

postesTableBody.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  if (action === "edit-name") postesOpenNameEditor(button);
  else if (action === "edit-lieux") postesOpenLieuxEditor(button);
  else if (action === "edit-responsables") postesOpenResponsablesEditor(button);
  else if (action === "save-name") postesSaveName(button);
  else if (action === "save-lieux") postesSaveLieux(button);
  else if (action === "save-responsables") postesSaveResponsables(button);
  else if (action === "cancel-editor") postesRenderTable();
});

postesTableBody.addEventListener("input", event => {
  const input = event.target.closest("input[data-filter-group]");
  if (input) postesFilterChoices(input);
});

if (postesPrintButton) {
  postesPrintButton.addEventListener("click", () => window.print());
}

if (postesLogoutButton) {
  postesLogoutButton.addEventListener("click", async () => {
    if (postesCurrentUser) sessionStorage.removeItem(postesUnlockStorageKey());
    postesLogoutButton.disabled = true;
    postesLogoutButton.textContent = "Déconnexion...";
    const success = await PortalAuth.logout();
    if (!success) {
      postesLogoutButton.disabled = false;
      postesLogoutButton.textContent = "Se déconnecter";
    }
  });
}

async function loadPostesPage() {
  const user = await PortalAuth.requireAuth();
  if (!user) return;
  postesCurrentUser = user;

  const { data: isAdmin, error: roleError } = await PortalAuth.client.rpc("is_current_portal_admin");
  if (roleError || !isAdmin) {
    window.location.replace("dashboard.html");
    return;
  }

  if (!postesIsLocallyUnlocked()) {
    window.location.replace("admin.html");
    return;
  }

  const [rowsResult, lieuxResult, responsablesResult] = await Promise.all([
    PortalAuth.client.rpc("admin_list_postes_details"),
    PortalAuth.client.rpc("admin_list_lieux_options"),
    PortalAuth.client.rpc("admin_list_responsable_options")
  ]);

  if (rowsResult.error || lieuxResult.error || responsablesResult.error) {
    console.error("Impossible de charger la gestion des postes :", rowsResult.error || lieuxResult.error || responsablesResult.error);
    postesTableBody.innerHTML = "";
    postesShowError("Impossible de charger la liste des postes pour le moment.");
    postesCount.textContent = "";
    return;
  }

  postesRows = Array.isArray(rowsResult.data) ? rowsResult.data : [];
  postesLieux = Array.isArray(lieuxResult.data) ? lieuxResult.data : [];
  postesResponsables = (Array.isArray(responsablesResult.data) ? responsablesResult.data : []).map(person => ({
    ...person,
    label: `${person.prenom || ""} ${person.nom || ""}`.trim()
  }));

  postesError.hidden = true;
  postesRenderTable();
}

loadPostesPage();
