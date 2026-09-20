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

function formatShiftRange(shift) {
  return `${formatCompactTime(shift.debut)}-${formatCompactTime(shift.fin)}`;
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

function buildShiftSelection(group) {
  if (group.shifts.length === 1) {
    return {
      element: null,
      getSelectedShifts: () => group.shifts
    };
  }

  const wrapper = document.createElement("div");
  wrapper.className = "schedule-slot-selector";

  const label = document.createElement("div");
  label.className = "schedule-slot-selector-label";
  label.textContent = "Pour quelle plage horaire ?";
  wrapper.appendChild(label);

  const choices = document.createElement("div");
  choices.className = "schedule-slot-choices";

  const checkboxes = [];

  group.shifts.forEach(shift => {
    const choice = document.createElement("label");
    choice.className = "schedule-slot-choice";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = shift.affectation_id;
    checkbox.dataset.affectationId = shift.affectation_id;

    const text = document.createElement("span");
    text.textContent = formatShiftRange(shift);

    choice.appendChild(checkbox);
    choice.appendChild(text);
    choices.appendChild(choice);
    checkboxes.push(checkbox);
  });

  const allChoice = document.createElement("label");
  allChoice.className = "schedule-slot-choice schedule-slot-choice-all";

  const allCheckbox = document.createElement("input");
  allCheckbox.type = "checkbox";

  const allText = document.createElement("span");
  allText.textContent = "Toutes les plages";

  allCheckbox.addEventListener("change", () => {
    checkboxes.forEach(checkbox => {
      checkbox.checked = allCheckbox.checked;
    });
  });

  checkboxes.forEach(checkbox => {
    checkbox.addEventListener("change", () => {
      allCheckbox.checked = checkboxes.every(item => item.checked);
    });
  });

  allChoice.appendChild(allCheckbox);
  allChoice.appendChild(allText);
  choices.appendChild(allChoice);
  wrapper.appendChild(choices);

  return {
    element: wrapper,
    getSelectedShifts: () => {
      const selectedIds = new Set(
        checkboxes
          .filter(checkbox => checkbox.checked)
          .map(checkbox => checkbox.dataset.affectationId)
      );

      return group.shifts.filter(shift => selectedIds.has(shift.affectation_id));
    }
  };
}

function buildScheduleActions(group) {
  const wrapper = document.createElement("div");
  wrapper.className = "schedule-status-actions";

  const selection = buildShiftSelection(group);
  if (selection.element) {
    wrapper.appendChild(selection.element);
  }

  const controls = document.createElement("div");
  controls.className = "presence-actions schedule-presence-actions";

  const delayWrap = document.createElement("div");
  delayWrap.className = "delay-control";

  const delayButton = document.createElement("button");
  delayButton.type = "button";
  delayButton.className = "presence-action presence-action-orange";
  delayButton.textContent = "Je serai en retard de";

  const delaySelect = document.createElement("select");
  delaySelect.className = "delay-select";
  [5, 10, 15, 20, 30, 45, 60].forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${value} min`;
    delaySelect.appendChild(option);
  });

  delayButton.addEventListener("click", async () => {
    const selected = selection.getSelectedShifts();
    if (selected.length === 0) {
      alert("Choisis d’abord la ou les plages horaires concernées.");
      return;
    }

    if (await setStatusForShifts(selected, "retard", Number(delaySelect.value))) {
      initSchedulePage();
    }
  });

  delayWrap.appendChild(delayButton);
  delayWrap.appendChild(delaySelect);
  controls.appendChild(delayWrap);

  const absentButton = document.createElement("button");
  absentButton.type = "button";
  absentButton.className = "presence-action presence-action-red";
  absentButton.textContent = "Je serai absent·e";
  absentButton.addEventListener("click", async () => {
    const selected = selection.getSelectedShifts();
    if (selected.length === 0) {
      alert("Choisis d’abord la ou les plages horaires concernées.");
      return;
    }

    if (await setStatusForShifts(selected, "absent", null)) {
      initSchedulePage();
    }
  });

  controls.appendChild(absentButton);
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

  const time = document.createElement("div");
  time.className = "schedule-shift-time";
  time.textContent = group.shifts
    .map(formatShiftRange)
    .join(" | ");
  content.appendChild(time);

  if (group.location) {
    const location = document.createElement("p");
    location.className = "schedule-shift-location";
    location.textContent = `📍 ${group.location}`;
    content.appendChild(location);
  }

  content.appendChild(buildScheduleActions(group));
  card.appendChild(content);

  return card;
}

function capitalizeFirst(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

initSchedulePage();
