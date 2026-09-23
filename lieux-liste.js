/* Administration — liste éditable des lieux */

const lieuxTableBody = document.getElementById("lieux-table-body");
const lieuxCount = document.getElementById("lieux-count");
const lieuxError = document.getElementById("lieux-error");
const lieuxLogoutButton = document.getElementById("logout-button");
const lieuxPrintButton = document.getElementById("print-lieux-button");

const lieuxSearchParams = new URLSearchParams(window.location.search);
const lieuxSearchText = (lieuxSearchParams.get("lieu") || "").trim();

let lieuxRows = [];
let lieuxCurrentUser = null;

function lieuxUnlockStorageKey() {
  return lieuxCurrentUser ? `portalAdminUnlockedUntil:${lieuxCurrentUser.id}` : "";
}

function lieuxIsLocallyUnlocked() {
  if (!lieuxCurrentUser) return false;
  return Number(sessionStorage.getItem(lieuxUnlockStorageKey()) || 0) > Date.now();
}

function lieuxEscapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function lieuxNormalize(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
}

function lieuxFilteredRows() {
  if (!lieuxSearchText) return lieuxRows;
  const needle = lieuxNormalize(lieuxSearchText);
  return lieuxRows.filter(lieu => lieuxNormalize(lieu.nom).includes(needle));
}

function lieuxRender() {
  const rows = lieuxFilteredRows();

  if (!rows.length) {
    lieuxTableBody.innerHTML = `<tr><td class="volunteers-empty">${lieuxSearchText ? "Aucun lieu ne correspond à cette recherche." : "Aucun lieu à afficher."}</td></tr>`;
    lieuxCount.textContent = "0 lieu";
    return;
  }

  lieuxTableBody.innerHTML = rows.map(lieu => `
    <tr data-lieu-id="${lieu.id}">
      <td>
        <div class="place-display">
          <button type="button" class="place-edit-button" data-action="edit" data-lieu-id="${lieu.id}" title="Modifier" aria-label="Modifier le nom du lieu">✏️</button>
          <span class="place-name">${lieuxEscapeHtml(lieu.nom)}</span>
        </div>
      </td>
    </tr>
  `).join("");

  lieuxCount.textContent = `${rows.length} lieu${rows.length > 1 ? "x" : ""}`;
}

function lieuxOpenEditor(button) {
  const id = Number(button.dataset.lieuId);
  const lieu = lieuxRows.find(item => Number(item.id) === id);
  const cell = button.closest("td");
  if (!lieu || !cell) return;

  cell.innerHTML = `
    <div class="place-editor" data-lieu-id="${id}">
      <input type="text" value="${lieuxEscapeHtml(lieu.nom)}" aria-label="Nouveau nom du lieu">
      <button type="button" class="place-save" data-action="save" title="Valider" aria-label="Valider">✓</button>
      <button type="button" class="place-cancel" data-action="cancel" title="Annuler" aria-label="Annuler">✕</button>
      <span class="place-editor-error"></span>
    </div>
  `;

  const input = cell.querySelector("input");
  input.focus();
  input.select();
}

async function lieuxSave(button) {
  const editor = button.closest(".place-editor");
  const input = editor?.querySelector("input");
  if (!editor || !input) return;

  const id = Number(editor.dataset.lieuId);
  const nom = input.value.trim();
  const errorElement = editor.querySelector(".place-editor-error");

  if (!nom) {
    errorElement.textContent = "Le nom du lieu ne peut pas être vide.";
    input.focus();
    return;
  }

  button.disabled = true;
  const cancel = editor.querySelector('[data-action="cancel"]');
  cancel.disabled = true;

  const { error } = await PortalAuth.client.rpc("admin_update_lieu_name", {
    p_lieu_id: id,
    p_nom: nom
  });

  if (error) {
    console.error("Impossible de modifier le lieu :", error);
    errorElement.textContent = error.message || "Modification impossible.";
    button.disabled = false;
    cancel.disabled = false;
    return;
  }

  const lieu = lieuxRows.find(item => Number(item.id) === id);
  if (lieu) lieu.nom = nom;
  lieuxError.hidden = true;
  lieuxRender();
}

lieuxTableBody.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  if (button.dataset.action === "edit") lieuxOpenEditor(button);
  else if (button.dataset.action === "save") lieuxSave(button);
  else if (button.dataset.action === "cancel") lieuxRender();
});

if (lieuxPrintButton) {
  lieuxPrintButton.addEventListener("click", () => window.print());
}

if (lieuxLogoutButton) {
  lieuxLogoutButton.addEventListener("click", async () => {
    if (lieuxCurrentUser) sessionStorage.removeItem(lieuxUnlockStorageKey());
    lieuxLogoutButton.disabled = true;
    lieuxLogoutButton.textContent = "Déconnexion...";
    const success = await PortalAuth.logout();
    if (!success) {
      lieuxLogoutButton.disabled = false;
      lieuxLogoutButton.textContent = "Se déconnecter";
    }
  });
}

async function loadLieuxPage() {
  const user = await PortalAuth.requireAuth();
  if (!user) return;
  lieuxCurrentUser = user;

  const { data: isAdmin, error: roleError } = await PortalAuth.client.rpc("is_current_portal_admin");
  if (roleError || !isAdmin) {
    window.location.replace("dashboard.html");
    return;
  }

  if (!lieuxIsLocallyUnlocked()) {
    window.location.replace("admin.html");
    return;
  }

  const { data, error } = await PortalAuth.client.rpc("admin_list_lieux_options");
  if (error) {
    console.error("Impossible de charger les lieux :", error);
    lieuxTableBody.innerHTML = "";
    lieuxError.textContent = "Impossible de charger la liste des lieux pour le moment.";
    lieuxError.hidden = false;
    lieuxCount.textContent = "";
    return;
  }

  lieuxRows = Array.isArray(data) ? data : [];
  lieuxError.hidden = true;
  lieuxRender();
}

loadLieuxPage();
