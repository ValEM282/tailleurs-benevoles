/* =========================================================
   ADMINISTRATION — ANNULATION D'ÉDITION D'UNE AFFECTATION
   Ferme uniquement la carte en cours, sans refermer les autres.
   ========================================================= */

(function () {
  if (typeof groupByDay !== "function" || typeof groupDayShiftsByPost !== "function" || typeof createShiftCard !== "function") {
    return;
  }

  function resolveGroupForCard(card) {
    const daySection = card.closest(".schedule-day");
    const cardsContainer = daySection?.querySelector(".schedule-day-cards");
    if (!daySection || !cardsContainer) return null;

    const daySections = [...document.querySelectorAll("#schedule-list .schedule-day")];
    const dayIndex = daySections.indexOf(daySection);
    if (dayIndex < 0) return null;

    const groupedDays = Array.from(groupByDay(currentShifts).entries());
    const dayEntry = groupedDays[dayIndex];
    if (!dayEntry) return null;

    const [dayKey, dayShifts] = dayEntry;
    const groups = groupDayShiftsByPost(dayShifts);

    const cardIndex = [...cardsContainer.children].indexOf(card);
    if (cardIndex < 0 || !groups[cardIndex]) return null;

    return {
      dayKey,
      group: groups[cardIndex]
    };
  }

  document.addEventListener("click", event => {
    const cancelButton = event.target.closest(".schedule-edit-cancel");
    if (!cancelButton) return;

    const card = cancelButton.closest(".schedule-shift-card");
    if (!card) return;

    const resolved = resolveGroupForCard(card);
    if (!resolved) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const replacementCard = createShiftCard(resolved.group, resolved.dayKey);
    card.replaceWith(replacementCard);
  }, true);
})();
