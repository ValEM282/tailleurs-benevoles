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

function selectedPostInfo() {
  const value = postFilter.value || "";
  const [kind, rawId] = value.split(":");
  const id = Number(rawId);
  return { kind, id };
}

function rowsForSelectedPost() {
  const selected = selectedPostInfo();
  const rows = rowsForSelectedDay();
  if (selected.kind === "parent") {
    return rows.filter(row => Number(row.parent_poste_id) === selected.id);
  }
  return rows.filter(row => Number(row.poste_id) === selected.id);
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
  const dayRows = rowsForSelectedDay();
  const previous = postFilter.value;
  postFilter.innerHTML = "";

  const parents = uniqueBy(
    dayRows.filter(row => row.parent_poste_id !== null),
    row => String(row.parent_poste_id)
  ).sort((a, b) => alphaCollator.compare(a.parent_poste_nom || "", b.parent_poste_nom || ""));

  const posts = uniqueBy(dayRows, row => String(row.poste_id))
    .sort((a, b) => alphaCollator.compare(a.poste_nom, b.poste_nom));

  const options = [
    ...parents.map(parent => ({
      value: `parent:${parent.parent_poste_id}`,
      label: parent.parent_poste_nom,
      isParent: true
    })),
    ...posts.map(post => ({
      value: `post:${post.poste_id}`,
      label: post.poste_nom,
      isParent: false
    }))
  ].sort((a, b) => {
    const nameDiff = alphaCollator.compare(a.label, b.label);
    if (nameDiff) return nameDiff;
    return Number(b.isParent) - Number(a.isParent);
  });

  options.forEach(item => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.isParent ? item.label : item.label;
    postFilter.appendChild(option);
  });

  if (options.some(option => option.value === previous)) postFilter.value = previous;
}

function placeKey(row) {
  return row.lieu_id === null ? "none" : String(row.lieu_id);
}

function renderPlaces() {
  const rows = rowsForSelectedPost();
  const selected = selectedPostInfo();
  const places = uniqueBy(rows, row => placeKey(row))
    .sort((a, b) => alphaCollator.compare(a.lieu_nom || "Lieu à confirmer", b.lieu_nom || "Lieu à confirmer"));

  const previous = placeFilter.value;
  placeFilter.innerHTML = "";

  if (selected.kind === "parent") {
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "Tous les lieux";
    placeFilter.appendChild(allOption);
  }

  places.forEach(place => {
    const option = document.createElement("option");
    option.value = placeKey(place);
    option.textContent = place.lieu_nom || "Lieu à confirmer";
    placeFilter.appendChild(option);
  });

  const allowedValues = [...placeFilter.options].map(option => option.value);
  if (allowedValues.includes(previous)) {
    placeFilter.value = previous;
  } else if (selected.kind === "parent") {
    placeFilter.value = "all";
  }
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

function peopleForSegment(rows, segment) {
  const presentRows = rows
    .filter(row => new Date(row.debut).getTime() <= segment.start && new Date(row.fin).getTime() >= segment.end)
    .sort((a, b) =>
      alphaCollator.compare(a.prenom || "", b.prenom || "") ||
      alphaCollator.compare(a.nom || "", b.nom || "")
    );

  return uniqueBy(presentRows, row => String(row.personne_id));
}

function renderOneCompleteTable(rows) {
  const first = rows[0];

  const block = document.createElement("div");
  block.className = "complete-result-block";

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
  block.appendChild(title);

  const segments = buildSegments(rows);
  if (!segments.length) return block;

  const segmentPeople = segments.map(segment => peopleForSegment(rows, segment));

  const wrap = document.createElement("div");
  wrap.className = "complete-grid-wrap";

  const table = document.createElement("table");
  table.className = "complete-grid";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  segments.forEach((segment, index) => {
    const th = document.createElement("th");

    const time = document.createElement("div");
    time.className = "complete-column-time";
    time.textContent = `${formatTime(segment.start)}-${formatTime(segment.end)}`;
    th.appendChild(time);

    const count = segmentPeople[index].length;
    if (count > 0) {
      const subtitle = document.createElement("div");
      subtitle.className = "complete-column-count";
      subtitle.textContent = `${count} bén.`;
      th.appendChild(subtitle);
    }

    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  const bodyRow = document.createElement("tr");

  segmentPeople.forEach(uniquePeople => {
    const td = document.createElement("td");

    if (!uniquePeople.length) {
      td.classList.add("complete-empty-td");
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
  block.appendChild(wrap);

  return block;
}

function renderComplete(rows) {
  completeResult.innerHTML = "";

  if (!rows.length) {
    completeResult.innerHTML = '<div class="empty-now">Aucun planning horaire pour cette sélection</div>';
    return;
  }

  const groups = new Map();
  rows.forEach(row => {
    const key = `${row.poste_id}|${row.lieu_id ?? "none"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  [...groups.values()]
    .sort((a, b) =>
      alphaCollator.compare(a[0].poste_nom || "", b[0].poste_nom || "") ||
      alphaCollator.compare(a[0].lieu_nom || "", b[0].lieu_nom || "")
    )
    .forEach(groupRows => completeResult.appendChild(renderOneCompleteTable(groupRows)));
}

async function loadComplete() {
  hideMessage();

  if (!dayFilter.value || !postFilter.value || !placeFilter.value) {
    completeResult.innerHTML = '<div class="empty-now">Aucune sélection disponible</div>';
    return;
  }

  completeResult.innerHTML = '<div class="empty-now">Chargement…</div>';

  const selectedRows = rowsForSelectedPost();
  const postIds = [...new Set(selectedRows.map(row => Number(row.poste_id)))];

  const { data, error } = await supabaseClient.rpc("get_planning_upcoming", {
    p_day: dayFilter.value,
    p_moment: dayStartMomentIso(dayFilter.value),
    p_poste_ids: postIds,
    p_lieu_ids: null
  });

  if (error) {
    console.error(error);
    completeResult.innerHTML = "";
    showMessage("Impossible de charger le planning complet.", "error");
    return;
  }

  const selectedPlace = placeFilter.value;
  const rows = selectedPlace === "all"
    ? (data || [])
    : (data || []).filter(row => placeKey(row) === selectedPlace);

  renderComplete(rows);
}

async function init() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData?.session) {
    window.location.replace("index.html");
    return;
  }

  const { data, error } = await supabaseClient.rpc("get_planning_complete_filter_options");
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
