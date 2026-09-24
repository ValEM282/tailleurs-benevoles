/* Ajustements visuels de la page STATS */
(() => {
  const mealGrid = document.getElementById("meal-grid");
  if (!mealGrid) return;

  function simplifyMealDays() {
    mealGrid.querySelectorAll(".meal-card-date").forEach(element => {
      const text = (element.textContent || "").trim();
      if (!text) return;

      const shortLabel = text.split(/\s+/)[0];
      if (text !== shortLabel) {
        element.textContent = shortLabel;
      }
    });
  }

  const observer = new MutationObserver(() => {
    simplifyMealDays();
  });

  observer.observe(mealGrid, { childList: true, subtree: true });
  simplifyMealDays();
})();
