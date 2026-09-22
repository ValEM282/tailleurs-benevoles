/* =========================================================
   MES HORAIRES DE BÉNÉVOLE
   ========================================================= */

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
    const { data: shifts, error } = await PortalAuth.client.rpc("get_my_schedule");
    if (error) throw error;

    loadingElement.hidden = true;

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

  const wrapper = document.createElement("span");
  wrapper.className = "schedule-slot-status-wrap";

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

  const separator = document.createElement("span");
  separator.className = "schedule-status-separator";
  separator.textContent = "·";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "schedule-status-cancel";
  cancel.textContent = "Annuler";
  cancel.setAttribute("aria-label", `Annuler le statut ${text.textContent} pour ${formatShiftRange(shift)}`);

  cancel.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();
    cancel.disabled = true;

    if (await setStatusForShifts([shift], "inconnu", null)) {
      await loadSchedule();
    } else {
      cancel.disabled = false;
    }
  });

  wrapper.append(badge, separator, cancel);
  return wrapper;
}

function buildScheduleActions(group) {
  const now = Date.now();
  const eligibleShifts = group.shifts.filter(shift => new Date(shift.fin).getTime() > now);

  if (!eligibleShifts.length) return null;

  const wrapper = document.createElement("div");
  wrapper.className = "schedule-status-actions";

  const title = document.createElement("p");
  title.className = "schedule-action-title";
  title.textContent = "En retard ou absent·e ?";
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

  const getSelectedShifts = () => {
    const selectedIds = new Set(
      checkboxes
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.dataset.affectationId)
    );
    return eligibleShifts.filter(shift => selectedIds.has(shift.affectation_id));
  };

  const statusControl = document.createElement("div");
  statusControl.className = "volunteer-status-control schedule-status-picker";

  const statusButton = document.createElement("button");
  statusButton.type = "button";
  statusButton.className = "volunteer-status-button";
  statusButton.setAttribute("aria-label", "Choisir le statut à annoncer");
  statusButton.setAttribute("aria-expanded", "false");

  const currentDot = document.createElement("span");
  currentDot.className = "volunteer-status-dot volunteer-status-inconnu";
  currentDot.setAttribute("aria-hidden", "true");

  const currentLabel = document.createElement("span");
  currentLabel.className = "volunteer-status-label";
  currentLabel.textContent = "Choisir un statut";

  const chevron = document.createElement("span");
  chevron.className = "volunteer-status-chevron";
  chevron.textContent = "▾";
  chevron.setAttribute("aria-hidden", "true");

  statusButton.append(currentDot, currentLabel, chevron);

  const menu = document.createElement("div");
  menu.className = "volunteer-status-menu";
  menu.hidden = true;

  const delayBlock = document.createElement("div");
  delayBlock.className = "volunteer-delay-block";

  const delayHeader = document.createElement("button");
  delayHeader.type = "button";
  delayHeader.className = "volunteer-status-option volunteer-delay-toggle";

  const delaySwatch = document.createElement("span");
  delaySwatch.className = "volunteer-status-swatch volunteer-status-retard";

  const delayText = document.createElement("span");
  delayText.textContent = "En retard";
  delayHeader.append(delaySwatch, delayText);

  const delayChoices = document.createElement("div");
  delayChoices.className = "volunteer-delay-choices";
  delayChoices.hidden = true;

  [5, 10, 15, 20, 30, 45, 60].forEach(minutes => {
    const delayChoice = document.createElement("button");
    delayChoice.type = "button";
    delayChoice.className = "volunteer-delay-choice";
    delayChoice.textContent = `${minutes} min`;
    delayChoice.addEventListener("click", async event => {
      event.stopPropagation();
      const selected = getSelectedShifts();
      if (!selected.length) {
        alert("Choisis d’abord la ou les plages horaires concernées.");
        return;
      }

      menu.hidden = true;
      statusButton.setAttribute("aria-expanded", "false");
      if (await setStatusForShifts(selected, "retard", minutes)) {
        await loadSchedule();
      }
    });
    delayChoices.appendChild(delayChoice);
  });

  delayHeader.addEventListener("click", event => {
    event.stopPropagation();
    delayChoices.hidden = !delayChoices.hidden;
  });

  delayBlock.append(delayHeader, delayChoices);
  menu.appendChild(delayBlock);

  const absenceOption = document.createElement("button");
  absenceOption.type = "button";
  absenceOption.className = "volunteer-status-option";

  const absenceSwatch = document.createElement("span");
  absenceSwatch.className = "volunteer-status-swatch volunteer-status-absent";

  const absenceText = document.createElement("span");
  absenceText.textContent = "Absent·e";
  absenceOption.append(absenceSwatch, absenceText);

  absenceOption.addEventListener("click", async event => {
    event.stopPropagation();
    const selected = getSelectedShifts();
    if (!selected.length) {
      alert("Choisis d’abord la ou les plages horaires concernées.");
      return;
    }

    menu.hidden = true;
    statusButton.setAttribute("aria-expanded", "false");
    if (await setStatusForShifts(selected, "absent", null)) {
      await loadSchedule();
    }
  });

  menu.appendChild(absenceOption);

  statusButton.addEventListener("click", event => {
    event.stopPropagation();
    document.querySelectorAll(".volunteer-status-menu").forEach(other => {
      if (other !== menu) other.hidden = true;
    });
    menu.hidden = !menu.hidden;
    statusButton.setAttribute("aria-expanded", menu.hidden ? "false" : "true");
  });

  statusControl.append(statusButton, menu);
  wrapper.appendChild(statusControl);

  return wrapper;
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

  const actions = buildScheduleActions(group);
  if (actions) content.appendChild(actions);

  card.appendChild(content);
  return card;
}

function capitalizeFirst(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

document.addEventListener("click", () => {
  document.querySelectorAll(".volunteer-status-menu").forEach(menu => {
    menu.hidden = true;
  });
  document.querySelectorAll(".volunteer-status-button").forEach(button => {
    button.setAttribute("aria-expanded", "false");
  });
});

initSchedulePage();
