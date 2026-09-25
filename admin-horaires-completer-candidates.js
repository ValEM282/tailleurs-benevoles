/* Liste des bénévoles — NOM Prénom, tri alphabétique global par NOM. */
(() => {
  if (!window.PortalAuth?.client?.rpc) return;

  const candidateNames = new Map();
  const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });
  const originalRpc = PortalAuth.client.rpc.bind(PortalAuth.client);

  PortalAuth.client.rpc = async function (functionName, args) {
    const result = await originalRpc(functionName, args);

    if (functionName === "admin_get_need_candidates" && Array.isArray(result?.data)) {
      result.data.forEach(row => {
        candidateNames.set(String(row.personne_id), {
          nom: String(row.nom || "").trim().toUpperCase(),
          prenom: String(row.prenom || "").trim()
        });
      });
    }

    return result;
  };

  function candidateCompare(a, b) {
    const nameA = candidateNames.get(String(a.value)) || { nom: "", prenom: "" };
    const nameB = candidateNames.get(String(b.value)) || { nom: "", prenom: "" };
    return collator.compare(nameA.nom, nameB.nom)
      || collator.compare(nameA.prenom, nameB.prenom);
  }

  function normalizeCandidateSelect(select) {
    if (!(select instanceof HTMLSelectElement) || !select.classList.contains("open-candidate-select")) return;
    if (!select.dataset.loadedFor) return;

    const candidateOptions = Array.from(select.querySelectorAll("optgroup option, option"))
      .filter(option => option.value && candidateNames.has(String(option.value)));

    if (!candidateOptions.length) return;

    candidateOptions.forEach(option => {
      const person = candidateNames.get(String(option.value));
      option.textContent = `${person.nom} ${person.prenom}`.trim();
    });

    candidateOptions.sort(candidateCompare);

    const placeholder = Array.from(select.children)
      .find(child => child.tagName === "OPTION" && !child.value);

    select.innerHTML = "";
    if (placeholder) select.appendChild(placeholder);
    candidateOptions.forEach(option => select.appendChild(option));
  }

  const observer = new MutationObserver(mutations => {
    const selects = new Set();

    mutations.forEach(mutation => {
      const targetSelect = mutation.target instanceof Element
        ? mutation.target.closest("select.open-candidate-select")
        : null;
      if (targetSelect) selects.add(targetSelect);

      mutation.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.matches?.("select.open-candidate-select")) selects.add(node);
        node.querySelectorAll?.("select.open-candidate-select").forEach(select => selects.add(select));
      });
    });

    selects.forEach(normalizeCandidateSelect);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
