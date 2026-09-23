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

function formatPhoneForLink(phone) {
  return (phone || "").replace(/[^0-9+]/g, "");
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

  shifts.forEach(shift => {
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

  dayShifts.forEach(shift => {
    const poste = shift.poste || "Poste à confirmer";
    const location = getLocationName(shift);
    const responsibleKey = [
      shift.responsable_prenom || "",
      shift.responsable_initiale || "",
      shift.responsable_telephone || ""
    ].join("|");
    const key = `${poste}|||${location}|||${responsibleKey}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        poste,
        location,
        responsable_prenom: shift.responsable_prenom || "",
        responsable_initiale: shift.responsable_initiale || "",
        responsable_telephone: shift.responsable_telephone || "",
        shifts: []
      });
    }

    grouped.get(key).shifts.push(shift);
  });

  grouped.forEach(group => {
    group.shifts.sort((a, b) => new Date(a.debut) - new Date(b.debut));
  });

  return grouped;
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
    location.append("📍 ");

    const locationLink = document.createElement("a");
    locationLink.className = "schedule-shift-location-link";
    locationLink.href = "plan.html";
    locationLink.textContent = group.location;

    location.appendChild(locationLink);
    content.appendChild(location);
  }

  const time = document.createElement("div");
  time.className = "schedule-shift-time";
  time.textContent = group.shifts.map(formatShiftRange).join(" | ");
  content.appendChild(time);

  if (group.responsable_prenom) {
    const responsible = document.createElement("p");
    responsible.className = "schedule-shift-responsible";
    responsible.append("Responsable : ");

    const name = document.createElement("span");
    name.textContent = `${group.responsable_prenom} ${group.responsable_initiale || ""}.`.replace("..", ".");
    responsible.appendChild(name);

    if (group.responsable_telephone) {
      responsible.append(" · ");
      const phone = document.createElement("a");
      phone.className = "volunteer-phone";
      phone.href = `tel:${formatPhoneForLink(group.responsable_telephone)}`;
      phone.textContent = group.responsable_telephone;
      responsible.appendChild(phone);
    }

    content.appendChild(responsible);
  }

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
  if (displayName) title.textContent = `Horaires de ${displayName}`;

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
