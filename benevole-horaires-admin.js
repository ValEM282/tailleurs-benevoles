/* =========================================================
   ADMINISTRATION — HORAIRES D'UN BÉNÉVOLE
   ========================================================= */

let currentUser = null;
let currentVolunteerId = null;
let currentShifts = [];
let editOptions = { postes: [], lieux: [] };

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

function brusselsDateParts(value) {
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date(value));

  const get = type => parts.find(part => part.type === type)?.value || "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute"))
  };
}

function dayKeyFor(value) {
  const { year, month, day } = brusselsDateParts(value);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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

function formatClockMinutes(minutes) {
  const normalized = ((Number(minutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return minute === 0 ? `${hour}h` : `${hour}h${String(minute).padStart(2, "0")}`;
}

function clockMinutesFor(value) {
  const { hour, minute } = brusselsDateParts(value);
  return hour * 60 + minute;
}

function formatCompactTime(value) {
  return formatClockMinutes(clockMinutesFor(value));
}

function isReinforcementShift(shift) {
  const note = (shift.note || "").toLowerCase();
  return shift.renfort === true || note.startsWith("renfort") || note.startsWith("affectation depuis la liste des bénévoles disponibles");
}

function formatShiftRange(shift) {
  return isReinforcementShift(shift)
    ? `${formatCompactTime(shift.debut)}-RENFORT`
    : `${formatCompactTime(shift.debut)}-${formatCompactTime(shift.fin)}`;
}

function isPastShift(shift) {
  return new Date(shift.fin).getTime() <= Date.now();
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
      const key = dayKeyFor(shift.debut);
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
      const key = `${shift.poste_id || poste}|||${shift.lieu_id || location}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          poste,
          poste_id: shift.poste_id,
          location,
          lieu_id: shift.lieu_id,
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

function buildTimeValues() {
  const values = [];

  for (let minutes = 7 * 60; minutes < 24 * 60; minutes += 15) {
    values.push(minutes);
  }

  for (let minutes = 0; minutes <= 3 * 60; minutes += 15) {
    values.push(minutes);
  }

  return values;
}

const standardTimeValues = buildTimeValues();

function selectOptions(items, selectedId, emptyLabel) {
  const options = [];

  if (emptyLabel) {
    options.push(`<option value="">${escapeHtml(emptyLabel)}</option>`);
  }

  items.forEach(item => {
    const selected = String(item.id) === String(selectedId ?? "") ? " selected" : "";
    options.push(`<option value="${escapeHtml(item.id)}"${selected}>${escapeHtml(item.nom)}</option>`);
  });

  return options.join("");
}

function timeOptions(selectedMinutes) {
  const values = [...standardTimeValues];
  const numericSelected = Number(selectedMinutes);

  if (Number.isFinite(numericSelected) && !values.includes(numericSelected)) {
    values.unshift(numericSelected);
  }

  return values.map(minutes => {
    const selected = minutes === numericSelected ? " selected" : "";
    return `<option value="${minutes}"${selected}>${formatClockMinutes(minutes)}</option>`;
  }).join("");
}

function makeLocalDate(dayKey, minutes, addDay = false) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  if (addDay) date.setDate(date.getDate() + 1);

  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  date.setHours(hour, minute, 0, 0);

  return date;
}

function proposedDates(dayKey, startMinutes, endMinutes) {
  const start = makeLocalDate(dayKey, startMinutes, false);
  const end = makeLocalDate(dayKey, endMinutes, endMinutes <= startMinutes);
  return { start, end };
}

function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function findOverlapWarning(group, proposedSlots) {
  const groupIds = new Set(group.shifts.filter(shift => !isPastShift(shift)).map(shift => shift.affectation_id));

  for (let i = 0; i < proposedSlots.length; i += 1) {
    for (let j = i + 1; j < proposedSlots.length; j += 1) {
      if (intervalsOverlap(
        proposedSlots[i].start,
        proposedSlots[i].end,
        proposedSlots[j].start,
        proposedSlots[j].end
      )) {
        return "Deux plages de ce même bloc se chevauchent. Clique à nouveau sur ✓ si tu souhaites malgré tout enregistrer.";
      }
    }
  }

  const otherShifts = currentShifts.filter(shift => !groupIds.has(shift.affectation_id));

  for (const slot of proposedSlots) {
    for (const other of otherShifts) {
      if (intervalsOverlap(slot.start, slot.end, new Date(other.debut), new Date(other.fin))) {
        return `Cette modification chevauche une autre prestation (${other.poste || "poste"}, ${formatShiftRange(other)}). Clique à nouveau sur ✓ si tu souhaites malgré tout enregistrer.`;
      }
    }
  }

  return "";
}

function adminPresenceInfo(shift) {
  const key = shift.disponible ? "disponible" : (shift.statut || "inconnu");
  const labels = {
    present: "Présent·e",
    absent: "Absent·e",
    disponible: "Disponible",
    en_pause: "En pause",
    inconnu: "Aucun",
    a_venir: "Aucun",
    hors_poste: "Absent·e",
    termine: "Terminé"
  };
  return {
    key,
    label: key === "retard"
      ? `En retard de ${shift.retard_minutes || 0} min`
      : (labels[key] || "Aucun")
  };
}

function closeAdminPresenceMenus(except = null) {
  document.querySelectorAll(".schedule-presence-menu").forEach(menu => {
    if (menu !== except) {
      menu.hidden = true;
      menu.previousElementSibling?.setAttribute("aria-expanded", "false");
    }
  });
}

function futureAdminShifts() {
  return currentShifts.filter(shift => !isPastShift(shift));
}

function renderBulkPresenceControl() {
  const button = document.getElementById("schedule-bulk-status");
  if (!button) return;

  const shifts = futureAdminShifts();
  const allAbsent = shifts.length > 0 && shifts.every(shift => shift.statut === "absent");
  button.disabled = shifts.length === 0;
  button.className = `schedule-presence-dot schedule-presence-${allAbsent ? "absent" : "inconnu"}`;
  button.title = shifts.length
    ? (allAbsent ? "Absent·e pour tous les horaires à venir — cliquer pour modifier"
      : "Modifier la présence pour tous les horaires à venir")
    : "Aucun horaire à venir";
  button.setAttribute("aria-label", button.title);
}

function updateVisibleAdminPresenceControls() {
  document.querySelectorAll(".schedule-presence-row[data-affectation-id]").forEach(row => {
    const shift = currentShifts.find(item => String(item.affectation_id) === row.dataset.affectationId);
    const control = row.querySelector(".schedule-presence-control");
    if (shift && control) control.replaceWith(createAdminPresenceControl(shift));
  });
  renderBulkPresenceControl();
}

function setupBulkPresenceControl() {
  const button = document.getElementById("schedule-bulk-status");
  const menu = document.getElementById("schedule-bulk-menu");
  const absentButton = document.getElementById("schedule-bulk-absent");
  const message = document.getElementById("schedule-bulk-message");

  button.addEventListener("click", event => {
    event.stopPropagation();
    const opening = menu.hidden;
    closeAdminPresenceMenus(menu);
    menu.hidden = !opening;
    button.setAttribute("aria-expanded", String(opening));
  });

  absentButton.addEventListener("click", async event => {
    event.stopPropagation();
    closeAdminPresenceMenus();
    const shifts = futureAdminShifts();
    if (!shifts.length) return;

    button.disabled = true;
    absentButton.disabled = true;
    message.textContent = "Mise à jour des présences…";
    message.hidden = false;

    const results = await Promise.allSettled(shifts.map(shift =>
      PortalAuth.client.rpc("set_managed_presence_status", {
        p_affectation_id: shift.affectation_id,
        p_statut: "absent"
      })
    ));

    let failures = 0;
    results.forEach((result, index) => {
      if (result.status === "rejected" || result.value.error) {
        failures += 1;
        console.error("Impossible de modifier une présence :", result.reason || result.value.error);
        return;
      }
      shifts[index].statut = "absent";
      shifts[index].disponible = false;
      shifts[index].retard_minutes = null;
    });

    updateVisibleAdminPresenceControls();
    absentButton.disabled = false;
    message.textContent = failures
      ? `${shifts.length - failures} horaire(s) mis à jour sur ${shifts.length}. Réessaie pour les autres.`
      : `Absent·e enregistré pour ${shifts.length} horaire(s) à venir.`;
  });
}

function createAdminPresenceControl(shift) {
  const status = adminPresenceInfo(shift);
  const wrapper = document.createElement("div");
  wrapper.className = "schedule-presence-control";

  const dot = document.createElement("button");
  dot.type = "button";
  dot.className = `schedule-presence-dot schedule-presence-${status.key}`;
  dot.title = `${status.label} — cliquer pour modifier`;
  dot.setAttribute("aria-label", `${formatShiftRange(shift)} : ${status.label}. Modifier le statut de présence.`);
  dot.setAttribute("aria-expanded", "false");
  dot.setAttribute("aria-haspopup", "true");
  if (isPastShift(shift)) {
    dot.disabled = true;
    dot.classList.add("schedule-presence-locked");
    dot.title = `${status.label} — poste terminé, statut non modifiable`;
    dot.setAttribute("aria-label", `${formatShiftRange(shift)} : ${status.label}. Poste terminé, statut non modifiable.`);
  }

  const menu = document.createElement("div");
  menu.className = "schedule-presence-menu";
  menu.hidden = true;

  [
    ["present", "Présent·e"],
    ["en_pause", "En pause"],
    ["disponible", "Disponible"],
    ["absent", "Absent·e"],
    ["inconnu", "Aucun"]
  ].forEach(([key, label]) => {
    const option = document.createElement("button");
    option.type = "button";
    const swatch = document.createElement("span");
    swatch.className = `schedule-presence-swatch schedule-presence-${key}`;
    swatch.setAttribute("aria-hidden", "true");
    const caption = document.createElement("span");
    caption.textContent = label;
    option.append(swatch, caption);

    option.addEventListener("click", async event => {
      event.stopPropagation();
      closeAdminPresenceMenus();
      if (isPastShift(shift)) {
        wrapper.replaceWith(createAdminPresenceControl(shift));
        return;
      }
      dot.disabled = true;
      menu.querySelectorAll("button").forEach(button => button.disabled = true);

      try {
        const { error } = await PortalAuth.client.rpc("set_managed_presence_status", {
          p_affectation_id: shift.affectation_id,
          p_statut: key
        });
        if (error) throw error;

        shift.statut = key === "inconnu" ? "a_venir" : (key === "disponible" ? "present" : key);
        shift.disponible = key === "disponible";
        shift.retard_minutes = null;
        wrapper.replaceWith(createAdminPresenceControl(shift));
        renderBulkPresenceControl();
      } catch (error) {
        console.error("Impossible de modifier la présence :", error);
        const message = wrapper.closest(".schedule-shift-card")?.querySelector(".schedule-presence-error");
        if (message) {
          message.textContent = "Le statut n'a pas pu être modifié.";
          message.hidden = false;
        }
        dot.disabled = false;
        menu.querySelectorAll("button").forEach(button => button.disabled = false);
      }
    });

    menu.appendChild(option);
  });

  dot.addEventListener("click", event => {
    event.stopPropagation();
    if (isPastShift(shift)) {
      dot.disabled = true;
      return;
    }
    const opening = menu.hidden;
    closeAdminPresenceMenus(menu);
    menu.hidden = !opening;
    dot.setAttribute("aria-expanded", String(opening));
  });

  wrapper.append(dot, menu);
  return wrapper;
}

document.addEventListener("click", () => closeAdminPresenceMenus());
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeAdminPresenceMenus();
});

function createShiftCard(group, dayKey) {
  const card = document.createElement("article");
  card.className = "schedule-shift-card";

  const allShiftsPast = group.shifts.every(isPastShift);
  if (allShiftsPast) card.classList.add("schedule-shift-card-past");

  const content = document.createElement("div");
  content.className = "schedule-shift-content";

  const heading = document.createElement("div");
  heading.className = "schedule-card-heading";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "schedule-edit-button";
  editButton.textContent = "✏️";
  editButton.title = "Modifier cette affectation";
  editButton.setAttribute("aria-label", `Modifier ${group.poste}`);
  if (allShiftsPast) {
    editButton.disabled = true;
    editButton.title = "Poste terminé — modification impossible";
    editButton.setAttribute("aria-label", `${group.poste} : poste terminé, non modifiable`);
  }
  editButton.addEventListener("click", () => {
    if (group.shifts.every(isPastShift)) {
      editButton.disabled = true;
      return;
    }
    enterEditMode(card, group, dayKey);
  });

  const poste = document.createElement("h3");
  poste.textContent = group.poste;

  heading.append(editButton, poste);
  content.appendChild(heading);

  if (group.location) {
    const location = document.createElement("p");
    location.className = "schedule-shift-location";
    location.textContent = group.location;
    content.appendChild(location);
  }

  const time = document.createElement("div");
  time.className = "schedule-shift-time";
  group.shifts.forEach(shift => {
    const row = document.createElement("div");
    row.className = "schedule-presence-row";
    row.dataset.affectationId = String(shift.affectation_id);
    row.appendChild(createAdminPresenceControl(shift));

    const range = document.createElement("span");
    range.textContent = formatShiftRange(shift);
    row.appendChild(range);
    time.appendChild(row);
  });
  content.appendChild(time);

  const presenceError = document.createElement("p");
  presenceError.className = "schedule-presence-error";
  presenceError.setAttribute("role", "alert");
  presenceError.hidden = true;
  content.appendChild(presenceError);

  card.appendChild(content);
  return card;
}

function createSlotEditorHtml(shift = null, index = 0) {
  const startMinutes = shift ? clockMinutesFor(shift.debut) : 7 * 60;
  const endMinutes = shift ? clockMinutesFor(shift.fin) : 8 * 60;
  const affectationId = shift?.affectation_id || "";

  return `
    <div class="schedule-edit-slot" data-affectation-id="${escapeHtml(affectationId)}">
      <span class="schedule-edit-slot-label">Plage ${index + 1}</span>
      <label>
        <span>Début</span>
        <select class="schedule-edit-start">${timeOptions(startMinutes)}</select>
      </label>
      <label>
        <span>Fin</span>
        <select class="schedule-edit-end">${timeOptions(endMinutes)}</select>
      </label>
    </div>
  `;
}

function enterEditMode(card, group, dayKey) {
  const editableShifts = group.shifts.filter(shift => !isPastShift(shift));
  if (!editableShifts.length) return;
  const firstShift = editableShifts[0];
  const pastShifts = group.shifts.filter(isPastShift);
  card._editableShiftIds = new Set(editableShifts.map(shift => String(shift.affectation_id)));

  card.classList.remove("schedule-shift-card-past");
  card.classList.add("schedule-shift-card-editing");
  card.innerHTML = `
    <div class="schedule-edit-form">
      <div class="schedule-edit-field">
        <label>Poste</label>
        <select class="schedule-edit-poste">
          ${selectOptions(editOptions.postes, group.poste_id, "Choisir un poste")}
        </select>
      </div>

      <div class="schedule-edit-field">
        <label>Lieu</label>
        <select class="schedule-edit-lieu">
          ${selectOptions(editOptions.lieux, group.lieu_id, "Choisir un lieu")}
        </select>
      </div>

      <div class="schedule-edit-slots">
        ${editableShifts.map((shift, index) => createSlotEditorHtml(shift, index)).join("")}
      </div>

      ${pastShifts.length ? `<p class="schedule-edit-past-slots">Plages terminées (lecture seule) : ${pastShifts.map(shift => escapeHtml(formatShiftRange(shift))).join(" · ")}</p>` : ""}

      <button type="button" class="schedule-add-slot-button">+ Ajouter une plage</button>

      <p class="schedule-edit-message" hidden></p>

      <div class="schedule-edit-actions">
        <button type="button" class="schedule-edit-confirm" title="Enregistrer" aria-label="Enregistrer les modifications">✓</button>
        <button type="button" class="schedule-edit-cancel" title="Annuler" aria-label="Annuler les modifications">✕</button>
      </div>
    </div>
  `;

  const slotsContainer = card.querySelector(".schedule-edit-slots");
  const addButton = card.querySelector(".schedule-add-slot-button");
  const confirmButton = card.querySelector(".schedule-edit-confirm");
  const cancelButton = card.querySelector(".schedule-edit-cancel");
  const message = card.querySelector(".schedule-edit-message");

  addButton.addEventListener("click", () => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = createSlotEditorHtml(null, slotsContainer.children.length);
    slotsContainer.appendChild(wrapper.firstElementChild);
    message.hidden = true;
    confirmButton.dataset.overlapConfirmed = "";
  });

  card.querySelectorAll("select").forEach(select => {
    select.addEventListener("change", () => {
      message.hidden = true;
      confirmButton.dataset.overlapConfirmed = "";
    });
  });

  cancelButton.addEventListener("click", () => renderSchedule());

  confirmButton.addEventListener("click", async () => {
    if (editableShifts.some(isPastShift)) {
      message.textContent = "Une plage s'est terminée depuis l'ouverture de cette carte. Recharge la page avant de modifier les autres.";
      message.className = "schedule-edit-message schedule-edit-message-error";
      message.hidden = false;
      return;
    }
    const posteId = Number(card.querySelector(".schedule-edit-poste").value);
    const lieuValue = card.querySelector(".schedule-edit-lieu").value;
    const lieuId = lieuValue ? Number(lieuValue) : null;
    const slotElements = [...card.querySelectorAll(".schedule-edit-slot")];

    if (!posteId || !lieuId) {
      message.textContent = "Choisis un poste et un lieu avant d'enregistrer.";
      message.className = "schedule-edit-message schedule-edit-message-error";
      message.hidden = false;
      return;
    }

    const proposedSlots = slotElements.map(slot => {
      const startMinutes = Number(slot.querySelector(".schedule-edit-start").value);
      const endMinutes = Number(slot.querySelector(".schedule-edit-end").value);
      const { start, end } = proposedDates(dayKey, startMinutes, endMinutes);

      return {
        affectationId: slot.dataset.affectationId || null,
        start,
        end,
        startMinutes,
        endMinutes
      };
    });

    if (proposedSlots.some(slot => slot.end.getTime() <= Date.now())) {
      message.textContent = "Une plage terminée ne peut plus être enregistrée.";
      message.className = "schedule-edit-message schedule-edit-message-error";
      message.hidden = false;
      return;
    }

    const overlapWarning = findOverlapWarning(group, proposedSlots);

    if (overlapWarning && confirmButton.dataset.overlapConfirmed !== "yes") {
      message.textContent = overlapWarning;
      message.className = "schedule-edit-message schedule-edit-message-warning";
      message.hidden = false;
      confirmButton.dataset.overlapConfirmed = "yes";
      return;
    }

    confirmButton.disabled = true;
    cancelButton.disabled = true;
    addButton.disabled = true;
    message.textContent = "Enregistrement…";
    message.className = "schedule-edit-message";
    message.hidden = false;

    try {
      for (const slot of proposedSlots) {
        if (slot.affectationId) {
          const { error } = await PortalAuth.client.rpc("admin_update_affectation_horaire", {
            p_affectation_id: slot.affectationId,
            p_poste_id: posteId,
            p_lieu_id: lieuId,
            p_debut: slot.start.toISOString(),
            p_fin: slot.end.toISOString()
          });

          if (error) throw error;
        } else {
          const { error } = await PortalAuth.client.rpc("admin_add_affectation_horaire", {
            p_source_affectation_id: firstShift.affectation_id,
            p_poste_id: posteId,
            p_lieu_id: lieuId,
            p_debut: slot.start.toISOString(),
            p_fin: slot.end.toISOString()
          });

          if (error) throw error;
        }
      }

      const { error: mergeError } = await PortalAuth.client.rpc("admin_merge_consecutive_affectations", {
        p_personne_id: currentVolunteerId
      });
      if (mergeError) throw mergeError;

      await loadSchedule(currentVolunteerId);
    } catch (error) {
      console.error("Impossible de modifier les horaires :", error);
      message.textContent = "La modification n'a pas pu être enregistrée.";
      message.className = "schedule-edit-message schedule-edit-message-error";
      message.hidden = false;
      confirmButton.disabled = false;
      cancelButton.disabled = false;
      addButton.disabled = false;
    }
  });
}

function renderSchedule() {
  const loadingElement = document.getElementById("schedule-loading");
  const emptyElement = document.getElementById("schedule-empty");
  const errorElement = document.getElementById("schedule-error");
  const scheduleList = document.getElementById("schedule-list");

  loadingElement.hidden = true;
  errorElement.hidden = true;
  scheduleList.innerHTML = "";

  if (!currentShifts.length) {
    emptyElement.hidden = false;
    return;
  }

  emptyElement.hidden = true;
  const grouped = groupByDay(currentShifts);

  grouped.forEach((dayShifts, dayKey) => {
    const daySection = document.createElement("section");
    daySection.className = "schedule-day";

    const heading = document.createElement("h2");
    heading.className = "schedule-day-title";
    heading.textContent = formatDayTitle(dayShifts[0].debut);
    daySection.appendChild(heading);

    const cards = document.createElement("div");
    cards.className = "schedule-day-cards";

    groupDayShiftsByPost(dayShifts).forEach(group => {
      cards.appendChild(createShiftCard(group, dayKey));
    });

    daySection.appendChild(cards);
    scheduleList.appendChild(daySection);
  });
}

async function loadEditOptions() {
  const { data, error } = await PortalAuth.client.rpc("admin_get_schedule_edit_options");

  if (error) {
    console.error("Impossible de charger les postes et lieux :", error);
    throw error;
  }

  editOptions = {
    postes: Array.isArray(data?.postes) ? data.postes : [],
    lieux: Array.isArray(data?.lieux) ? data.lieux : []
  };
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

  if (error) {
    console.error("Erreur horaires admin :", error);
    loadingElement.hidden = true;
    errorElement.hidden = false;
    return;
  }

  currentShifts = Array.isArray(shifts) ? shifts : [];
  renderBulkPresenceControl();
  renderSchedule();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

  currentVolunteerId = volunteerId;

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

  setupBulkPresenceControl();

  try {
    await loadEditOptions();
    await loadSchedule(volunteerId);
  } catch (error) {
    document.getElementById("schedule-loading").hidden = true;
    document.getElementById("schedule-error").hidden = false;
  }
}

initPage();
