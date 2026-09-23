/* Administration — navigation Lieux */

(() => {
  const listButton = document.getElementById("admin-place-list");
  const searchButton = document.getElementById("admin-place-search");
  const searchInput = document.getElementById("place-search-name");

  if (!listButton || !searchButton || !searchInput) return;

  function openSearch() {
    const lieu = searchInput.value.trim();
    const params = new URLSearchParams();
    if (lieu) params.set("lieu", lieu);
    const query = params.toString();
    window.location.href = query ? `lieux-liste.html?${query}` : "lieux-liste.html";
  }

  listButton.addEventListener("click", () => {
    window.location.href = "lieux-liste.html";
  });

  searchButton.addEventListener("click", openSearch);

  searchInput.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    openSearch();
  });
})();
