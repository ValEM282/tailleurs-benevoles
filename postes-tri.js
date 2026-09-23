/* Tri de la liste des postes par nom du poste */

(() => {
  const tableBody = document.getElementById("postes-table-body");
  const sortButton = document.getElementById("postes-sort-name");
  const sortIndicator = document.getElementById("postes-sort-indicator");

  if (!tableBody || !sortButton) return;

  let direction = "asc";

  function rowText(row, columnIndex) {
    const cell = row.cells[columnIndex];
    const value = cell?.querySelector(".post-cell-value")?.textContent || cell?.textContent || "";
    return value.trim();
  }

  function compareText(a, b) {
    return a.localeCompare(b, "fr", {
      sensitivity: "base",
      ignorePunctuation: true
    });
  }

  function sortableRows() {
    return [...tableBody.querySelectorAll("tr")].filter(row => row.dataset.parentId);
  }

  function sortRows() {
    const rows = sortableRows();
    if (rows.length < 2) {
      if (sortIndicator) sortIndicator.textContent = direction === "asc" ? "↑" : "↓";
      return;
    }

    const sorted = [...rows].sort((a, b) => {
      let result = compareText(rowText(a, 0), rowText(b, 0));
      if (result === 0) result = compareText(rowText(a, 1), rowText(b, 1));
      return direction === "asc" ? result : -result;
    });

    if (sortIndicator) sortIndicator.textContent = direction === "asc" ? "↑" : "↓";

    const alreadySorted = rows.every((row, index) => row === sorted[index]);
    if (alreadySorted) return;

    const fragment = document.createDocumentFragment();
    sorted.forEach(row => fragment.appendChild(row));
    tableBody.appendChild(fragment);
  }

  sortButton.addEventListener("click", () => {
    direction = direction === "asc" ? "desc" : "asc";
    sortRows();
  });

  const observer = new MutationObserver(() => sortRows());
  observer.observe(tableBody, { childList: true });

  sortRows();
})();
