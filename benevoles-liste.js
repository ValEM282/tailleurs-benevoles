/* =========================================================
   ADMINISTRATION — LISTE DES BÉNÉVOLES
   ========================================================= */

const tableBody = document.getElementById("volunteers-table-body");
const countElement = document.getElementById("volunteers-count");
const errorElement = document.getElementById("volunteers-error");
const logoutButton = document.getElementById("logout-button");
const printButton = document.getElementById("print-volunteers-button");
const activityFilterButton = document.getElementById("activity-filter-button");
const sortButtons = [...document.querySelectorAll(".sort-button")];
const printAllLabelsButton = document.getElementById("print-all-labels-button");

const searchParams = new URLSearchParams(window.location.search);
const searchFirstname = (searchParams.get("prenom") || "").trim();
const searchLastname = (searchParams.get("nom") || "").trim();
const youthMovement = searchParams.get("mouvement") === "jeunesse";
const youthUnit = (searchParams.get("unite") || "").trim().toLowerCase();
const hasSearch = Boolean(searchFirstname || searchLastname || youthMovement);

let volunteers = [];
let currentUser = null;
let sortField = "nom";
let sortDirection = "asc";
let activityFilter = "all"; // all -> active -> inactive -> all

if (youthMovement && printAllLabelsButton) {
  printAllLabelsButton.textContent = "Imprimer le planning horaire";
  printAllLabelsButton.href = "#";
}

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

function normalizeSearch(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
}

function isYouthMovementVolunteer(volunteer) {
  return /^(guide|patro|pionnier)\s*0*\d+$/i.test(normalizeText(volunteer.prenom));
}

function matchesYouthMovement(volunteer) {
  // Les membres des mouvements de jeunesse ne sont visibles que
  // depuis l'encadré MOUVEMENT DE JEUNESSE de la page ADMIN.
  if (!youthMovement) return !isYouthMovementVolunteer(volunteer);
  const firstname = normalizeSearch(volunteer.prenom);
  if (youthUnit === "guide") return /^guide\s*0*\d+$/i.test(normalizeText(volunteer.prenom));
  if (youthUnit === "patro") return /^patro\s*0*\d+$/i.test(normalizeText(volunteer.prenom));
  if (youthUnit === "pionnier") return /^pionnier\s*0*\d+$/i.test(normalizeText(volunteer.prenom));
  return /^(guide|patro|pionnier)\s*0*\d+$/i.test(normalizeText(volunteer.prenom));
}

function matchesSearch(volunteer) {
  // Toujours appliquer le filtre MOUVEMENTS DE JEUNESSE,
  // même lorsque Prénom et NOM sont laissés vides.
  if (!matchesYouthMovement(volunteer)) return false;
  if (!hasSearch) return true;

  const firstnameMatches = !searchFirstname ||
    normalizeSearch(volunteer.prenom).includes(normalizeSearch(searchFirstname));

  const lastnameMatches = !searchLastname ||
    normalizeSearch(volunteer.nom).includes(normalizeSearch(searchLastname));

  return firstnameMatches && lastnameMatches;
}

function matchesActivityFilter(volunteer) {
  if (activityFilter === "active") return Boolean(volunteer.en_poste);
  if (activityFilter === "inactive") return !volunteer.en_poste;
  return true;
}

function compareFrench(a, b) {
  return normalizeText(a).localeCompare(normalizeText(b), "fr", {
    sensitivity: "base",
    ignorePunctuation: true
  });
}

function filteredVolunteers() {
  return volunteers.filter(volunteer =>
    matchesSearch(volunteer) && matchesActivityFilter(volunteer)
  );
}

function sortedVolunteers() {
  return filteredVolunteers().sort((a, b) => {
    let result = compareFrench(a[sortField], b[sortField]);

    if (result === 0) {
      const secondaryField = sortField === "nom" ? "prenom" : "nom";
      result = compareFrench(a[secondaryField], b[secondaryField]);
    }

    return sortDirection === "asc" ? result : -result;
  });
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  return escapeHtml(value);
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

function updateActivityFilterButton() {
  if (!activityFilterButton) return;

  activityFilterButton.classList.remove(
    "activity-filter-all",
    "activity-filter-active",
    "activity-filter-inactive"
  );

  if (activityFilter === "active") {
    activityFilterButton.classList.add("activity-filter-active");
    activityFilterButton.title = "Bénévoles actuellement en poste";
    activityFilterButton.setAttribute(
      "aria-label",
      "Filtre actuel : bénévoles actuellement en poste. Cliquer pour afficher les bénévoles qui ne sont pas actuellement en poste."
    );
    return;
  }

  if (activityFilter === "inactive") {
    activityFilterButton.classList.add("activity-filter-inactive");
    activityFilterButton.title = "Bénévoles qui ne sont pas actuellement en poste";
    activityFilterButton.setAttribute(
      "aria-label",
      "Filtre actuel : bénévoles qui ne sont pas actuellement en poste. Cliquer pour afficher tous les bénévoles."
    );
    return;
  }

  activityFilterButton.classList.add("activity-filter-all");
  activityFilterButton.title = "Tous les bénévoles";
  activityFilterButton.setAttribute(
    "aria-label",
    "Filtre actuel : tous les bénévoles. Cliquer pour afficher uniquement les bénévoles actuellement en poste."
  );
}

function kitCheckbox(volunteer) {
  const checked = volunteer.kit_ok ? "checked" : "";
  const label = `${volunteer.prenom || ""} ${volunteer.nom || ""}`.trim() || "ce bénévole";

  return `
    <label class="kit-checkbox-wrap" title="Valider la remise du kit à ${escapeHtml(label)}">
      <input
        type="checkbox"
        class="kit-checkbox"
        data-participation-id="${escapeHtml(volunteer.participation_id)}"
        ${checked}
        aria-label="Kit remis à ${escapeHtml(label)}"
      >
      <span class="kit-checkbox-mark" aria-hidden="true"></span>
    </label>
  `;
}

function scheduleButton(volunteer) {
  const label = `${volunteer.prenom || ""} ${volunteer.nom || ""}`.trim() || "ce bénévole";
  const params = new URLSearchParams({
    id: volunteer.id,
    prenom: volunteer.prenom || "",
    nom: volunteer.nom || ""
  });

  const activeClass = volunteer.en_poste ? " schedule-view-button-active" : "";
  const activeText = volunteer.en_poste ? " — actuellement en poste" : "";

  return `
    <a
      class="schedule-view-button${activeClass}"
      href="benevole-horaires-admin.html?${params.toString()}"
      title="Voir les horaires de ${escapeHtml(label)}${activeText}"
      aria-label="Voir les horaires de ${escapeHtml(label)}${activeText}"
    >🕥</a>
  `;
}

function editableContact(volunteer, field) {
  const value = normalizeText(volunteer[field]);
  const label = field === "telephone" ? "numéro de téléphone" : "adresse e-mail";
  const displayValue = value || "—";

  return `
    <div class="contact-display">
      <button
        type="button"
        class="contact-edit-button"
        data-benevole-id="${escapeHtml(volunteer.id)}"
        data-field="${field}"
        title="Modifier le ${label}"
        aria-label="Modifier le ${label}"
      >✏️</button>
      <span class="contact-value">${escapeHtml(displayValue)}</span>
    </div>
  `;
}

function validateAndNormalizePhone(value) {
  const trimmed = normalizeText(value);
  if (!trimmed) return { ok: true, value: "" };

  const isInternational = trimmed.startsWith("+") || trimmed.startsWith("00");

  if (isInternational) {
    if (trimmed.startsWith("+32") || trimmed.startsWith("0032")) {
      return {
        ok: false,
        message: "Un numéro belge doit être au format 04XX XX XX XX."
      };
    }

    return { ok: true, value: trimmed };
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!/^04\d{8}$/.test(digits)) {
    return {
      ok: false,
      message: "Format attendu : 04XX XX XX XX (sauf indicatif étranger)."
    };
  }

  return {
    ok: true,
    value: `${digits.slice(0, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`
  };
}

function validateEmail(value) {
  const trimmed = normalizeText(value).toLowerCase();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

  return valid
    ? { ok: true, value: trimmed }
    : { ok: false, message: "Adresse e-mail invalide." };
}

function openContactEditor(button) {
  const volunteerId = button.dataset.benevoleId;
  const field = button.dataset.field;
  const volunteer = volunteers.find(item => item.id === volunteerId);
  const cell = button.closest("td");

  if (!volunteer || !cell) return;

  const currentValue = normalizeText(volunteer[field]);
  const inputType = field === "email" ? "email" : "text";
  const inputMode = field === "email" ? "email" : "tel";

  cell.innerHTML = `
    <div class="contact-editor" data-benevole-id="${escapeHtml(volunteerId)}" data-field="${field}">
      <input
        type="${inputType}"
        inputmode="${inputMode}"
        class="contact-edit-input"
        value="${escapeHtml(currentValue)}"
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

function showContactEditError(editor, message) {
  const error = editor.querySelector(".contact-edit-error");
  const input = editor.querySelector(".contact-edit-input");
  if (error) error.textContent = message;
  if (input) {
    input.classList.add("contact-edit-input-error");
    input.focus();
  }
}

async function saveContactEditor(button) {
  const editor = button.closest(".contact-editor");
  if (!editor) return;

  const volunteerId = editor.dataset.benevoleId;
  const field = editor.dataset.field;
  const input = editor.querySelector(".contact-edit-input");
  const saveButton = editor.querySelector(".contact-save-button");
  const cancelButton = editor.querySelector(".contact-cancel-button");

  let validation;
  if (field === "telephone") {
    validation = validateAndNormalizePhone(input.value);
  } else {
    validation = validateEmail(input.value);
  }

  if (!validation.ok) {
    showContactEditError(editor, validation.message);
    return;
  }

  input.classList.remove("contact-edit-input-error");
  saveButton.disabled = true;
  cancelButton.disabled = true;
  input.disabled = true;

  const { data, error } = await PortalAuth.client.rpc("admin_update_benevole_contact", {
    p_benevole_id: volunteerId,
    p_field: field,
    p_value: validation.value
  });

  if (error) {
    console.error("Impossible de modifier le contact du bénévole :", error);
    saveButton.disabled = false;
    cancelButton.disabled = false;
    input.disabled = false;
    showContactEditError(editor, error.message || "La modification n'a pas pu être enregistrée.");
    return;
  }

  const updated = Array.isArray(data) ? data[0] : data;
  const volunteer = volunteers.find(item => item.id === volunteerId);

  if (volunteer) {
    volunteer.telephone = updated?.telephone ?? volunteer.telephone;
    volunteer.email = updated?.email ?? volunteer.email;
  }

  errorElement.hidden = true;
  renderTable();
}

function emptyMessage() {
  if (activityFilter === "active") {
    return hasSearch
      ? "Aucun bénévole correspondant à cette recherche n'est actuellement en poste."
      : "Aucun bénévole n'est actuellement en poste.";
  }

  if (activityFilter === "inactive") {
    return hasSearch
      ? "Aucun bénévole correspondant à cette recherche n'est actuellement hors poste."
      : "Aucun bénévole hors poste à afficher.";
  }

  return hasSearch
    ? "Aucun bénévole ne correspond à cette recherche."
    : "Aucun bénévole à afficher.";
}

function renderTable() {
  const rows = sortedVolunteers();

  if (!rows.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" class="volunteers-empty">${emptyMessage()}</td>
      </tr>
    `;
    countElement.textContent = "0 bénévole";
    updateSortIndicators();
    updateActivityFilterButton();
    return;
  }

  tableBody.innerHTML = rows.map(volunteer => `
    <tr>
      <td class="schedule-view-cell">${scheduleButton(volunteer)}</td>
      <td class="volunteer-name">${escapeHtml(volunteer.prenom || "—")}</td>
      <td class="volunteer-name">${escapeHtml(volunteer.nom || "—")}</td>
      <td class="contact-cell contact-phone-cell">${editableContact(volunteer, "telephone")}</td>
      <td class="contact-cell contact-email-cell">${editableContact(volunteer, "email")}</td>
      <td class="logistics-cell">${formatValue(volunteer.tshirt)}</td>
      <td class="logistics-cell">${formatValue(volunteer.tailloux)}</td>
      <td class="logistics-cell sandwich-cell">${formatValue(volunteer.sandwich)}</td>
      <td class="kit-ok-cell">${kitCheckbox(volunteer)}</td>
    </tr>
  `).join("");

  countElement.textContent = `${rows.length} bénévole${rows.length > 1 ? "s" : ""}`;
  updateSortIndicators();
  updateActivityFilterButton();
}

async function updateKitStatus(checkbox) {
  const participationId = checkbox.dataset.participationId;
  const newValue = checkbox.checked;
  const previousValue = !newValue;

  checkbox.disabled = true;

  const { error } = await PortalAuth.client.rpc("admin_set_benevole_kit_ok", {
    p_participation_id: participationId,
    p_kit_ok: newValue
  });

  if (error) {
    console.error("Impossible de mettre à jour la remise du kit :", error);
    checkbox.checked = previousValue;
    showError("La validation du kit n'a pas pu être enregistrée.");
  } else {
    const volunteer = volunteers.find(item => item.participation_id === participationId);
    if (volunteer) volunteer.kit_ok = newValue;
    errorElement.hidden = true;
  }

  checkbox.disabled = false;
}

function printVolunteersList() {
  sortField = "nom";
  sortDirection = "asc";
  renderTable();

  requestAnimationFrame(() => {
    window.print();
  });
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

if (activityFilterButton) {
  activityFilterButton.addEventListener("click", () => {
    if (activityFilter === "all") {
      activityFilter = "active";
    } else if (activityFilter === "active") {
      activityFilter = "inactive";
    } else {
      activityFilter = "all";
    }

    renderTable();
  });
}

tableBody.addEventListener("click", event => {
  const editButton = event.target.closest(".contact-edit-button");
  if (editButton) {
    openContactEditor(editButton);
    return;
  }

  const saveButton = event.target.closest(".contact-save-button");
  if (saveButton) {
    saveContactEditor(saveButton);
    return;
  }

  const cancelButton = event.target.closest(".contact-cancel-button");
  if (cancelButton) {
    renderTable();
  }
});

tableBody.addEventListener("keydown", event => {
  const input = event.target.closest(".contact-edit-input");
  if (!input) return;

  const editor = input.closest(".contact-editor");
  if (!editor) return;

  if (event.key === "Enter") {
    event.preventDefault();
    const saveButton = editor.querySelector(".contact-save-button");
    if (saveButton) saveContactEditor(saveButton);
  }

  if (event.key === "Escape") {
    event.preventDefault();
    renderTable();
  }
});

tableBody.addEventListener("change", event => {
  const checkbox = event.target.closest(".kit-checkbox");
  if (!checkbox) return;
  updateKitStatus(checkbox);
});

if (printButton) {
  printButton.addEventListener("click", printVolunteersList);
}

function youthUnitMatches(unit) {
  if (!youthUnit) return true;
  const key = normalizeSearch(unit);
  if (youthUnit === "guide") return key === "guides";
  if (youthUnit === "patro") return key === "patro";
  if (youthUnit === "pionnier") return key === "pionniers";
  return true;
}

function youthFestivalDate(iso) {
  const d = new Date(iso);
  d.setHours(d.getHours() - 4);
  return d.toLocaleDateString("sv-SE");
}

function youthFestivalDayLabel(iso) {
  const d = new Date(iso);
  d.setHours(d.getHours() - 4);
  return d.toLocaleDateString("fr-BE", { weekday:"long", day:"numeric", month:"long" }).toUpperCase();
}

function youthMinutes(iso) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function youthSlotLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h30` : `${h}h`;
}

function youthAssignmentCoversSlot(row, slotStart) {
  let start = youthMinutes(row.debut);
  let end = youthMinutes(row.fin);
  if (end <= start) end += 24 * 60;
  const duration = slotStart >= 13*60 && slotStart < 20*60 ? 15 : 30;
  return start < slotStart + duration && end > slotStart;
}

async function printYouthPlanning(event) {
  event.preventDefault();
  const { data, error } = await PortalAuth.client.rpc("admin_youth_planning");
  if (error) { showError("Impossible de charger le planning des mouvements de jeunesse."); return; }

  const rows = (data || []).filter(row => youthUnitMatches(row.unite));
  const order = ["Guides","Patro","Pionniers"];
  const units = order.map(name => [name, rows.filter(r => r.unite === name)]).filter(([,r]) => r.length);
  const slots = [];
  for (let m=9*60; m<13*60; m+=30) slots.push(m);
  for (let m=13*60; m<20*60; m+=15) slots.push(m);
  for (let m=20*60; m<=21*60; m+=30) slots.push(m);
  let body = "";

  for (const [unitName, unitRows] of units) {
    const assigned = unitRows.filter(r => r.debut && r.fin);
    const dates = [...new Set(assigned.map(r => youthFestivalDate(r.debut)))].sort();

    if (!dates.length) {
      body += `<section class="yp-sheet"><h1>PLANNING HORAIRE — ${escapeHtml(unitName.toUpperCase())}</h1>
        <div class="yp-chef">Chef : ${escapeHtml(unitRows[0].chef_prenom || "—")} · ${escapeHtml(unitRows[0].chef_telephone || "—")}</div>
        <p>Aucun horaire attribué.</p></section>`;
      continue;
    }

    for (const date of dates) {
      const dayRows = assigned.filter(r => youthFestivalDate(r.debut) === date);
      const groups = new Map();
      dayRows.forEach(r => {
        const key = `${r.poste || "—"}|${r.lieu || "—"}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      });

      const first = dayRows[0];
      body += `<section class="yp-sheet"><h1>PLANNING HORAIRE — ${escapeHtml(unitName.toUpperCase())}</h1>
        <div class="yp-top"><div class="yp-chef">Chef : ${escapeHtml(unitRows[0].chef_prenom || "—")} · ${escapeHtml(unitRows[0].chef_telephone || "—")}</div>
        <div class="yp-day">${escapeHtml(youthFestivalDayLabel(first.debut))}</div></div>
        <table><thead><tr><th class="yp-post">Poste · Lieu</th>${slots.map(s=>`<th>${youthSlotLabel(s)}</th>`).join("")}</tr></thead><tbody>`;

      [...groups.entries()].sort((a,b)=>compareFrench(a[0],b[0])).forEach(([key, groupRows]) => {
        const [post, place] = key.split("|");
        body += `<tr><td class="yp-post"><strong>${escapeHtml(post)}</strong><small>${escapeHtml(place)}</small></td>`;
        slots.forEach(slot => {
          const ids = new Set(groupRows.filter(r => youthAssignmentCoversSlot(r, slot)).map(r => r.personne_id));
          const count = ids.size;
          body += `<td class="${count ? "yp-filled" : ""}">${count ? `<strong>${count}</strong><span>animé·e${count>1?"·s":""}</span>` : ""}</td>`;
        });
        body += `</tr>`;
      });
      body += `</tbody></table></section>`;
    }
  }

  const w = window.open("", "_blank");
  if (!w) { showError("Autorise les fenêtres pop-up pour imprimer le planning."); return; }
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Planning horaire — Mouvements de jeunesse</title>
  <style>@page{size:A4 landscape;margin:5mm}*{box-sizing:border-box}body{font-family:"Titillium Web",Arial,sans-serif;color:#17204a;margin:0}.yp-sheet{break-after:page}.yp-sheet:last-child{break-after:auto}h1{color:#1C2EAB;margin:0 0 2px;font-size:16px}.yp-top{margin-bottom:6px}.yp-chef{font-weight:600;font-size:11px}.yp-date{color:#E40230;font-weight:700;font-size:10px;margin-top:1px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #cbd1e6;padding:2px 0;text-align:center;font-size:5.5px;height:29px;overflow:hidden}th{background:#f1f3fb;color:#1C2EAB;font-weight:700;white-space:nowrap}.yp-full-hour{font-size:9px!important;background:#e7eaf8!important}.yp-post{width:128px!important;text-align:left;padding-left:4px;padding-right:2px}.yp-post small{display:block;font-size:6px;font-weight:400;color:#555;line-height:7px}.yp-post .yp-resp{margin-top:2px;color:#1C2EAB;font-weight:600}.yp-filled{background:#f2f4fb}.yp-filled strong{display:block;color:#1C2EAB;font-size:8px;line-height:8px}.yp-filled span{display:block;font-size:4.5px;line-height:6px;white-space:nowrap}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>${body}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
  w.document.close();
}
if (youthMovement && printAllLabelsButton) {
  printAllLabelsButton.addEventListener("click", printYouthPlanning);
}

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
