/* Administration — navigation Postes */

(() => {
  const listButton = document.getElementById("admin-post-list");
  const searchButton = document.getElementById("admin-post-search");
  const searchInput = document.getElementById("post-search-name");

  if (!listButton || !searchButton || !searchInput) return;

  function openSearch() {
    const poste = searchInput.value.trim();
    const params = new URLSearchParams();
    if (poste) params.set("poste", poste);
    const query = params.toString();
    window.location.href = query ? `postes-liste.html?${query}` : "postes-liste.html";
  }

  listButton.addEventListener("click", () => {
    window.location.href = "postes-liste.html";
  });

  searchButton.addEventListener("click", openSearch);

  searchInput.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    openSearch();
  });
})();
