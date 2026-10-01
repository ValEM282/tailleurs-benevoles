/* =========================================================
   ADMINISTRATION — STATUT EN RETARD PAR PLAGE
   Ajoute les mêmes délais que dans la vue bénévole.
   ========================================================= */

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

  async function applyStatus(key, retardMinutes = null) {
    closeAdminPresenceMenus();

    if (isPastShift(shift)) {
      wrapper.replaceWith(createAdminPresenceControl(shift));
      return;
    }

    dot.disabled = true;
    menu.querySelectorAll("button").forEach(button => button.disabled = true);

    try {
      let error = null;

      if (key === "retard") {
        const response = await PortalAuth.client.rpc("set_managed_presence_delay", {
          p_affectation_id: shift.affectation_id,
          p_retard_minutes: retardMinutes
        });
        error = response.error;
      } else {
        const response = await PortalAuth.client.rpc("set_managed_presence_status", {
          p_affectation_id: shift.affectation_id,
          p_statut: key
        });
        error = response.error;
      }

      if (error) throw error;

      shift.statut = key === "inconnu"
        ? "a_venir"
        : (key === "disponible" ? "present" : key);
      shift.disponible = key === "disponible";
      shift.retard_minutes = key === "retard" ? retardMinutes : null;

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
  }

  const delayBlock = document.createElement("div");
  delayBlock.className = "schedule-delay-block";

  const delayHeader = document.createElement("button");
  delayHeader.type = "button";
  delayHeader.className = "schedule-delay-toggle";

  const delaySwatch = document.createElement("span");
  delaySwatch.className = "schedule-presence-swatch schedule-presence-retard";
  delaySwatch.setAttribute("aria-hidden", "true");

  const delayCaption = document.createElement("span");
  delayCaption.textContent = "En retard";

  const delayChevron = document.createElement("span");
  delayChevron.className = "schedule-delay-chevron";
  delayChevron.textContent = "▾";
  delayChevron.setAttribute("aria-hidden", "true");

  delayHeader.append(delaySwatch, delayCaption, delayChevron);

  const delayChoices = document.createElement("div");
  delayChoices.className = "schedule-delay-choices";
  delayChoices.hidden = true;

  [5, 10, 15, 20, 30, 45, 60].forEach(minutes => {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "schedule-delay-choice";
    choice.textContent = `${minutes} min`;
    choice.addEventListener("click", async event => {
      event.stopPropagation();
      await applyStatus("retard", minutes);
    });
    delayChoices.appendChild(choice);
  });

  delayHeader.addEventListener("click", event => {
    event.stopPropagation();
    delayChoices.hidden = !delayChoices.hidden;
    delayChevron.textContent = delayChoices.hidden ? "▾" : "▴";
  });

  delayBlock.append(delayHeader, delayChoices);
  menu.appendChild(delayBlock);

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
      await applyStatus(key, null);
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

(function addAdminDelayStyles() {
  if (document.getElementById("schedule-admin-delay-styles")) return;

  const style = document.createElement("style");
  style.id = "schedule-admin-delay-styles";
  style.textContent = `
    .schedule-delay-block {
      display: flex;
      flex-direction: column;
    }

    .schedule-delay-toggle {
      position: relative;
    }

    .schedule-delay-chevron {
      margin-left: auto;
      color: #6b7280;
      font-size: .8rem;
    }

    .schedule-delay-choices {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 5px;
      padding: 2px 6px 7px 27px;
    }

    .schedule-delay-choices[hidden] {
      display: none;
    }

    .schedule-presence-menu .schedule-delay-choice {
      display: block;
      width: 100%;
      padding: 5px 7px;
      border: 1px solid #e0e4ee;
      border-radius: 7px;
      background: #fff;
      color: #3f4760;
      font-size: .88rem;
      font-weight: 700;
      text-align: center;
    }

    .schedule-presence-menu .schedule-delay-choice:hover,
    .schedule-presence-menu .schedule-delay-choice:focus-visible {
      border-color: #FFA31A;
      background: #fff8eb;
    }
  `;

  document.head.appendChild(style);
})();
