const SUPABASE_URL = "https://ftfhtyohyjezoibmumum.supabase.co";
const SUPABASE_KEY = "sb_publishable_oQOnxMDMyvx6ukcuJHgWuQ_Gu-utQe3";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const dayFilter = document.getElementById("day-filter");
const postFilter = document.getElementById("post-filter");
const placeFilter = document.getElementById("place-filter");
const completeResult = document.getElementById("complete-result");
const messageBox = document.getElementById("planning-message");
const logoutButton = document.getElementById("logout-button");

let filterRows = [];

const alphaCollator = new Intl.Collator("fr", {
  sensitivity: "base",
  ignorePunctuation: true,
  numeric: true
});

function showMessage(text, type = "info") {
  messageBox.hidden = false;
  messageBox.className = `planning-message ${type}`;
  messageBox.textContent = text;
}

function hideMessage() {
  messageBox.hidden = true;
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

function formatWeekdayUpper(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("fr-BE", {
    weekday: "long",
    timeZone: "Europe/Brussels"
  }).format(date).toUpperCase();
}

function uniqueBy(items, keyFn) {
  const map = new Map();
  items.forEach(item => map.set(keyFn(item), item));
  return [...map.values()];
}

function rowsForSelectedDay() {
  return filterRows.filter(row => row.jour === dayFilter.value);
}

function rowsForSelectedPost() {
  return rowsForSelectedDay().filter(row => String(row.poste_id) === postFilter.value);
}

function renderDays() {
  const days = [...new Set(filterRows.map(row => row.jour))].sort((a, b) => a.localeCompare(b));
  dayFilter.innerHTML = "";
  days.forEach(day => {
    const option = document.createElement("option");
    option.value = day;
    option.textContent = formatDayLabel(day);
    dayFilter.appendChild(option);
  });
}

function renderPosts() {
  const posts = uniqueBy(rowsForSelectedDay(), row => String(row.poste_id))
    .sort((a, b) => alphaCollator.compare(a.poste_nom, b.poste_nom));

  const previous = postFilter.value;
  postFilter.innerHTML = "";
  posts.forEach(post => {
    const option = document.createElement("option");
    option.value = String(post.poste_id);
    option.textContent = post.poste_nom;
    postFilter.appendChild(option);
  });

  if (posts.some(post => String(post.poste_id) === previous)) postFilter.value = previous;
}

function placeKey(row) {
  return row.lieu_id === null ? "none" : String(row.lieu_id);
}

function renderPlaces() {
  const places = uniqueBy(rowsForSelectedPost(), row => placeKey(row))
    .sort((a, b) => alphaCollator.compare(a.lieu_nom || "Lieu à confirmer", b.lieu_nom || "Lieu à confirmer"));

  const previous = placeFilter.value;
  placeFilter.innerHTML = "";
  places.forEach(place => {
    const option = document.createElement("option");
    option.value = placeKey(place);
    option.textContent = place.lieu_nom || "Lieu à confirmer";
    placeFilter.appendChild(option);
  });

  if (places.some(place => placeKey(place) === previous)) placeFilter.value = previous;
}

function dayStartMomentIso(isoDate) {
  return `${isoDate}T00:00:00+02:00`;
}

function volunteerShortName(row) {
  const initial = (row.nom || "").trim().charAt(0).toUpperCase();
  return `${row.prenom}${initial ? ` ${initial}.` : ""}`;
}

function buildSegments(rows) {
  const points = [...new Set(rows.flatMap(row => [
    new Date(row.debut).getTime(),
    new Date(row.fin).getTime()
  ]))].sort((a, b) => a - b);

  const segments = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    if (end > start) segments.push({ start, end });
  }
  return segments;
}

function renderComplete(rows) {
  completeResult.innerHTML = "";

  if (!rows.length) {
    completeResult.innerHTML = '<div class="empty-now">Aucun planning horaire pour cette sélection</div>';
    return;
  }

  const first = rows[0];

  const title = document.createElement("div");
  title.className = "complete-title-card";

  const main = document.createElement("div");
  main.className = "complete-title-main";

  const post = document.createElement("div");
  post.className = "complete-title-post";
  post.textContent = first.poste_nom;

  const place = document.createElement("div");
  place.className = "complete-title-place";
  place.textContent = first.lieu_nom || "Lieu à confirmer";

  main.append(post, place);

  const day = document.createElement("div");
  day.className = "complete-title-day";
  day.textContent = formatWeekdayUpper(dayFilter.value);

  title.append(main, day);
  completeResult.appendChild(title);

  const segments = buildSegments(rows);
  if (!segments.length) return;

  const wrap = document.createElement("div");
  wrap.className = "complete-grid-wrap";

  const table = document.createElement("table");
  table.className = "complete-grid";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  segments.forEach(segment => {
    const th = document.createElement("th");
    th.textContent = `${formatTime(segment.start)}-${formatTime(segment.end)}`;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  const bodyRow = document.createElement("tr");

  segments.forEach(segment => {
    const td = document.createElement("td");
    const presentRows = rows
      .filter(row => new Date(row.debut).getTime() <= segment.start && new Date(row.fin).getTime() >= segment.end)
      .sort((a, b) =>
        alphaCollator.compare(a.nom || "", b.nom || "") ||
        alphaCollator.compare(a.prenom || "", b.prenom || "")
      );

    const uniquePeople = uniqueBy(presentRows, row => String(row.personne_id));

    if (!uniquePeople.length) {
      const empty = document.createElement("span");
      empty.className = "complete-empty-cell";
      empty.textContent = "—";
      td.appendChild(empty);
    } else {
      const names = document.createElement("div");
      names.className = "complete-cell-names";
      uniquePeople.forEach(row => {
        const name = document.createElement("div");
        name.className = "complete-volunteer-name";
        name.textContent = volunteerShortName(row);
        names.appendChild(name);
      });
      td.appendChild(names);
    }

    bodyRow.appendChild(td);
  });

  tbody.appendChild(bodyRow);
  table.append(thead, tbody);
  wrap.appendChild(table);
  completeResult.appendChild(wrap);
}

async function loadComplete() {
  hideMessage();

  if (!dayFilter.value || !postFilter.value || !placeFilter.value) {
    completeResult.innerHTML = '<div class="empty-now">Aucune sélection disponible</div>';
    return;
  }

  completeResult.innerHTML = '<div class="empty-now">Chargement…</div>';

  const { data, error } = await supabaseClient.rpc("get_planning_upcoming", {
    p_day: dayFilter.value,
    p_moment: dayStartMomentIso(dayFilter.value),
    p_poste_ids: [Number(postFilter.value)],
    p_lieu_ids: null
  });

  if (error) {
    console.error(error);
    completeResult.innerHTML = "";
    showMessage("Impossible de charger le planning complet.", "error");
    return;
  }

  const selectedPlace = placeFilter.value;
  const rows = (data || []).filter(row => placeKey(row) === selectedPlace);
  renderComplete(rows);
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
  if (!filterRows.length) {
    showMessage("Aucun planning n'est disponible pour tes responsabilités.");
    return;
  }

  renderDays();
  renderPosts();
  renderPlaces();

  dayFilter.addEventListener("change", async () => {
    renderPosts();
    renderPlaces();
    await loadComplete();
  });

  postFilter.addEventListener("change", async () => {
    renderPlaces();
    await loadComplete();
  });

  placeFilter.addEventListener("change", loadComplete);

  await loadComplete();
}

logoutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.replace("index.html");
});

init();
