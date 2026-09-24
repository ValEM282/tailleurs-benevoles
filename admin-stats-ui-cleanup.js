/* Ajustements visuels de la page STATS */
(() => {
  const mealGrid = document.getElementById("meal-grid");
  if (!mealGrid) return;

  function simplifyMealDays() {
    mealGrid.querySelectorAll(".meal-card-date").forEach(element => {
      const text = (element.textContent || "").trim();
      if (!text) return;
      element.textContent = text.split(/\s+/)[0];
    });
  }

  const observer = new MutationObserver(simplifyMealDays);
  observer.observe(mealGrid, { childList: true, subtree: true });
  simplifyMealDays();
})();
