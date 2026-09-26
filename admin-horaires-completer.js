/* Administration — horaires à compléter */

const loadingElement = document.getElementById("open-shifts-loading");
const errorElement = document.getElementById("open-shifts-error");
const listElement = document.getElementById("open-shifts-list");
const dayFilter = document.getElementById("open-day-filter");
const postFilter = document.getElementById("open-post-filter");
const placeFilter = document.getElementById("open-place-filter");
const statusFilter = document.getElementById("open-status-filter");
const summaryPlaces = document.getElementById("open-summary-places");
const summaryPosts = document.getElementById("open-summary-posts");
const summaryHours = document.getElementById("open-summary-hours");
const logoutButton = document.getElementById("logout-button");
const addButton = document.getElementById("open-add-button");
const createPanel = document.getElementById("open-create-panel");
const createForm = document.getElementById("open-create-form");
const createCancel = document.getElementById("open-create-cancel");
const createDay = document.getElementById("open-create-day");
const createPost = document.getElementById("open-create-post");
const createPlace = document.getElementById("open-create-place");
const createStart = document.getElementById("open-create-start");
const createEnd = document.getElementById("open-create-end");
const createMessage = document.getElementById("open-create-message");

let currentUser = null;
let needs = [];
let optionRows = [];

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

function unlockStorageKey() {
  return currentUser ? `portalAdminUnlockedUntil:${currentUser.id}` : "";
}

function isLocallyUnlocked() {
  if (!currentUser) return false;
  return Number(sessionStorage.getItem(unlockStorageKey()) || 0) > Date.now();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  const label = new Intl.DateTimeFormat("fr-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Brussels"
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function postLabel(need) {
  return need.sous_poste || need.poste;
}

function urgencyInfo(value) {
  if (value === "maintenant") return { className: "urgency-now", label: "En cours" };
  if (value === "bientot") return { className: "urgency-soon", label: "Dans moins de 4h" };
  return { className: "urgency-future", label: "À venir" };
}

function currentBrusselsTime() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const h = parts.find(p => p.type === "hour")?.value || "00";
  const m = parts.find(p => p.type === "minute")?.value || "00";
  return `${h}:${m}`;
}

function defaultStart(need) {
  if (need.urgence !== "maintenant") return need.debut_heure;
  const now = currentBrusselsTime();
  if (now > need.debut_heure && now < need.fin_heure) return now;
  return need.debut_heure;
}

function rpcTime(value) {
  return /^\d{2}:\d{2}$/.test(value || "") ? `${value}:00` : value;
}

function filteredNeeds() {
  return needs.filter(need => {
    if (dayFilter.value && need.jour !== dayFilter.value) return false;
    if (postFilter.value && String(need.poste_id) !== postFilter.value) return false;
    if (placeFilter.value && String(need.lieu_id) !== placeFilter.value) return false;
    if (statusFilter.value && need.urgence !== statusFilter.value) return false;
    return true;
  });
}

function formatHours(minutes) {
  const hours = minutes / 60;
  return new Intl.NumberFormat("fr-BE", { maximumFractionDigits: 1 }).format(hours);
}

function formatDisplayTime(value) {
  const [hours = "0", minutes = "00"] = String(value ?? "").split(":");
  const hour = String(Number(hours));
  return minutes && minutes !== "00" ? `${hour}h${minutes}` : `${hour}h`;
}

function updateSummary(rows) {
  if (summaryPlaces) summaryPlaces.textContent = rows.length;
  if (summaryPosts) summaryPosts.textContent = new Set(rows.map(row => String(row.poste_id))).size;
  if (summaryHours) summaryHours.textContent = formatHours(rows.reduce((sum, row) => sum + Number(row.minutes || 0), 0));
}

function populateFilters() {
  const selectedDay = dayFilter.value;
  const selectedPost = postFilter.value;
  const selectedPlace = placeFilter.value;

  const days = [...new Set(needs.map(need => need.jour))].sort();
  dayFilter.innerHTML = '<option value="">Tous les jours</option>' + days
    .map(day => `<option value="${escapeHtml(day)}">${escapeHtml(formatDate(day))}</option>`)
    .join("");
  if (days.includes(selectedDay)) dayFilter.value = selectedDay;

  const posts = [...new Map(needs.map(need => [String(need.poste_id), { id: String(need.poste_id), label: postLabel(need) }])).values()]
    .sort((a, b) => collator.compare(a.label, b.label));
  postFilter.innerHTML = '<option value="">Tous les postes</option>' + posts
    .map(post => `<option value="${escapeHtml(post.id)}">${escapeHtml(post.label)}</option>`)
    .join("");
  if (posts.some(post => post.id === selectedPost)) postFilter.value = selectedPost;

  const places = [...new Map(needs.filter(need => need.lieu_id != null).map(need => [String(need.lieu_id), {
    id: String(need.lieu_id),
    label: need.lieu || "Lieu à confirmer"
  }])).values()].sort((a, b) => collator.compare(a.label, b.label));
  placeFilter.innerHTML = '<option value="">Tous les lieux</option>' + places
    .map(place => `<option value="${escapeHtml(place.id)}">${escapeHtml(place.label)}</option>`)
    .join("");
  if (places.some(place => place.id === selectedPlace)) placeFilter.value = selectedPlace;
}

function populateCreateOptions() {
  const posts = [...new Map(optionRows.map(row => [String(row.poste_id), {
    id: String(row.poste_id),
    label: row.sous_poste || row.poste
  }])).values()].sort((a, b) => collator.compare(a.label, b.label));

  const places = [...new Map(optionRows.map(row => [String(row.lieu_id), {
    id: String(row.lieu_id),
    label: row.lieu
  }])).values()].sort((a, b) => collator.compare(a.label, b.label));

  createPost.innerHTML = '<option value="">Choisir un poste</option>' + posts
    .map(row => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.label)}</option>`).join("");
  createPlace.innerHTML = '<option value="">Choisir un lieu</option>' + places
    .map(row => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.label)}</option>`).join("");
}

function resetCandidateSelect(select) {
  select.dataset.loadedFor = "";
  select.innerHTML = '<option value="">Cliquer pour charger les bénévoles…</option>';
}

function compareCandidates(a, b) {
  return collator.compare(String(a.nom || ""), String(b.nom || ""))
    || collator.compare(String(a.prenom || ""), String(b.prenom || ""));
}

async function loadCandidates(card, need) {
  const form = card.querySelector(".open-assign-form");
  const select = form.querySelector(".open-candidate-select");
  const startInput = form.querySelector(".open-start-time");
  const endInput = form.querySelector(".open-end-time");
  const message = form.querySelector(".open-card-message");
  const key = `${startInput.value}|${endInput.value}`;

  if (select.dataset.loading === "1" || select.dataset.loadedFor === key) return;
  if (!startInput.value || !endInput.value || endInput.value === startInput.value) {
    message.textContent = "Choisis d’abord une plage horaire valide.";
    message.className = "open-card-message error";
    return;
  }

  select.dataset.loading = "1";
  select.disabled = true;
  select.innerHTML = '<option value="">Chargement…</option>';
  message.textContent = "";
  message.className = "open-card-message";

  const { data, error } = await PortalAuth.client.rpc("admin_get_need_candidates", {
    p_besoin_id: need.besoin_id,
    p_debut: rpcTime(startInput.value),
    p_fin: rpcTime(endInput.value)
  });

  select.dataset.loading = "0";
  select.disabled = false;

  if (error) {
    console.error(error);
    resetCandidateSelect(select);
    message.textContent = error.message || "Impossible de charger les bénévoles.";
    message.className = "open-card-message error";
    return;
  }

  const candidates = Array.isArray(data) ? data : [];
  select.innerHTML = '<option value="">Choisir un·e bénévole</option>';

  const live = candidates.filter(row => row.disponible_live === true).sort(compareCandidates);
  const free = candidates.filter(row => row.disponible_live !== true).sort(compareCandidates);

  const addGroup = (label, rows) => {
    if (!rows.length) return;
    const group = document.createElement("optgroup");
    group.label = label;
    rows.forEach(row => {
      const option = document.createElement("option");
      option.value = row.personne_id;
      option.textContent = `${String(row.nom || "").trim().toUpperCase()} ${String(row.prenom || "").trim()}`.trim();
      group.appendChild(option);
    });
    select.appendChild(group);
  };

  addGroup("🔵 Disponibles maintenant", live);
  addGroup("⚪ Libres sur ce créneau", free);

  if (!candidates.length) {
    select.innerHTML = '<option value="">Aucun bénévole disponible sur ce créneau</option>';
    message.textContent = "Aucune personne libre ou disponible ne correspond à cette plage horaire.";
  }

  select.dataset.loadedFor = key;
}

async function assignVolunteer(event, need) {
  event.preventDefault();
  const form = event.currentTarget;
  const card = form.closest(".open-shift-card");
  const select = form.querySelector(".open-candidate-select");
  const startInput = form.querySelector(".open-start-time");
  const endInput = form.querySelector(".open-end-time");
  const button = form.querySelector(".open-assign-button");
  const message = form.querySelector(".open-card-message");

  if (!select.value) {
    message.textContent = "Choisis un·e bénévole.";
    message.className = "open-card-message error";
    return;
  }

  if (!startInput.value || !endInput.value || endInput.value === startInput.value) {
    message.textContent = "La plage horaire choisie n’est pas valide.";
    message.className = "open-card-message error";
    return;
  }

  button.disabled = true;
  button.textContent = "…";
  message.textContent = "";

  const { error } = await PortalAuth.client.rpc("admin_assign_need_volunteer", {
    p_besoin_id: need.besoin_id,
    p_personne_id: select.value,
    p_debut: rpcTime(startInput.value),
    p_fin: rpcTime(endInput.value)
  });

  if (!error) {
    const { error: mergeError } = await PortalAuth.client.rpc("admin_merge_consecutive_affectations", {
      p_personne_id: select.value
    });
    if (mergeError) console.error("Impossible de fusionner les plages consécutives :", mergeError);
  }

  if (error) {
    console.error(error);
    message.textContent = error.message || "Impossible d’enregistrer l’affectation.";
    message.className = "open-card-message error";
    button.disabled = false;
    button.textContent = "✓";
    return;
  }

  message.textContent = "Affectation enregistrée. Mise à jour des créneaux restants…";
  message.className = "open-card-message";
  await loadNeeds();
  window.scrollTo({ top: Math.max(0, card.offsetTop - 130), behavior: "smooth" });
}

async function deleteNeed(need, button) {
  const title = need.sous_poste || need.poste;
  const ok = window.confirm(`Supprimer l’horaire vacant « ${title} » du ${formatDate(need.jour)} de ${formatDisplayTime(need.debut_heure)} à ${formatDisplayTime(need.fin_heure)} ?`);
  if (!ok) return;

  button.disabled = true;
  button.textContent = "…";
  const { error } = await PortalAuth.client.rpc("admin_delete_open_need", { p_besoin_id: need.besoin_id });
  if (error) {
    console.error(error);
    window.alert(error.message || "Impossible de supprimer cet horaire vacant.");
    button.disabled = false;
    button.textContent = "×";
    return;
  }
  await loadNeeds();
}

function createCard(need) {
  const urgency = urgencyInfo(need.urgence);
  const card = document.createElement("article");
  card.className = `open-shift-card ${urgency.className}`;
  card.dataset.needId = need.besoin_id;

  const startValue = defaultStart(need);
  const title = need.sous_poste || need.poste;

  card.innerHTML = `
    <div class="open-shift-top">
      <div class="open-shift-title">
        <strong>${escapeHtml(title)}</strong>
        <button type="button" class="open-delete-button" aria-label="Supprimer cet horaire vacant" title="Supprimer cet horaire vacant">×</button>
      </div>
      <span class="open-urgency">${escapeHtml(urgency.label)}</span>
    </div>
    <div class="open-shift-meta">
      <span><strong>${escapeHtml(formatDate(need.jour))}</strong> · ${escapeHtml(formatDisplayTime(need.debut_heure))}-${escapeHtml(formatDisplayTime(need.fin_heure))} <span class="open-shift-duration" style="color:var(--text-light)">(${escapeHtml(formatHours(Number(need.minutes || 0)))}h)</span></span>
      <span>📍 ${escapeHtml(need.lieu || "Lieu à confirmer")}</span>
    </div>
    <form class="open-assign-form">
      <div class="open-assign-field">
        <label>Bénévole</label>
        <select class="open-candidate-select">
          <option value="">Cliquer pour charger les bénévoles…</option>
        </select>
      </div>
      <div class="open-assign-field">
        <label>De</label>
        <input class="open-start-time" type="time" step="60" min="${escapeHtml(need.debut_heure)}" max="${escapeHtml(need.fin_heure)}" value="${escapeHtml(startValue)}" required>
      </div>
      <div class="open-assign-field">
        <label>À</label>
        <input class="open-end-time" type="time" step="60" min="${escapeHtml(need.debut_heure)}" max="${escapeHtml(need.fin_heure)}" value="${escapeHtml(need.fin_heure)}" required>
      </div>
      <button type="submit" class="open-assign-button" aria-label="Affecter" title="Affecter">✓</button>
      <p class="open-card-message"></p>
    </form>
  `;

  const form = card.querySelector(".open-assign-form");
  const select = form.querySelector(".open-candidate-select");
  const startInput = form.querySelector(".open-start-time");
  const endInput = form.querySelector(".open-end-time");
  const deleteButton = card.querySelector(".open-delete-button");

  const invalidate = () => resetCandidateSelect(select);
  startInput.addEventListener("change", invalidate);
  endInput.addEventListener("change", invalidate);
  select.addEventListener("focus", () => loadCandidates(card, need));
  select.addEventListener("click", () => loadCandidates(card, need));
  form.addEventListener("submit", event => assignVolunteer(event, need));
  deleteButton.addEventListener("click", () => deleteNeed(need, deleteButton));

  return card;
}

function renderNeeds() {
  const urgencyOrder = { maintenant: 0, bientot: 1, avenir: 2 };
  const rows = filteredNeeds().sort((a, b) => {
    const statusDiff = (urgencyOrder[a.urgence] ?? 3) - (urgencyOrder[b.urgence] ?? 3);
    if (statusDiff) return statusDiff;
    return new Date(a.debut) - new Date(b.debut);
  });
  updateSummary(rows);
  listElement.innerHTML = "";

  if (!rows.length) {
    listElement.innerHTML = '<div class="open-empty">Aucun horaire à compléter pour cette sélection.</div>';
    return;
  }

  rows.forEach(need => listElement.appendChild(createCard(need)));
}

async function loadOptions() {
  const { data, error } = await PortalAuth.client.rpc("admin_list_open_need_options");
  if (error) {
    console.error(error);
    throw error;
  }
  optionRows = Array.isArray(data) ? data : [];
  populateCreateOptions();
}

async function loadNeeds() {
  loadingElement.hidden = false;
  errorElement.hidden = true;

  const { data, error } = await PortalAuth.client.rpc("admin_list_open_needs");
  if (error) {
    console.error(error);
    loadingElement.hidden = true;
    errorElement.textContent = "Impossible de charger les horaires à compléter.";
    errorElement.hidden = false;
    return;
  }

  needs = Array.isArray(data) ? data : [];
  populateFilters();
  loadingElement.hidden = true;
  renderNeeds();
}

function setCreateOpen(open) {
  createPanel.hidden = !open;
  addButton.setAttribute("aria-expanded", String(open));
  createMessage.textContent = "";
  createMessage.className = "open-card-message";
  if (open) {
    const firstDay = [...new Set(needs.map(need => need.jour))].sort()[0];
    if (!createDay.value && firstDay) createDay.value = firstDay;
    createDay.focus();
  } else {
    createForm.reset();
    populateCreateOptions();
    addButton.focus();
  }
}

async function createNeed(event) {
  event.preventDefault();
  createMessage.textContent = "";
  createMessage.className = "open-card-message";

  if (!createDay.value || !createPost.value || !createPlace.value || !createStart.value || !createEnd.value) {
    createMessage.textContent = "Complète tous les champs.";
    createMessage.className = "open-card-message error";
    return;
  }
  // Journée festival : 04:00 → 03:59 le lendemain.
  // Une heure de fin comprise entre 00:00 et 03:59 est donc autorisée
  // pour un créneau commencé entre 04:00 et 23:59.
  const crossesFestivalMidnight = createStart.value >= "04:00" && createEnd.value < "04:00";
  if (createEnd.value === createStart.value || (createEnd.value < createStart.value && !crossesFestivalMidnight)) {
    createMessage.textContent = "La plage horaire choisie n’est pas valide.";
    createMessage.className = "open-card-message error";
    return;
  }

  const submit = createForm.querySelector('[type="submit"]');
  submit.disabled = true;
  createCancel.disabled = true;

  const { error } = await PortalAuth.client.rpc("admin_create_open_need", {
    p_jour: createDay.value,
    p_poste_id: Number(createPost.value),
    p_lieu_id: Number(createPlace.value),
    p_debut: rpcTime(createStart.value),
    p_fin: rpcTime(createEnd.value)
  });

  submit.disabled = false;
  createCancel.disabled = false;

  if (error) {
    console.error(error);
    createMessage.textContent = error.message || "Impossible de créer cet horaire vacant.";
    createMessage.className = "open-card-message error";
    return;
  }

  setCreateOpen(false);
  await loadNeeds();
}

async function initPage() {
  const user = await PortalAuth.requireAuth();
  if (!user) return;
  currentUser = user;

  const { data: isAdmin, error } = await PortalAuth.client.rpc("is_current_portal_admin");
  if (error || !isAdmin) {
    window.location.replace("dashboard.html");
    return;
  }

  if (!isLocallyUnlocked()) {
    window.location.replace("admin.html");
    return;
  }

  try {
    await Promise.all([loadOptions(), loadNeeds()]);
  } catch (error) {
    console.error(error);
    errorElement.textContent = "Impossible de préparer la gestion des horaires vacants.";
    errorElement.hidden = false;
  }
}

dayFilter.addEventListener("change", renderNeeds);
postFilter.addEventListener("change", renderNeeds);
placeFilter.addEventListener("change", renderNeeds);
statusFilter.addEventListener("change", renderNeeds);
addButton.setAttribute("aria-expanded", "false");
addButton.addEventListener("click", () => setCreateOpen(createPanel.hidden));
createCancel.addEventListener("click", () => setCreateOpen(false));
createForm.addEventListener("submit", createNeed);

logoutButton.addEventListener("click", async () => {
  if (currentUser) sessionStorage.removeItem(unlockStorageKey());
  logoutButton.disabled = true;
  logoutButton.textContent = "Déconnexion...";
  const success = await PortalAuth.logout();
  if (!success) {
    logoutButton.disabled = false;
    logoutButton.textContent = "Se déconnecter";
  }
});

initPage();