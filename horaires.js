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

    grouped.forEach((dayShifts, dayKey) => {
      const daySection = document.createElement("section");
      daySection.className = "schedule-day";

      const heading = document.createElement("h2");
      heading.className = "schedule-day-title";
      heading.textContent = formatDayTitle(dayShifts[0].debut);
      daySection.appendChild(heading);

      const cards = document.createElement("div");
      cards.className = "schedule-day-cards";

      dayShifts.forEach(shift => {
        cards.appendChild(createShiftCard(shift));
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

function formatTime(value) {
  return new Intl.DateTimeFormat("fr-BE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Brussels"
  }).format(new Date(value)).replace(":", "h");
}

function createShiftCard(shift) {
  const card = document.createElement("article");
  card.className = "schedule-shift-card";

  const time = document.createElement("div");
  time.className = "schedule-shift-time";
  time.textContent = `${formatTime(shift.debut)} – ${formatTime(shift.fin)}`;

  const content = document.createElement("div");
  content.className = "schedule-shift-content";

  const poste = document.createElement("h3");
  poste.textContent = shift.poste || "Poste à confirmer";
  content.appendChild(poste);

  let locationName = shift.lieu || "";
  if (!locationName && shift.note && shift.note.toLowerCase().includes("hall polyvalent / site")) {
    locationName = "Hall polyvalent / Site festival";
  }

  if (locationName) {
    const location = document.createElement("p");
    location.className = "schedule-shift-location";
    location.textContent = `📍 ${locationName}`;
    content.appendChild(location);
  }

  card.appendChild(time);
  card.appendChild(content);

  return card;
}

function capitalizeFirst(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

initSchedulePage();
