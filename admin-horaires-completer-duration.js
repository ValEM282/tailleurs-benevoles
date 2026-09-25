/* Durée du créneau en gris dans la ligne rouge date + horaire. */
(() => {
  const list = document.getElementById("open-shifts-list");
  if (!list) return;

  function styleDurations() {
    list.querySelectorAll(".open-shift-meta > span:first-child").forEach(meta => {
      if (meta.querySelector(".open-shift-duration")) return;

      const nodes = Array.from(meta.childNodes);
      for (let index = nodes.length - 1; index >= 0; index -= 1) {
        const node = nodes[index];
        if (node.nodeType !== Node.TEXT_NODE) continue;

        const match = node.nodeValue.match(/(\s*)(\([^()]+\))\s*$/);
        if (!match) continue;

        node.nodeValue = node.nodeValue.slice(0, match.index);

        const duration = document.createElement("span");
        duration.className = "open-shift-duration";
        duration.textContent = ` ${match[2]}`;
        duration.style.color = "var(--text-light)";
        meta.appendChild(duration);
        break;
      }
    });
  }

  const observer = new MutationObserver(styleDurations);
  observer.observe(list, { childList: true, subtree: true });
  styleDurations();
})();
