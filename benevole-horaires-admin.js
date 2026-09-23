/* =========================================================
   ADMINISTRATION — HORAIRES D'UN BÉNÉVOLE
   ========================================================= */

let currentUser = null;

function unlockStorageKey() {
  return currentUser ? `portalAdminUnlockedUntil:${currentUser.id}` : "";
}

function isLocallyUnlocked() {
  if (!currentUser) return false;
  const until = Number(sessionStorage.getItem(unlockStorageKey()) || 0);
  return until > Date.now();
}

function capitalizeFirst(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDayTitle(value) {
  return capitalizeFirst(
    new Intl.DateTimeFormat("fr-BE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Brussels"
    }).format(new Date(value))
  );
}

function formatCompactTime(value) {
  const parts = new Intl.DateTimeFormat("fr-BE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Brussels"
  }).formatToParts(new Date(value));

  const hour = Number(parts.find(part => part.type === "hour")?.value || "0");
  const minute = parts.find(part => part.type === "minute")?.value || "00";
  return minute === "00" ? `${hour}h` : `${hour}h${minute}`;
}

function formatShiftRange(shift) {
  return `${formatCompactTime(shift.debut)}-${formatCompactTime(shift.fin)}`;
}

function getLocationName(shift) {
  let locationName = shift.lieu || "";
  if (!locationName && shift.note && shift.note.toLowerCase().includes("hall polyvalent / site")) {
    locationName = "Hall polyvalent / Site festival";
  }
  return locationName;
}

function groupByDay(shifts) {
  const grouped = new Map();

  [...shifts]
    .sort((a, b) => new Date(a.debut) - new Date(b.debut))
    .forEach(shift => {
      const key = new Intl.DateTimeFormat("fr-CA", {
        timeZone: "Europe/Brussels",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date(shift.debut));

      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(shift);
    });

  return grouped;
}

function groupDayShiftsByPost(dayShifts) {
  const grouped = new Map();

  [...dayShifts]
    .sort((a, b) => new Date(a.debut) - new Date(b.debut))
    .forEach(shift => {
      const poste = shift.poste || "Poste à confirmer";
      const location = getLocationName(shift);
      const key = `${poste}|||${location}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          poste,
          location,
          shifts: []
        });
      }

      grouped.get(key).shifts.push(shift);
    });

  const groups = Array.from(grouped.values());

  groups.forEach(group => {
    group.shifts.sort((a, b) => new Date(a.debut) - new Date(b.debut));
  });

  groups.sort((a, b) => new Date(a.shifts[0].debut) - new Date(b.shifts[0].debut));

  return groups;
}

function createShiftCard(group) {
  const card = document.createElement("article");
  card.className = "schedule-shift-card";

  const allShiftsPast = group.shifts.every(shift => new Date(shift.fin).getTime() <= Date.now());
  if (allShiftsPast) card.classList.add("schedule-shift-card-past");

  const content = document.createElement("div");
  content.className = "schedule-shift-content";

  const poste = document.createElement("h3");
  poste.textContent = group.poste;
  content.appendChild(poste);

  if (group.location) {
    const location = document.createElement("p");
    location.className = "schedule-shift-location";
    location.textContent = group.location;
    content.appendChild(location);
  }

  const time = document.createElement("div");
  time.className = "schedule-shift-time";
  time.textContent = group.shifts.map(formatShiftRange).join(" | ");
  content.appendChild(time);

  card.appendChild(content);
  return card;
}

async function loadSchedule(volunteerId) {
  const loadingElement = document.getElementById("schedule-loading");
  const emptyElement = document.getElementById("schedule-empty");
  const errorElement = document.getElementById("schedule-error");
  const scheduleList = document.getElementById("schedule-list");

  loadingElement.hidden = false;
  emptyElement.hidden = true;
  errorElement.hidden = true;
  scheduleList.innerHTML = "";

  const { data: shifts, error } = await PortalAuth.client.rpc("admin_get_benevole_schedule", {
    p_benevole_id: volunteerId
  });

  loadingElement.hidden = true;

  if (error) {
    console.error("Erreur horaires admin :", error);
    errorElement.hidden = false;
    return;
  }

  if (!shifts || !shifts.length) {
    emptyElement.hidden = false;
    return;
  }

  const grouped = groupByDay(shifts);

  grouped.forEach(dayShifts => {
    const daySection = document.createElement("section");
    daySection.className = "schedule-day";

    const heading = document.createElement("h2");
    heading.className = "schedule-day-title";
    heading.textContent = formatDayTitle(dayShifts[0].debut);
    daySection.appendChild(heading);

    const cards = document.createElement("div");
    cards.className = "schedule-day-cards";

    groupDayShiftsByPost(dayShifts).forEach(group => {
      cards.appendChild(createShiftCard(group));
    });

    daySection.appendChild(cards);
    scheduleList.appendChild(daySection);
  });
}

async function initPage() {
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

  const params = new URLSearchParams(window.location.search);
  const volunteerId = params.get("id");
  const prenom = (params.get("prenom") || "").trim();
  const nom = (params.get("nom") || "").trim();

  if (!volunteerId) {
    window.location.replace("benevoles-liste.html");
    return;
  }

  const displayName = [prenom, nom].filter(Boolean).join(" ");
  const title = document.getElementById("volunteer-schedule-title");
  if (displayName) title.textContent = displayName;

  const printLabelButton = document.getElementById("print-volunteer-label-button");
  if (printLabelButton) {
    printLabelButton.addEventListener("click", () => {
      const labelParams = new URLSearchParams({
        id: volunteerId,
        print: "1"
      });
      window.location.href = `etiquettes-benevoles.html?${labelParams.toString()}`;
    });
  }

  const logoutButton = document.getElementById("logout-button");
  logoutButton.addEventListener("click", async () => {
    sessionStorage.removeItem(unlockStorageKey());
    logoutButton.disabled = true;
    logoutButton.textContent = "Déconnexion...";

    const success = await PortalAuth.logout();
    if (!success) {
      logoutButton.disabled = false;
      logoutButton.textContent = "Se déconnecter";
    }
  });

  await loadSchedule(volunteerId);
}

initPage();
