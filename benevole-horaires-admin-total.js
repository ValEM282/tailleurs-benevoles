/* Total des heures prévues — même source que la page Statistiques. */
(function () {
  const numberFormatter = new Intl.NumberFormat("fr-BE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });

  function ensureTotalElement() {
    let element = document.getElementById("schedule-total-hours");
    if (element) return element;

    const bulkControl = document.querySelector(".schedule-bulk-control");
    if (!bulkControl) return null;

    element = document.createElement("span");
    element.id = "schedule-total-hours";
    element.className = "schedule-total-hours";
    element.hidden = true;
    bulkControl.insertAdjacentElement("afterend", element);
    return element;
  }

  function displayTotal(value) {
    const element = ensureTotalElement();
    if (!element) return;

    const numericValue = Number(value || 0);
    const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
    element.textContent = `· ${numberFormatter.format(safeValue)} h`;
    element.hidden = false;
  }

  async function refreshVolunteerTotalHours(volunteerId) {
    const element = ensureTotalElement();
    if (element) element.hidden = true;
    if (!volunteerId || !window.PortalAuth?.client) return;

    const { data, error } = await PortalAuth.client.rpc("admin_get_volunteer_hours", {
      p_day: null
    });

    if (error) {
      console.error("Impossible de charger le total d'heures du bénévole :", error);
      return;
    }

    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const volunteer = rows.find(row => String(row.id) === String(volunteerId));
    displayTotal(volunteer?.total ?? 0);
  }

  const params = new URLSearchParams(window.location.search);
  const volunteerId = params.get("id");

  const originalLoadSchedule = window.loadSchedule;
  if (typeof originalLoadSchedule === "function") {
    window.loadSchedule = async function (id) {
      const result = await originalLoadSchedule(id);
      await refreshVolunteerTotalHours(id);
      return result;
    };
  }

  refreshVolunteerTotalHours(volunteerId);
})();
