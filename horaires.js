/* =========================================================
   MES HORAIRES DE BÉNÉVOLE
   ========================================================= */

async function initSchedulePage() {
  const user = await PortalAuth.requireAuth();
  if (!user) return;

  const logoutButton = document.getElementById("logout-button");
  const loadingElement = document.getElementById("schedule-loading");
  const emptyElement = document.getElementById("schedule-empty");
  const errorElement = document.getElementById("schedule-error");
  const scheduleList = document.getElementById("schedule-list");

  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Déconnexion...";

    const success = await PortalAuth.logout();
    if (!success) {
      logoutButton.disabled = false;
      logoutButton.textContent = "Se déconnecter";
    }
  });

  try {
    const { data: shifts, error } = await PortalAuth.client
      .rpc("get_my_schedule");

    if (error) throw error;

    loadingElement.hidden = true;

    if (!shifts || shifts.length === 0) {
      emptyElement.hidden = false;
      return;
    }

    const grouped = groupByDay(shifts);
    scheduleList.innerHTML = "";

    grouped.forEach((dayShifts) => {
      const daySection = document.createElement("section");
      daySection.className = "schedule-day";

      const heading = document.createElement("h2");
      heading.className = "schedule-day-title";
      heading.textContent = formatDayTitle(dayShifts[0].debut);
      daySection.appendChild(heading);

      const cards = document.createElement("div");
      cards.className = "schedule-day-cards";

      const groupedByPost = groupDayShiftsByPost(dayShifts);

      groupedByPost.forEach(group => {
        cards.appendChild(createShiftCard(group));
      });

      daySection.appendChild(cards);
      scheduleList.appendChild(daySection);
    });
  }
  catch (error) {
    console.error("Erreur horaires :", error);
    loadingElement.hidden = true;
    errorElement.hidden = false;
  }
}

function groupByDay(shifts) {
  const grouped = new Map();

  shifts.forEach(shift => {
    const date = new Date(shift.debut);
    const key = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Europe/Brussels",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key).push(shift);
  });

  return grouped;
}

function getLocationName(shift) {
  let locationName = shift.lieu || "";

  if (
    !locationName &&
    shift.note &&
    shift.note.toLowerCase().includes("hall polyvalent / site")
  ) {
    locationName = "Hall polyvalent / Site festival";
  }

  return locationName;
}

function groupDayShiftsByPost(dayShifts) {
  const grouped = new Map();

  dayShifts.forEach(shift => {
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

  grouped.forEach(group => {
    group.shifts.sort(
      (a, b) => new Date(a.debut) - new Date(b.debut)
    );
  });

  return grouped;
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

  const hour = Number(
    parts.find(part => part.type === "hour")?.value || "0"
  );

  const minute =
    parts.find(part => part.type === "minute")?.value || "00";

  return minute === "00"
    ? `${hour}h`
    : `${hour}h${minute}`;
}

function createShiftCard(group) {
  const card = document.createElement("article");
  card.className = "schedule-shift-card";

  const content = document.createElement("div");
  content.className = "schedule-shift-content";

  const poste = document.createElement("h3");
  poste.textContent = group.poste;
  content.appendChild(poste);

  const time = document.createElement("div");
  time.className = "schedule-shift-time";
  time.textContent = group.shifts
    .map(
      shift =>
        `${formatCompactTime(shift.debut)}-${formatCompactTime(shift.fin)}`
    )
    .join(" | ");
  content.appendChild(time);

  if (group.location) {
    const location = document.createElement("p");
    location.className = "schedule-shift-location";
    location.textContent = `📍 ${group.location}`;
    content.appendChild(location);
  }

  card.appendChild(content);

  return card;
}

function capitalizeFirst(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

initSchedulePage();
