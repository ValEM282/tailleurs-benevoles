/* Administration — horaires à compléter */

const loadingElement = document.getElementById("open-shifts-loading");
const errorElement = document.getElementById("open-shifts-error");
const listElement = document.getElementById("open-shifts-list");
const dayFilter = document.getElementById("open-day-filter");
const postFilter = document.getElementById("open-post-filter");
const summaryPlaces = document.getElementById("open-summary-places");
const summaryPosts = document.getElementById("open-summary-posts");
const summaryHours = document.getElementById("open-summary-hours");
const logoutButton = document.getElementById("logout-button");

let currentUser = null;
let needs = [];

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
  if (value === "maintenant") return { className: "urgency-now", label: "À pourvoir maintenant" };
  if (value === "bientot") return { className: "urgency-soon", label: "Dans les prochaines heures" };
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
    return true;
  });
}

function formatHours(minutes) {
  const hours = minutes / 60;
  return new Intl.NumberFormat("fr-BE", { maximumFractionDigits: 1 }).format(hours);
}

function updateSummary(rows) {
  if (summaryPlaces) summaryPlaces.textContent = rows.length;
  if (summaryPosts) summaryPosts.textContent = new Set(rows.map(row => String(row.poste_id))).size;
  if (summaryHours) summaryHours.textContent = formatHours(rows.reduce((sum, row) => sum + Number(row.minutes || 0), 0));
}

function populateFilters() {
  const selectedDay = dayFilter.value;
  const selectedPost = postFilter.value;

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
}

function resetCandidateSelect(select) {
  select.dataset.loadedFor = "";
  select.innerHTML = '<option value="">Cliquer pour charger les bénévoles…</option>';
}

async function loadCandidates(card, need) {
  const form = card.querySelector(".open-assign-form");
  const select = form.querySelector(".open-candidate-select");
  const startInput = form.querySelector(".open-start-time");
  const endInput = form.querySelector(".open-end-time");
  const message = form.querySelector(".open-card-message");
  const key = `${startInput.value}|${endInput.value}`;

  if (select.dataset.loading === "1" || select.dataset.loadedFor === key) return;
  if (!startInput.value || !endInput.value || endInput.value <= startInput.value) {
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

  const live = candidates.filter(row => row.disponible_live === true);
  const free = candidates.filter(row => row.disponible_live !== true);

  const addGroup = (label, rows) => {
    if (!rows.length) return;
    const group = document.createElement("optgroup");
    group.label = label;
    rows.forEach(row => {
      const option = document.createElement("option");
      option.value = row.personne_id;
      option.textContent = `${row.prenom} ${(row.nom || "").toUpperCase()}${row.telephone ? ` · ${row.telephone}` : ""}`;
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

  if (!startInput.value || !endInput.value || endInput.value <= startInput.value) {
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
      </div>
      <span class="open-urgency">${escapeHtml(urgency.label)}</span>
    </div>
    <div class="open-shift-meta">
      <span><strong>${escapeHtml(formatDate(need.jour))}</strong> · ${escapeHtml(need.debut_heure)}–${escapeHtml(need.fin_heure)}</span>
      <span>📍 ${escapeHtml(need.lieu || "Lieu à confirmer")}</span>
      <span>(${formatHours(Number(need.minutes || 0))} h à couvrir)</span>
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

  const invalidate = () => resetCandidateSelect(select);
  startInput.addEventListener("change", invalidate);
  endInput.addEventListener("change", invalidate);
  select.addEventListener("focus", () => loadCandidates(card, need));
  select.addEventListener("click", () => loadCandidates(card, need));
  form.addEventListener("submit", event => assignVolunteer(event, need));

  return card;
}

function renderNeeds() {
  const rows = filteredNeeds();
  updateSummary(rows);
  listElement.innerHTML = "";

  if (!rows.length) {
    listElement.innerHTML = '<div class="open-empty">Aucun horaire à compléter pour cette sélection.</div>';
    return;
  }

  rows.forEach(need => listElement.appendChild(createCard(need)));
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

  await loadNeeds();
}

dayFilter.addEventListener("change", renderNeeds);
postFilter.addEventListener("change", renderNeeds);

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
