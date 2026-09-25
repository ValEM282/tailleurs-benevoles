(() => {
  const originalRenderFilterOptions = renderFilterOptions;

  function prependAllOption(container, selectedIds, labelText) {
    const label = document.createElement("label");
    label.className = "multi-option multi-option-all";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = "";
    input.dataset.allOption = "true";
    input.checked = selectedIds.size === 0;

    input.addEventListener("change", () => {
      if (!input.checked) {
        input.checked = selectedIds.size === 0;
        return;
      }

      selectedIds.clear();
      renderFilterOptions();
      loadNow();
    });

    const span = document.createElement("span");
    span.textContent = labelText;
    label.append(input, span);
    container.prepend(label);
  }

  function syncAllOption(container, selectedIds) {
    const input = container.querySelector('input[data-all-option="true"]');
    if (input) input.checked = selectedIds.size === 0;
  }

  renderFilterOptions = function () {
    originalRenderFilterOptions();
    prependAllOption(postOptions, selectedPostIds, "Tous les postes");
    prependAllOption(placeOptions, selectedPlaceIds, "Tous les lieux");
  };

  postOptions.addEventListener("change", event => {
    if (event.target?.dataset?.allOption !== "true") {
      syncAllOption(postOptions, selectedPostIds);
    }
  });

  placeOptions.addEventListener("change", event => {
    if (event.target?.dataset?.allOption !== "true") {
      syncAllOption(placeOptions, selectedPlaceIds);
    }
  });
})();