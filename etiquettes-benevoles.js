/* =========================================================
   ADMINISTRATION — ÉTIQUETTES BÉNÉVOLES
   ========================================================= */

const pagesElement = document.getElementById("labels-pages");
const loadingElement = document.getElementById("labels-loading");
const errorElement = document.getElementById("labels-error");
const printButton = document.getElementById("print-labels-button");
const logoutButton = document.getElementById("logout-button");

let currentUser = null;

function unlockStorageKey() {
  return currentUser ? `portalAdminUnlockedUntil:${currentUser.id}` : "";
}

function isLocallyUnlocked() {
  if (!currentUser) return false;
  const until = Number(sessionStorage.getItem(unlockStorageKey()) || 0);
  return until > Date.now();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function compareFrench(a, b) {
  return normalizeText(a).localeCompare(normalizeText(b), "fr", {
    sensitivity: "base",
    ignorePunctuation: true
  });
}

function sortedVolunteers(volunteers) {
  return [...volunteers].sort((a, b) => {
    const byLastName = compareFrench(a.nom, b.nom);
    if (byLastName !== 0) return byLastName;
    return compareFrench(a.prenom, b.prenom);
  });
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
  let locationName = normalizeText(shift.lieu);

  if (!locationName && normalizeText(shift.note).toLowerCase().includes("hall polyvalent / site")) {
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

function groupDayShifts(dayShifts) {
  const grouped = new Map();

  dayShifts.forEach(shift => {
    const poste = normalizeText(shift.poste) || "Poste à confirmer";
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

  grouped.forEach(group => {
    group.shifts.sort((a, b) => new Date(a.debut) - new Date(b.debut));
  });

  return [...grouped.values()];
}

function createTextElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function createVolunteerLabel(volunteer, shifts) {
  const label = document.createElement("article");
  label.className = "volunteer-label";

  const firstName = normalizeText(volunteer.prenom);
  const lastName = normalizeText(volunteer.nom).toUpperCase();
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Bénévole";

  label.appendChild(createTextElement("h2", "label-volunteer-name", displayName));

  if (!shifts.length) {
    label.appendChild(createTextElement("p", "label-no-schedule", "Aucun horaire disponible."));
    return label;
  }

  const days = groupByDay(shifts);
  let totalGroups = 0;

  days.forEach(dayShifts => {
    const groups = groupDayShifts(dayShifts);
    totalGroups += groups.length;

    const daySection = document.createElement("section");
    daySection.className = "label-day";
    daySection.appendChild(
      createTextElement("h3", "label-day-title", formatDayTitle(dayShifts[0].debut))
    );

    groups.forEach(group => {
      const groupElement = document.createElement("div");
      groupElement.className = "label-shift-group";

      groupElement.appendChild(createTextElement("p", "label-poste", group.poste));

      if (group.location) {
        groupElement.appendChild(createTextElement("p", "label-lieu", group.location));
      }

      groupElement.appendChild(
        createTextElement(
          "p",
          "label-time",
          group.shifts.map(formatShiftRange).join(" | ")
        )
      );

      daySection.appendChild(groupElement);
    });

    label.appendChild(daySection);
  });

  if (days.size >= 4 || totalGroups >= 6 || shifts.length >= 8) {
    label.classList.add("label-dense");
  }

  return label;
}

function renderLabels(volunteers, schedules) {
  pagesElement.innerHTML = "";

  const scheduleMap = new Map();
  schedules.forEach(shift => {
    if (!scheduleMap.has(shift.benevole_id)) {
      scheduleMap.set(shift.benevole_id, []);
    }
    scheduleMap.get(shift.benevole_id).push(shift);
  });

  const orderedVolunteers = sortedVolunteers(volunteers);

  for (let index = 0; index < orderedVolunteers.length; index += 4) {
    const sheet = document.createElement("section");
    sheet.className = "label-sheet";

    orderedVolunteers.slice(index, index + 4).forEach(volunteer => {
      const shifts = scheduleMap.get(volunteer.id) || [];
      sheet.appendChild(createVolunteerLabel(volunteer, shifts));
    });

    pagesElement.appendChild(sheet);
  }
}

function showError(message) {
  loadingElement.hidden = true;
  errorElement.textContent = message;
  errorElement.hidden = false;
}

async function waitForFonts() {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch (error) {
      console.warn("Chargement des polices non confirmé :", error);
    }
  }
}

async function printLabels() {
  await waitForFonts();
  window.print();
}

async function loadLabels() {
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

  const [volunteersResult, schedulesResult] = await Promise.all([
    PortalAuth.client.rpc("admin_list_benevoles"),
    PortalAuth.client.rpc("admin_list_all_benevole_schedules")
  ]);

  if (volunteersResult.error || schedulesResult.error) {
    console.error("Erreur bénévoles :", volunteersResult.error);
    console.error("Erreur horaires :", schedulesResult.error);
    showError("Impossible de préparer les étiquettes pour le moment.");
    return;
  }

  const volunteers = Array.isArray(volunteersResult.data) ? volunteersResult.data : [];
  const schedules = Array.isArray(schedulesResult.data) ? schedulesResult.data : [];

  if (!volunteers.length) {
    showError("Aucun bénévole à imprimer.");
    return;
  }

  renderLabels(volunteers, schedules);
  loadingElement.hidden = true;
  printButton.disabled = false;

  const params = new URLSearchParams(window.location.search);
  if (params.get("print") === "1") {
    await waitForFonts();
    window.setTimeout(() => window.print(), 250);
  }
}

printButton.addEventListener("click", printLabels);

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

loadLabels();
