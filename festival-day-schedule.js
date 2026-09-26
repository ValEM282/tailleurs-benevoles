/* Journée festival : de 04h00 à 03h59 le lendemain.
   Toute prestation entre 00h00 et 03h59 reste rattachée au jour précédent. */
(() => {
  const FESTIVAL_CUTOFF_HOURS = 4;
  const CUTOFF_MS = FESTIVAL_CUTOFF_HOURS * 60 * 60 * 1000;

  function festivalDate(value) {
    return new Date(new Date(value).getTime() - CUTOFF_MS);
  }

  function festivalDayKey(value) {
    return new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Europe/Brussels",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(festivalDate(value));
  }

  function festivalDayTitle(value) {
    const label = new Intl.DateTimeFormat("fr-BE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Brussels"
    }).format(festivalDate(value));

    return label ? label.charAt(0).toUpperCase() + label.slice(1) : label;
  }

  function groupByFestivalDay(shifts) {
    const grouped = new Map();

    [...(shifts || [])]
      .sort((a, b) => new Date(a.debut) - new Date(b.debut))
      .forEach(shift => {
        const key = festivalDayKey(shift.debut);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(shift);
      });

    return grouped;
  }

  /* Fonctions communes, réutilisables par les différents écrans. */
  window.portalFestivalDayKey = festivalDayKey;
  window.portalFestivalDayTitle = festivalDayTitle;

  /* Pages Mes horaires / Horaire admin. */
  window.groupByDay = groupByFestivalDay;
  window.formatDayTitle = festivalDayTitle;
  if (typeof window.dayKeyFor === "function") {
    window.dayKeyFor = festivalDayKey;
  }

  /* Dashboard : la date affichée du prochain poste suit aussi la journée festival. */
  if (typeof window.formatShiftDate === "function") {
    window.formatShiftDate = festivalDayTitle;
  }

  /* Sur la fiche admin, le dayKey représente la journée festival.
     Une heure entre 00h00 et 03h59 est donc enregistrée le lendemain civil. */
  if (typeof window.proposedDates === "function") {
    window.proposedDates = function (dayKey, startMinutes, endMinutes) {
      const startNextDay = Number(startMinutes) < FESTIVAL_CUTOFF_HOURS * 60;
      let endNextDay = Number(endMinutes) < FESTIVAL_CUTOFF_HOURS * 60;

      if (!startNextDay && Number(endMinutes) <= Number(startMinutes)) {
        endNextDay = true;
      }

      const start = makeLocalDate(dayKey, Number(startMinutes), startNextDay);
      const end = makeLocalDate(dayKey, Number(endMinutes), endNextDay);
      return { start, end };
    };
  }

  /* Sécurité : si un premier rendu a eu lieu avant ce fichier, on le recalcule. */
  window.addEventListener("load", () => {
    if (document.getElementById("schedule-add-button") && typeof window.renderSchedule === "function") {
      window.renderSchedule();
      return;
    }

    if (document.getElementById("schedule-list") && typeof window.loadSchedule === "function") {
      window.loadSchedule();
      return;
    }

    if (document.getElementById("next-shift-content") && typeof window.loadNextShift === "function") {
      window.loadNextShift();
    }
  }, { once: true });
})();
