/* Journée festival : la nouvelle journée commence à 04:00 (Europe/Brussels). */
if (typeof currentOperationalBrusselsDate === "function") {
  currentOperationalBrusselsDate = function currentOperationalBrusselsDateAt4() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Brussels",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false
    }).formatToParts(new Date());

    const get = type => parts.find(part => part.type === type)?.value;
    const year = Number(get("year"));
    const month = Number(get("month"));
    const day = Number(get("day"));
    const hour = Number(get("hour"));

    const operationalDate = new Date(Date.UTC(year, month - 1, day, 12));
    if (hour < 4) operationalDate.setUTCDate(operationalDate.getUTCDate() - 1);

    const operationalParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(operationalDate);
    const value = type => operationalParts.find(part => part.type === type)?.value;
    return `${value("year")}-${value("month")}-${value("day")}`;
  };
}
