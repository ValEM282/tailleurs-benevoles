/* =========================================================
   ADMINISTRATION — AJOUT D'UN NOUVEL HORAIRE BÉNÉVOLE
   ========================================================= */

(() => {
  const addButton = document.getElementById("schedule-add-button");
  const addPanel = document.getElementById("schedule-add-panel");
  if (!addButton || !addPanel) return;

  const params = new URLSearchParams(window.location.search);
  const volunteerId = params.get("id");

  const festivalDays = [
    ["2026-10-01", "Jeudi 1 octobre"],
    ["2026-10-02", "Vendredi 2 octobre"],
    ["2026-10-03", "Samedi 3 octobre"],
    ["2026-10-04", "Dimanche 4 octobre"],
    ["2026-10-05", "Lundi 5 octobre"]
  ];

  let options = { postes: [], lieux: [], poste_lieux: [] };
  let optionsLoaded = false;
  let overlapConfirmed = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatClock(minutes) {
    const normalized = ((Number(minutes) % 1440) + 1440) % 1440;
    const hour = Math.floor(normalized / 60);
    const minute = normalized % 60;
    return minute ? `${hour}h${String(minute).padStart(2, "0")}` : `${hour}h`;
  }

  function buildTimeOptions() {
    const values = [];
    for (let minutes = 7 * 60; minutes < 24 * 60; minutes += 15) values.push(minutes);
    for (let minutes = 0; minutes <= 3 * 60; minutes += 15) values.push(minutes);

    return [
      '<option value="">Choisir une heure</option>',
      ...values.map(minutes => `<option value="${minutes}">${formatClock(minutes)}</option>`)
    ].join("");
  }

  function makeDates(dayKey, startMinutes, endMinutes) {
    const startHour = String(Math.floor(startMinutes / 60)).padStart(2, "0");
    const startMinute = String(startMinutes % 60).padStart(2, "0");
    const endHour = String(Math.floor(endMinutes / 60)).padStart(2, "0");
    const endMinute = String(endMinutes % 60).padStart(2, "0");

    const start = new Date(`${dayKey}T${startHour}:${startMinute}:00+02:00`);

    let endDay = dayKey;
    if (endMinutes <= startMinutes) {
      const d = new Date(`${dayKey}T12:00:00+02:00`);
      d.setUTCDate(d.getUTCDate() + 1);
      endDay = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    }

    const end = new Date(`${endDay}T${endHour}:${endMinute}:00+02:00`);
    return { start, end };
  }

  function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }

  async function ensureOptions() {
    if (optionsLoaded) return true;

    const { data, error } = await PortalAuth.client.rpc("admin_get_schedule_edit_options");
    if (error) {
      console.error("Impossible de charger les options d'horaire :", error);
      addPanel.innerHTML = '<p class="schedule-edit-message schedule-edit-message-error">Impossible de charger les postes et lieux.</p>';
      return false;
    }

    options = {
      postes: Array.isArray(data?.postes) ? data.postes : [],
      lieux: Array.isArray(data?.lieux) ? data.lieux : [],
      poste_lieux: Array.isArray(data?.poste_lieux) ? data.poste_lieux : []
    };
    optionsLoaded = true;
    return true;
  }

  function postOptions() {
    return [
      '<option value="">Choisir un poste</option>',
      ...options.postes.map(poste => `<option value="${escapeHtml(poste.id)}">${escapeHtml(poste.nom)}</option>`)
    ].join("");
  }

  function locationOptionsFor(posteId) {
    if (!posteId) return '<option value="">Choisir un lieu</option>';

    const linkedIds = options.poste_lieux
      .filter(link => String(link.poste_id) === String(posteId))
      .map(link => String(link.lieu_id));

    const available = linkedIds.length
      ? options.lieux.filter(lieu => linkedIds.includes(String(lieu.id)))
      : options.lieux;

    return [
      '<option value="">Choisir un lieu</option>',
      ...available.map(lieu => `<option value="${escapeHtml(lieu.id)}">${escapeHtml(lieu.nom)}</option>`)
    ].join("");
  }

  function dateOptions() {
    return [
      '<option value="">Choisir une date</option>',
      ...festivalDays.map(([value, label]) => `<option value="${value}">${label}</option>`)
    ].join("");
  }

  function slotMarkup(index) {
    return `
      <div class="schedule-edit-slot" data-add-slot>
        <div class="schedule-edit-slot-header">
          <span class="schedule-edit-slot-label">Plage ${index}</span>
          ${index > 1 ? '<button type="button" class="schedule-remove-slot-button" data-remove-add-slot aria-label="Supprimer cette plage">×</button>' : ''}
        </div>
        <label>
          <span>Début</span>
          <select data-add-start required>${buildTimeOptions()}</select>
        </label>
        <label>
          <span>Fin</span>
          <select data-add-end required>${buildTimeOptions()}</select>
        </label>
      </div>
    `;
  }

  function resetOverlapConfirmation() {
    overlapConfirmed = false;
    const message = addPanel.querySelector("[data-add-message]");
    if (message) {
      message.hidden = true;
      message.className = "schedule-edit-message";
      message.textContent = "";
    }
  }

  function renumberSlots() {
    addPanel.querySelectorAll("[data-add-slot]").forEach((slot, index) => {
      const label = slot.querySelector(".schedule-edit-slot-label");
      if (label) label.textContent = `Plage ${index + 1}`;
    });
  }

  function renderForm() {
    addPanel.innerHTML = `
      <form class="schedule-edit-form" id="schedule-add-form">
        <div class="schedule-edit-field">
          <label for="schedule-add-date">Date</label>
          <select id="schedule-add-date" required>${dateOptions()}</select>
        </div>

        <div class="schedule-edit-field">
          <label for="schedule-add-post">Poste</label>
          <select id="schedule-add-post" required>${postOptions()}</select>
        </div>

        <div class="schedule-edit-field">
          <label for="schedule-add-location">Lieu</label>
          <select id="schedule-add-location">${locationOptionsFor("")}</select>
        </div>

        <div class="schedule-edit-slots" data-add-slots>
          ${slotMarkup(1)}
        </div>

        <button type="button" class="schedule-add-slot-button" data-add-another-slot>+ Ajouter une plage</button>

        <p class="schedule-edit-message" data-add-message hidden></p>

        <div class="schedule-edit-actions">
          <button type="submit" class="schedule-edit-confirm" aria-label="Valider l'ajout">✓</button>
          <button type="button" class="schedule-edit-cancel" data-cancel-add aria-label="Annuler">×</button>
        </div>
      </form>
    `;
  }

  function getProposedSlots() {
    const day = addPanel.querySelector("#schedule-add-date")?.value || "";
    if (!day) return { error: "Choisis une date." };

    const slots = [];
    for (const slot of addPanel.querySelectorAll("[data-add-slot]")) {
      const startValue = slot.querySelector("[data-add-start]")?.value || "";
      const endValue = slot.querySelector("[data-add-end]")?.value || "";

      if (startValue === "" || endValue === "") {
        return { error: "Choisis une heure de début et de fin pour chaque plage." };
      }

      const startMinutes = Number(startValue);
      const endMinutes = Number(endValue);
      const dates = makeDates(day, startMinutes, endMinutes);
      slots.push({
        startMinutes,
        endMinutes,
        start: dates.start,
        end: dates.end
      });
    }

    return { day, slots };
  }

  function overlapWarning(proposedSlots) {
    for (let i = 0; i < proposedSlots.length; i += 1) {
      for (let j = i + 1; j < proposedSlots.length; j += 1) {
        if (overlaps(proposedSlots[i].start, proposedSlots[i].end, proposedSlots[j].start, proposedSlots[j].end)) {
          return "Deux plages de ce nouvel horaire se chevauchent. Clique à nouveau sur ✓ si tu souhaites malgré tout enregistrer.";
        }
      }
    }

    const existing = Array.isArray(window.currentShifts)
      ? window.currentShifts
      : (typeof currentShifts !== "undefined" && Array.isArray(currentShifts) ? currentShifts : []);

    for (const slot of proposedSlots) {
      for (const other of existing) {
        if (!other?.debut || !other?.fin) continue;
        if (overlaps(slot.start, slot.end, new Date(other.debut), new Date(other.fin))) {
          return `Cette plage chevauche une autre prestation (${other.poste || "poste"}, ${typeof formatShiftRange === "function" ? formatShiftRange(other) : "horaire existant"}). Clique à nouveau sur ✓ si tu souhaites malgré tout enregistrer.`;
        }
      }
    }

    return "";
  }

  function setMessage(text, type = "") {
    const message = addPanel.querySelector("[data-add-message]");
    if (!message) return;
    message.textContent = text;
    message.className = `schedule-edit-message${type ? ` schedule-edit-message-${type}` : ""}`;
    message.hidden = !text;
  }

  function closeForm() {
    addPanel.hidden = true;
    addButton.setAttribute("aria-expanded", "false");
    addPanel.innerHTML = "";
    overlapConfirmed = false;
  }

  addButton.addEventListener("click", async () => {
    if (!addPanel.hidden) {
      closeForm();
      return;
    }

    addButton.disabled = true;
    const ready = await ensureOptions();
    addButton.disabled = false;
    if (!ready) {
      addPanel.hidden = false;
      addButton.setAttribute("aria-expanded", "true");
      return;
    }

    renderForm();
    addPanel.hidden = false;
    addButton.setAttribute("aria-expanded", "true");
    addPanel.querySelector("#schedule-add-date")?.focus();
  });

  addPanel.addEventListener("change", event => {
    resetOverlapConfirmation();

    if (event.target?.id === "schedule-add-post") {
      const location = addPanel.querySelector("#schedule-add-location");
      if (location) location.innerHTML = locationOptionsFor(event.target.value);
    }
  });

  addPanel.addEventListener("click", event => {
    const addSlot = event.target.closest("[data-add-another-slot]");
    if (addSlot) {
      const slots = addPanel.querySelector("[data-add-slots]");
      const count = slots?.querySelectorAll("[data-add-slot]").length || 0;
      slots?.insertAdjacentHTML("beforeend", slotMarkup(count + 1));
      resetOverlapConfirmation();
      return;
    }

    const remove = event.target.closest("[data-remove-add-slot]");
    if (remove) {
      remove.closest("[data-add-slot]")?.remove();
      renumberSlots();
      resetOverlapConfirmation();
      return;
    }

    if (event.target.closest("[data-cancel-add]")) {
      closeForm();
    }
  });

  addPanel.addEventListener("submit", async event => {
    if (event.target?.id !== "schedule-add-form") return;
    event.preventDefault();

    if (!volunteerId) {
      setMessage("Bénévole introuvable.", "error");
      return;
    }

    const posteId = addPanel.querySelector("#schedule-add-post")?.value || "";
    const lieuId = addPanel.querySelector("#schedule-add-location")?.value || "";

    if (!posteId) {
      setMessage("Choisis un poste.", "error");
      return;
    }

    const proposed = getProposedSlots();
    if (proposed.error) {
      setMessage(proposed.error, "error");
      return;
    }

    const warning = overlapWarning(proposed.slots);
    if (warning && !overlapConfirmed) {
      overlapConfirmed = true;
      setMessage(warning, "warning");
      return;
    }

    const submit = addPanel.querySelector(".schedule-edit-confirm");
    const cancel = addPanel.querySelector(".schedule-edit-cancel");
    if (submit) submit.disabled = true;
    if (cancel) cancel.disabled = true;
    setMessage("Enregistrement…");

    const slotsPayload = proposed.slots.map(slot => ({
      debut: slot.start.toISOString(),
      fin: slot.end.toISOString()
    }));

    const { error } = await PortalAuth.client.rpc("admin_create_benevole_schedule_slots", {
      p_benevole_id: volunteerId,
      p_poste_id: Number(posteId),
      p_lieu_id: lieuId ? Number(lieuId) : null,
      p_slots: slotsPayload
    });

    if (!error) {
      const { error: mergeError } = await PortalAuth.client.rpc("admin_merge_consecutive_affectations", {
        p_personne_id: volunteerId
      });
      if (mergeError) console.error("Impossible de fusionner les plages consécutives :", mergeError);
    }

    if (error) {
      console.error("Impossible d'ajouter l'horaire :", error);
      if (submit) submit.disabled = false;
      if (cancel) cancel.disabled = false;
      setMessage(error.message || "L'horaire n'a pas pu être ajouté.", "error");
      return;
    }

    setMessage("Horaire ajouté.");
    window.setTimeout(() => window.location.reload(), 250);
  });
})();
