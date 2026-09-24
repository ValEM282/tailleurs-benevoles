/* Horaires bénévole — les cartes passées restent informatives mais sans actions */
(() => {
  const scheduleList = document.getElementById("schedule-list");
  if (!scheduleList) return;

  function makeStaticLocation(link) {
    const text = link.textContent;
    const span = document.createElement("span");
    span.className = "schedule-shift-location-static";
    span.textContent = text;
    link.replaceWith(span);
  }

  function makeStaticPhone(number, replaceTarget) {
    const wrapper = document.createElement("span");
    wrapper.className = "schedule-past-phone";

    const icon = document.createElement("span");
    icon.className = "phone-actions-icon";
    icon.textContent = "📞";
    icon.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.className = "volunteer-phone schedule-past-phone-number";
    text.textContent = number;

    wrapper.append(icon, document.createTextNode(" "), text);
    replaceTarget.replaceWith(wrapper);
  }

  function neutralizePastCard(card) {
    card.querySelectorAll("a.schedule-shift-location-link").forEach(makeStaticLocation);

    card.querySelectorAll("a.volunteer-phone").forEach(link => {
      makeStaticPhone(link.textContent.trim(), link);
    });

    card.querySelectorAll(".phone-actions").forEach(wrapper => {
      const trigger = wrapper.querySelector(".phone-actions-trigger");
      const number = trigger?.textContent?.trim();
      if (!number) return;
      makeStaticPhone(number, wrapper);
    });
  }

  function neutralizePastCards() {
    scheduleList.querySelectorAll(".schedule-shift-card-past").forEach(neutralizePastCard);
  }

  let scheduled = false;
  const requestNeutralize = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      neutralizePastCards();
    });
  };

  const observer = new MutationObserver(requestNeutralize);
  observer.observe(scheduleList, { childList: true, subtree: true });

  requestNeutralize();
})();
