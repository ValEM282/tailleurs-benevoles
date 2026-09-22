/* Libellés d'affichage des statuts — la valeur interne Supabase reste "inconnu". */
(function () {
  const replaceLabel = value =>
    typeof value === "string" ? value.replaceAll("Inconnu", "Indisponible") : value;

  function updateNode(node) {
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const next = replaceLabel(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    ["title", "aria-label"].forEach(attribute => {
      if (!node.hasAttribute(attribute)) return;
      const current = node.getAttribute(attribute);
      const next = replaceLabel(current);
      if (next !== current) node.setAttribute(attribute, next);
    });

    node.childNodes.forEach(updateNode);
  }

  updateNode(document.body);

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === "characterData") {
        updateNode(mutation.target);
        return;
      }

      mutation.addedNodes.forEach(updateNode);

      if (mutation.type === "attributes") {
        updateNode(mutation.target);
      }
    });
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["title", "aria-label"]
  });
})();
