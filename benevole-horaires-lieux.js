/* =========================================================
   ADMINISTRATION — FILTRE DES LIEUX PAR POSTE
   ========================================================= */

let schedulePosteLieux = [];

async function loadPosteLieuxOptions() {
  const { data, error } = await PortalAuth.client.rpc("admin_get_schedule_edit_options");

  if (error) {
    console.error("Impossible de charger les liens poste/lieu :", error);
    return;
  }

  schedulePosteLieux = Array.isArray(data?.poste_lieux) ? data.poste_lieux : [];
}

function escapeOptionText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function linkedLocationsForPost(posteId) {
  const allowedIds = new Set(
    schedulePosteLieux
      .filter(link => String(link.poste_id) === String(posteId))
      .map(link => String(link.lieu_id))
  );

  return (editOptions?.lieux || []).filter(lieu => allowedIds.has(String(lieu.id)));
}

function filterLocationSelect(postSelect, keepCurrent = false) {
  if (!postSelect) return;
  const form = postSelect.closest(".schedule-edit-form");
  const lieuSelects = [...(form?.querySelectorAll(".schedule-edit-lieu") || [])];
  if (!lieuSelects.length) return;

  const posteId = postSelect.value;
  const linkedLocations = linkedLocationsForPost(posteId);

  lieuSelects.forEach(lieuSelect => {
    const previousValue = keepCurrent ? lieuSelect.value : "";
    const options = [`<option value="">${linkedLocations.length ? "Choisir un lieu" : "Aucun lieu lié à ce poste"}</option>`];
    linkedLocations.forEach(lieu => {
      const selected = String(lieu.id) === String(previousValue) ? " selected" : "";
      options.push(`<option value="${escapeOptionText(lieu.id)}"${selected}>${escapeOptionText(lieu.nom)}</option>`);
    });
    lieuSelect.innerHTML = options.join("");
    lieuSelect.disabled = linkedLocations.length === 0;
    if (!keepCurrent && linkedLocations.length === 1) lieuSelect.value = String(linkedLocations[0].id);
  });
}

// Quand on clique sur le crayon, le formulaire est créé par le script principal.
// On filtre ensuite immédiatement le menu Lieu sur le poste actuel.
document.addEventListener("click", event => {
  const editButton = event.target.closest(".schedule-edit-button");
  if (!editButton) return;

  setTimeout(() => {
    const card = editButton.closest(".schedule-shift-card");
    const postSelect = card?.querySelector(".schedule-edit-poste");
    filterLocationSelect(postSelect, true);
  }, 0);
});

// Si le poste change, seuls les lieux liés à ce nouveau poste restent proposés.
document.addEventListener("change", event => {
  const postSelect = event.target.closest(".schedule-edit-poste");
  if (!postSelect) return;

  filterLocationSelect(postSelect, false);
});

loadPosteLieuxOptions();
