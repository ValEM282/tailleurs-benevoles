/* Actions de contact depuis un numéro de téléphone. */
(function () {
  const phoneSelector = [
    "a.volunteer-phone",
    "a.contact-phone:not(.emergency-phone)",
    "a.responsible-phone",
    "a.dispo-phone"
  ].join(", ");

  function normalizeTel(value) {
    return (value || "").replace(/[^+\d]/g, "");
  }

  function normalizeWhatsApp(value) {
    let digits = (value || "").replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = `32${digits.slice(1)}`;
    return digits;
  }

  function closeAll(except = null) {
    document.querySelectorAll(".phone-actions-menu").forEach(menu => {
      if (menu !== except) menu.hidden = true;
    });
    document.querySelectorAll(".phone-actions-trigger").forEach(trigger => {
      const ownMenu = trigger.parentElement?.querySelector(".phone-actions-menu");
      if (ownMenu !== except) trigger.setAttribute("aria-expanded", "false");
    });
  }

  function enhancePhone(link) {
    if (!link || link.dataset.phoneActionsReady === "true") return;
    link.dataset.phoneActionsReady = "true";

    const displayText = link.textContent.replace(/^\s*📞\s*/, "").trim();
    const rawNumber = link.getAttribute("href")?.replace(/^tel:/, "") || displayText;
    const telNumber = normalizeTel(rawNumber);
    const whatsappNumber = normalizeWhatsApp(rawNumber);

    const wrapper = document.createElement("span");
    wrapper.className = "phone-actions";

    const icon = document.createElement("span");
    icon.className = "phone-actions-icon";
    icon.textContent = "📞";
    icon.setAttribute("aria-hidden", "true");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = `${[...link.classList].join(" ")} phone-actions-trigger`.trim();
    trigger.textContent = displayText;
    trigger.setAttribute("aria-label", `Contacter ${displayText}`);
    trigger.setAttribute("aria-expanded", "false");

    const menu = document.createElement("span");
    menu.className = "phone-actions-menu";
    menu.hidden = true;

    const call = document.createElement("a");
    call.href = `tel:${telNumber}`;
    call.textContent = "Appeler";

    const sms = document.createElement("a");
    sms.href = `sms:${telNumber}`;
    sms.textContent = "SMS";

    const whatsapp = document.createElement("a");
    whatsapp.href = `https://wa.me/${whatsappNumber}`;
    whatsapp.target = "_blank";
    whatsapp.rel = "noopener";
    whatsapp.textContent = "WhatsApp";

    menu.append(call, sms, whatsapp);

    trigger.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = menu.hidden;
      closeAll(menu);
      menu.hidden = !willOpen;
      trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });

    menu.addEventListener("click", event => event.stopPropagation());

    link.replaceWith(wrapper);
    wrapper.append(icon, trigger, menu);
  }

  function scan(root = document) {
    root.querySelectorAll?.(phoneSelector).forEach(enhancePhone);
  }

  scan();

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.(phoneSelector)) enhancePhone(node);
        scan(node);
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener("click", () => closeAll());
})();
