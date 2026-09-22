/* =========================================================
   MES HORAIRES DE BÉNÉVOLE
   ========================================================= */

let nextShiftId = null;

async function initSchedulePage() {
  const user = await PortalAuth.requireAuth();
  if (!user) return;

  const logoutButton = document.getElementById("logout-button");
  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Déconnexion...";

    const success = await PortalAuth.logout();
    if (!success) {
      logoutButton.disabled = false;
      logoutButton.textContent = "Se déconnecter";
    }
  });

  await loadSchedule();
}

async function loadSchedule() {
  const loadingElement = document.getElementById("schedule-loading");
  const emptyElement = document.getElementById("schedule-empty");
  const errorElement = document.getElementById("schedule-error");
  const scheduleList = document.getElementById("schedule-list");

  loadingElement.hidden = false;
  emptyElement.hidden = true;
  errorElement.hidden = true;
  scheduleList.innerHTML = "";

  try {
    const [scheduleResult, nextResult] = await Promise.all([
      PortalAuth.client.rpc("get_my_schedule"),
      PortalAuth.client.rpc("get_my_next_shift")
    ]);

    if (scheduleResult.error) throw scheduleResult.error;
    if (nextResult.error) throw nextResult.error;

    const shifts = scheduleResult.data || [];
    nextShiftId = nextResult.data?.[0]?.affectation_id || null;

    loadingElement.hidden = true;

    if (!shifts.length) {
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
  } catch (error) {
    console.error("Erreur horaires :", error);
    loadingElement.hidden = true;
    errorElement.hidden = false;
  }
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

function getLocationName(shift) {
  let locationName = shift.lieu || "";

  if (!locationName && shift.note && shift.note.toLowerCase().includes("hall polyvalent / site")) {
    locationName = "Hall polyvalent / Site festival";
  }

  return locationName;
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

async function setStatusForShifts(shifts, status, retardMinutes = null) {
  const results = await Promise.all(
    shifts.map(shift =>
      PortalAuth.client.rpc("set_my_presence_status", {
        p_affectation_id: shift.affectation_id,
        p_statut: status,
        p_retard_minutes: retardMinutes,
        p_disponible: false
      })
    )
  );

  const failed = results.find(result => result.error);
  if (failed) {
    console.error("Erreur de mise à jour du statut :", failed.error);
    alert("Impossible de mettre à jour ce statut pour le moment.");
    return false;
  }

  return true;
}

function buildSlotStatus(shift) {
  if (shift.statut !== "retard" && shift.statut !== "absent") return null;

  const badge = document.createElement("span");
  badge.className = `schedule-slot-status schedule-slot-status-${shift.statut}`;

  const dot = document.createElement("span");
  dot.className = "schedule-slot-dot";
  dot.setAttribute("aria-hidden", "true");

  const text = document.createElement("span");
  text.textContent = shift.statut === "retard"
    ? `Retard de ${shift.retard_minutes || 0} min`
    : "Absent·e";

  badge.append(dot, text);
  return badge;
}

function buildScheduleActions(group) {
  const now = Date.now();
  const groupContainsNextShift = group.shifts.some(shift => shift.affectation_id === nextShiftId);
  const eligibleShifts = group.shifts.filter(shift => new Date(shift.fin).getTime() > now);

  if (groupContainsNextShift || !eligibleShifts.length) return null;

  const wrapper = document.createElement("div");
  wrapper.className = "schedule-status-actions";

  const title = document.createElement("p");
  title.className = "schedule-action-title";
  title.append("Annonce ton ");

  const delayWord = document.createElement("span");
  delayWord.className = "schedule-delay-word";
  delayWord.textContent = "retard";
  title.appendChild(delayWord);

  title.append(" ou ton ");

  const absenceWord = document.createElement("span");
  absenceWord.className = "schedule-absence-word";
  absenceWord.textContent = "absence";
  title.appendChild(absenceWord);

  wrapper.appendChild(title);

  const choices = document.createElement("div");
  choices.className = "schedule-slot-choices";
  const checkboxes = [];

  eligibleShifts.forEach(shift => {
    const choice = document.createElement("label");
    choice.className = "schedule-slot-choice";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.affectationId = shift.affectation_id;
    checkboxes.push(checkbox);

    const range = document.createElement("span");
    range.className = "schedule-slot-range";
    range.textContent = formatShiftRange(shift);

    choice.append(checkbox, range);

    const status = buildSlotStatus(shift);
    if (status) choice.appendChild(status);

    choices.appendChild(choice);
  });

  wrapper.appendChild(choices);

  const controls = document.createElement("div");
  controls.className = "schedule-action-controls";

  const delayControl = document.createElement("div");
  delayControl.className = "schedule-delay-control";

  const delayButton = document.createElement("button");
  delayButton.type = "button";
  delayButton.className = "schedule-action-button schedule-action-button-delay";
  delayButton.textContent = "Retard";

  const delaySelect = document.createElement("select");
  delaySelect.className = "schedule-delay-select";
  [5, 10, 15, 20, 30, 45, 60].forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${value} min`;
    delaySelect.appendChild(option);
  });

  const absenceButton = document.createElement("button");
  absenceButton.type = "button";
  absenceButton.className = "schedule-action-button schedule-action-button-absence";
  absenceButton.textContent = "Absence";

  const getSelectedShifts = () => {
    const selectedIds = new Set(
      checkboxes
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.dataset.affectationId)
    );
    return eligibleShifts.filter(shift => selectedIds.has(shift.affectation_id));
  };

  delayButton.addEventListener("click", async () => {
    const selected = getSelectedShifts();
    if (!selected.length) {
      alert("Choisis d’abord la ou les plages horaires concernées.");
      return;
    }

    delayButton.disabled = true;
    absenceButton.disabled = true;
    delaySelect.disabled = true;

    if (await setStatusForShifts(selected, "retard", Number(delaySelect.value))) {
      await loadSchedule();
    } else {
      delayButton.disabled = false;
      absenceButton.disabled = false;
      delaySelect.disabled = false;
    }
  });

  absenceButton.addEventListener("click", async () => {
    const selected = getSelectedShifts();
    if (!selected.length) {
      alert("Choisis d’abord la ou les plages horaires concernées.");
      return;
    }

    delayButton.disabled = true;
    absenceButton.disabled = true;
    delaySelect.disabled = true;

    if (await setStatusForShifts(selected, "absent", null)) {
      await loadSchedule();
    } else {
      delayButton.disabled = false;
      absenceButton.disabled = false;
      delaySelect.disabled = false;
    }
  });

  delayControl.append(delayButton, delaySelect);
  controls.append(delayControl, absenceButton);
  wrapper.appendChild(controls);

  return wrapper;
}

function createShiftCard(group) {
  const card = document.createElement("article");
  card.className = "schedule-shift-card";

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

  const actions = buildScheduleActions(group);
  if (actions) content.appendChild(actions);

  card.appendChild(content);
  return card;
}

function capitalizeFirst(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

initSchedulePage();
