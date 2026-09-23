/* =========================================================
   ADMINISTRATION — PLAGES D'HORAIRES
   Affichage du titre de plage + suppression des plages 2+
   ========================================================= */

(function () {
  if (typeof createSlotEditorHtml !== "function") return;

  const originalCreateSlotEditorHtml = createSlotEditorHtml;

  function deleteButtonHtml(index) {
    if (index === 0) return "";

    return `
      <button
        type="button"
        class="schedule-remove-slot-button"
        title="Supprimer la plage ${index + 1}"
        aria-label="Supprimer la plage ${index + 1}"
      >✕</button>
    `;
  }

  createSlotEditorHtml = function (shift = null, index = 0) {
    const html = originalCreateSlotEditorHtml(shift, index);
    const label = `<span class="schedule-edit-slot-label">Plage ${index + 1}</span>`;

    return html.replace(
      label,
      `<div class="schedule-edit-slot-header">${label}${deleteButtonHtml(index)}</div>`
    );
  };

  function renumberSlots(card) {
    const slots = [...card.querySelectorAll(".schedule-edit-slot")];

    slots.forEach((slot, index) => {
      const label = slot.querySelector(".schedule-edit-slot-label");
      if (label) label.textContent = `Plage ${index + 1}`;

      const header = slot.querySelector(".schedule-edit-slot-header");
      if (!header) return;

      let removeButton = header.querySelector(".schedule-remove-slot-button");

      if (index === 0) {
        removeButton?.remove();
        return;
      }

      if (!removeButton) {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = deleteButtonHtml(index).trim();
        removeButton = wrapper.firstElementChild;
        header.appendChild(removeButton);
      }

      removeButton.title = `Supprimer la plage ${index + 1}`;
      removeButton.setAttribute("aria-label", `Supprimer la plage ${index + 1}`);
    });
  }

  document.addEventListener("click", event => {
    const removeButton = event.target.closest(".schedule-remove-slot-button");
    if (!removeButton) return;

    event.preventDefault();
    event.stopPropagation();

    const slot = removeButton.closest(".schedule-edit-slot");
    const card = removeButton.closest(".schedule-shift-card");
    if (!slot || !card) return;

    const affectationId = slot.dataset.affectationId;

    if (affectationId) {
      if (!card._removedAffectationIds) {
        card._removedAffectationIds = new Set();
      }
      card._removedAffectationIds.add(affectationId);
    }

    slot.remove();
    renumberSlots(card);

    const message = card.querySelector(".schedule-edit-message");
    if (message) message.hidden = true;

    const confirmButton = card.querySelector(".schedule-edit-confirm");
    if (confirmButton) confirmButton.dataset.overlapConfirmed = "";
  });

  document.addEventListener("click", async event => {
    const confirmButton = event.target.closest(".schedule-edit-confirm");
    if (!confirmButton || confirmButton.dataset.slotDeletesProcessed === "yes") return;

    const card = confirmButton.closest(".schedule-shift-card");
    const removedIds = card?._removedAffectationIds
      ? [...card._removedAffectationIds]
      : [];

    if (!removedIds.length) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const cancelButton = card.querySelector(".schedule-edit-cancel");
    const addButton = card.querySelector(".schedule-add-slot-button");
    const message = card.querySelector(".schedule-edit-message");

    confirmButton.disabled = true;
    if (cancelButton) cancelButton.disabled = true;
    if (addButton) addButton.disabled = true;

    if (message) {
      message.textContent = "Enregistrement…";
      message.className = "schedule-edit-message";
      message.hidden = false;
    }

    try {
      for (const affectationId of removedIds) {
        const { error } = await PortalAuth.client.rpc("admin_delete_affectation_horaire", {
          p_affectation_id: affectationId
        });

        if (error) throw error;
      }

      confirmButton.dataset.slotDeletesProcessed = "yes";
      card._removedAffectationIds.clear();
      confirmButton.disabled = false;
      if (cancelButton) cancelButton.disabled = false;
      if (addButton) addButton.disabled = false;

      confirmButton.click();
    } catch (error) {
      console.error("Impossible de supprimer la plage :", error);

      if (message) {
        message.textContent = "La suppression de la plage n'a pas pu être enregistrée.";
        message.className = "schedule-edit-message schedule-edit-message-error";
        message.hidden = false;
      }

      confirmButton.disabled = false;
      if (cancelButton) cancelButton.disabled = false;
      if (addButton) addButton.disabled = false;
    }
  }, true);
})();
