/* Planning complet — menu Lieu indépendant du poste sélectionné. */
(() => {
  renderPlaces = function () {
    const rows = rowsForSelectedDay();
    const previous = placeFilter.value;

    const places = uniqueBy(
      rows.filter(row => row.lieu_id !== null && row.lieu_id !== undefined),
      row => String(row.lieu_id)
    ).sort((a, b) =>
      alphaCollator.compare(a.lieu_nom || "", b.lieu_nom || "")
    );

    const hasUndefinedPlace = rows.some(row => row.lieu_id === null || row.lieu_id === undefined);

    placeFilter.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "Tous les lieux";
    placeFilter.appendChild(allOption);

    places.forEach(place => {
      const option = document.createElement("option");
      option.value = String(place.lieu_id);
      option.textContent = place.lieu_nom || "Lieu à confirmer";
      placeFilter.appendChild(option);
    });

    if (hasUndefinedPlace) {
      const option = document.createElement("option");
      option.value = "none";
      option.textContent = "Lieu à confirmer";
      placeFilter.appendChild(option);
    }

    const allowedValues = [...placeFilter.options].map(option => option.value);
    placeFilter.value = allowedValues.includes(previous) ? previous : "all";
  };

  // Corrige aussi l'affichage initial si le script principal a déjà terminé son rendu.
  if (dayFilter?.value) {
    renderPlaces();
    loadComplete();
  }
})();
