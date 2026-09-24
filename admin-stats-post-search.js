/* Recherche locale — bénévoles par poste */
(() => {
  const results = document.getElementById("post-stats-results");
  const body = document.getElementById("post-stats-body");
  const postInput = document.getElementById("post-stats-post-search");
  const subpostInput = document.getElementById("post-stats-subpost-search");
  const searchButton = document.getElementById("post-stats-search-button");
  const daySelect = document.getElementById("stats-day");

  if (!results || !body || !postInput || !subpostInput || !searchButton) return;

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("fr")
      .trim();
  }

  function removeEmptyRow() {
    body.querySelector(".post-search-empty")?.remove();
  }

  function applySearch() {
    removeEmptyRow();

    const postFilter = normalize(postInput.value);
    const subpostFilter = normalize(subpostInput.value);
    const rows = [...body.querySelectorAll("tr")];
    let visibleCount = 0;

    rows.forEach(row => {
      const cells = row.querySelectorAll("td");
      if (cells.length < 2) return;

      const postText = normalize(cells[0].textContent);
      const subpostText = normalize(cells[1].textContent);
      const matchesPost = !postFilter || postText.includes(postFilter);
      const matchesSubpost = !subpostFilter || subpostText.includes(subpostFilter);
      const visible = matchesPost && matchesSubpost;

      row.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    if (!visibleCount) {
      const emptyRow = document.createElement("tr");
      emptyRow.className = "post-search-empty";
      emptyRow.innerHTML = '<td colspan="3" class="stats-empty-row">Aucun résultat ne correspond à la recherche.</td>';
      body.appendChild(emptyRow);
    }

    results.hidden = false;
  }

  function resetSearchView() {
    postInput.value = "";
    subpostInput.value = "";
    results.hidden = true;
    removeEmptyRow();
  }

  searchButton.addEventListener("click", applySearch);

  [postInput, subpostInput].forEach(input => {
    input.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      applySearch();
    });
  });

  if (daySelect) {
    daySelect.addEventListener("change", resetSearchView);
  }

  results.hidden = true;
})();
