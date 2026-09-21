const SUPABASE_URL = "https://ftfhtyohyjezoibmumum.supabase.co";
const SUPABASE_KEY = "sb_publishable_oQOnxMDMyvx6ukcuJHgWuQ_Gu-utQe3";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const dayFilter = document.getElementById("day-filter");
const postFilter = document.getElementById("post-filter");
const postOptions = document.getElementById("post-options");
const placeFilter = document.getElementById("place-filter");
const placeOptions = document.getElementById("place-options");
const upcomingGroups = document.getElementById("upcoming-groups");
const messageBox = document.getElementById("planning-message");
const logoutButton = document.getElementById("logout-button");

let filterRows = [];
let selectedPostIds = new Set();
let selectedPlaceIds = new Set();

const alphaCollator = new Intl.Collator("fr", {
  sensitivity: "base",
  ignorePunctuation: true,
  numeric: true
});

function formatPhoneForLink(value) {
  return (value || "").replace(/[^+\d]/g, "");
}

function formatTime(dateValue) {
  const parts = new Intl.DateTimeFormat("fr-BE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Brussels"
  }).formatToParts(new Date(dateValue));
  const hour = Number(parts.find(part => part.type === "hour")?.value || "0");
  const minute = parts.find(part => part.type === "minute")?.value || "00";
  return minute === "00" ? `${hour}h` : `${hour}h${minute}`;
}

function formatDayLabel(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const label = new Intl.DateTimeFormat("fr-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Brussels"
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function currentBrusselsDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = type => parts.find(p => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function showMessage(text, type = "info") {
  messageBox.hidden = false;
  messageBox.className = `planning-message ${type}`;
  messageBox.textContent = text;
}

function hideMessage() {
  messageBox.hidden = true;
}

function uniqueBy(items, keyFn) {
  const map = new Map();
  items.forEach(item => map.set(keyFn(item), item));
  return [...map.values()];
}

function visibleRowsForDay() {
  return filterRows.filter(row => row.jour === dayFilter.value);
}

function renderFilterOptions() {
  const rows = visibleRowsForDay();
  const posts = uniqueBy(rows, row => String(row.poste_id))
    .sort((a, b) => alphaCollator.compare(a.poste_nom, b.poste_nom));
  const places = uniqueBy(rows.filter(row => row.lieu_id !== null), row => String(row.lieu_id))
    .sort((a, b) => alphaCollator.compare(a.lieu_nom, b.lieu_nom));

  selectedPostIds = new Set([...selectedPostIds].filter(id => posts.some(p => String(p.poste_id) === id)));
  selectedPlaceIds = new Set([...selectedPlaceIds].filter(id => places.some(p => String(p.lieu_id) === id)));

  postOptions.innerHTML = "";
  posts.forEach(post => {
    const label = document.createElement("label");
    label.className = "multi-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = post.poste_id;
    input.checked = selectedPostIds.has(String(post.poste_id));
    input.addEventListener("change", () => {
      const id = String(post.poste_id);
      input.checked ? selectedPostIds.add(id) : selectedPostIds.delete(id);
      updateFilterSummaries();
      loadUpcoming();
    });
    const span = document.createElement("span");
    span.textContent = post.poste_nom;
    label.append(input, span);
    postOptions.appendChild(label);
  });

  placeOptions.innerHTML = "";
  places.forEach(place => {
    const label = document.createElement("label");
    label.className = "multi-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = place.lieu_id;
    input.checked = selectedPlaceIds.has(String(place.lieu_id));
    input.addEventListener("change", () => {
      const id = String(place.lieu_id);
      input.checked ? selectedPlaceIds.add(id) : selectedPlaceIds.delete(id);
      updateFilterSummaries();
      loadUpcoming();
    });
    const span = document.createElement("span");
    span.textContent = place.lieu_nom;
    label.append(input, span);
    placeOptions.appendChild(label);
  });

  updateFilterSummaries();
}

function updateFilterSummaries() {
  postFilter.querySelector("summary").textContent = selectedPostIds.size
    ? `${selectedPostIds.size} poste${selectedPostIds.size > 1 ? "s" : ""}`
    : "Tous les postes";
  placeFilter.querySelector("summary").textContent = selectedPlaceIds.size
    ? `${selectedPlaceIds.size} lieu${selectedPlaceIds.size > 1 ? "x" : ""}`
    : "Tous les lieux";
}

function statusInfo(row) {
  if (row.statut === "retard") return { key: "retard", label: `En retard de ${row.retard_minutes || 0} min` };
  const labels = {
    present: "Présent·e",
    absent: "Absent·e",
    disponible: "Disponible",
    en_pause: "En pause",
    inconnu: "Inconnu",
    hors_poste: "Absent·e",
    termine: "Terminé",
    a_venir: "Inconnu"
  };
  return { key: row.statut || "inconnu", label: labels[row.statut] || "Inconnu" };
}

function mergedStatus(rows) {
  const first = statusInfo(rows[0]);
  const same = rows.every(row => statusInfo(row).key === first.key && statusInfo(row).label === first.label);
  return same ? first : { key: "inconnu", label: "Inconnu" };
}

async function changeStatus(affectationIds, status) {
  const results = await Promise.all(
    affectationIds.map(affectationId => supabaseClient.rpc("set_managed_presence_status", {
      p_affectation_id: affectationId,
      p_statut: status
    }))
  );
  const error = results.find(result => result.error)?.error;
  if (error) {
    console.error(error);
    showMessage("Impossible de modifier ce statut.", "error");
    return;
  }
  await loadUpcoming();
}

function buildStatusControl(entry) {
  const status = mergedStatus(entry.rows);
  const wrapper = document.createElement("div");
  wrapper.className = "status-control";

  const dot = document.createElement("button");
  dot.type = "button";
  dot.className = `status-dot status-${status.key}`;
  dot.title = `${status.label} — cliquer pour modifier`;
  dot.setAttribute("aria-label", `${status.label}. Cliquer pour modifier le statut.`);

  const menu = document.createElement("div");
  menu.className = "status-menu";
  menu.hidden = true;

  [
    ["present", "Présent·e"],
    ["absent", "Absent·e"],
    ["disponible", "Disponible"],
    ["en_pause", "En pause"],
    ["inconnu", "Inconnu"]
  ].forEach(([key, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    const swatch = document.createElement("span");
    swatch.className = `status-menu-swatch status-${key}`;
    const text = document.createElement("span");
    text.textContent = label;
    button.append(swatch, text);
    button.addEventListener("click", async event => {
      event.stopPropagation();
      menu.hidden = true;
      await changeStatus(entry.rows.map(row => row.affectation_id), key);
    });
    menu.appendChild(button);
  });

  dot.addEventListener("click", event => {
    event.stopPropagation();
    document.querySelectorAll(".status-menu").forEach(other => {
      if (other !== menu) other.hidden = true;
    });
    menu.hidden = !menu.hidden;
  });

  wrapper.append(dot, menu);
  return wrapper;
}

function renderGroups(rows) {
  upcomingGroups.innerHTML = "";
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "empty-now";
    empty.textContent = "Aucun planning horaire à venir pour cette sélection";
    upcomingGroups.appendChild(empty);
    return;
  }

  const groups = new Map();
  rows.forEach(row => {
    const key = `${row.poste_id}|${row.lieu_id ?? "none"}`;
    if (!groups.has(key)) groups.set(key, { poste: row.poste_nom, lieu: row.lieu_nom, rows: [] });
    groups.get(key).rows.push(row);
  });

  [...groups.values()]
    .sort((a, b) => alphaCollator.compare(a.poste, b.poste) || alphaCollator.compare(a.lieu || "", b.lieu || ""))
    .forEach(group => {
      const section = document.createElement("section");
      section.className = "now-group";

      const title = document.createElement("h3");
      title.className = "now-group-title";
      title.textContent = `${group.poste} · ${group.lieu}`;
      section.appendChild(title);

      const byPerson = new Map();
      group.rows.forEach(row => {
        const key = String(row.personne_id);
        if (!byPerson.has(key)) {
          byPerson.set(key, {
            prenom: row.prenom,
            nom: row.nom,
            telephone: row.telephone,
            rows: []
          });
        }
        byPerson.get(key).rows.push(row);
      });

      const entries = [...byPerson.values()]
        .map(entry => ({
          ...entry,
          rows: entry.rows.sort((a, b) => new Date(a.debut) - new Date(b.debut))
        }))
        .sort((a, b) => {
          const firstA = new Date(a.rows[0].debut);
          const firstB = new Date(b.rows[0].debut);
          return firstA - firstB || alphaCollator.compare(a.prenom, b.prenom) || alphaCollator.compare(a.nom || "", b.nom || "");
        });

      const list = document.createElement("div");
      list.className = "volunteer-list";

      entries.forEach(entry => {
        const item = document.createElement("div");
        item.className = "volunteer-row";
        item.appendChild(buildStatusControl(entry));

        const identity = document.createElement("div");
        identity.className = "volunteer-name";

        const first = document.createElement("span");
        first.className = "volunteer-firstname";
        first.textContent = entry.prenom;
        identity.appendChild(first);

        const meta = document.createElement("div");
        meta.className = "volunteer-meta";

        const surname = document.createElement("span");
        surname.className = "volunteer-surname";
        surname.textContent = (entry.nom || "").toUpperCase();
        meta.appendChild(surname);

        if (entry.telephone) {
          const phone = document.createElement("a");
          phone.className = "volunteer-phone";
          phone.href = `tel:${formatPhoneForLink(entry.telephone)}`;
          phone.textContent = `📞 ${entry.telephone}`;
          meta.appendChild(phone);
        }
        identity.appendChild(meta);

        const delays = entry.rows
          .filter(row => row.statut === "retard")
          .map(row => `En retard de ${row.retard_minutes || 0} min`);
        if (delays.length) {
          const delay = document.createElement("span");
          delay.className = "delay-label";
          delay.textContent = [...new Set(delays)].join(" · ");
          identity.appendChild(delay);
        }

        item.appendChild(identity);

        const range = document.createElement("div");
        range.className = "volunteer-end";
        range.textContent = entry.rows
          .map(row => `${formatTime(row.debut)}-${formatTime(row.fin)}`)
          .join(" | ");
        item.appendChild(range);
        list.appendChild(item);
      });

      section.appendChild(list);
      upcomingGroups.appendChild(section);
    });
}

async function loadUpcoming() {
  hideMessage();
  upcomingGroups.innerHTML = `<div class="empty-now">Chargement…</div>`;

  const postIds = selectedPostIds.size ? [...selectedPostIds].map(Number) : null;
  const placeIds = selectedPlaceIds.size ? [...selectedPlaceIds].map(Number) : null;

  const { data, error } = await supabaseClient.rpc("get_planning_upcoming", {
    p_day: dayFilter.value,
    p_moment: new Date().toISOString(),
    p_poste_ids: postIds,
    p_lieu_ids: placeIds
  });

  if (error) {
    console.error(error);
    upcomingGroups.innerHTML = "";
    showMessage("Impossible de charger le planning. Vérifie que ton compte possède bien un rôle responsable ou admin.", "error");
    return;
  }

  renderGroups(data || []);
}

async function init() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData?.session) {
    window.location.replace("index.html");
    return;
  }

  const { data, error } = await supabaseClient.rpc("get_planning_filter_options");
  if (error) {
    console.error(error);
    showMessage("Cette page est réservée aux responsables et aux admins.", "error");
    return;
  }

  filterRows = data || [];
  const today = currentBrusselsDate();
  const days = [...new Set(filterRows.map(row => row.jour))]
    .filter(day => day >= today)
    .sort((a, b) => a.localeCompare(b));

  dayFilter.innerHTML = "";
  days.forEach(day => {
    const option = document.createElement("option");
    option.value = day;
    option.textContent = formatDayLabel(day);
    dayFilter.appendChild(option);
  });

  if (!days.length) {
    showMessage("Aucun planning horaire à venir n'est disponible.");
    upcomingGroups.innerHTML = "";
    return;
  }

  dayFilter.value = days.includes(today) ? today : days[0];
  dayFilter.addEventListener("change", () => {
    selectedPostIds.clear();
    selectedPlaceIds.clear();
    renderFilterOptions();
    loadUpcoming();
  });

  renderFilterOptions();
  await loadUpcoming();
}

document.addEventListener("click", () => {
  document.querySelectorAll(".status-menu").forEach(menu => menu.hidden = true);
});

logoutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.replace("index.html");
});

init();
