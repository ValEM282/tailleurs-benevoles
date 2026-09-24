/* PDF — heures prestées par bénévole */

(() => {
  const printButton = document.getElementById("volunteer-hours-print-button");
  const results = document.getElementById("volunteer-hours-results");
  const head = document.getElementById("volunteer-hours-head");
  const body = document.getElementById("volunteer-hours-body");
  const firstnameInput = document.getElementById("volunteer-hours-firstname");
  const lastnameInput = document.getElementById("volunteer-hours-lastname");

  if (!printButton || !results || !head || !body) return;

  function visibleRows() {
    return [...body.querySelectorAll("tr")].filter(row => !row.querySelector(".stats-empty-row"));
  }

  function syncPrintButton() {
    printButton.hidden = results.hidden || visibleRows().length === 0;
  }

  function cleanHeaderText(value) {
    return String(value || "")
      .replace(/[▲▼]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseHours(value) {
    const text = String(value || "").toLowerCase();
    const hoursMatch = text.match(/(\d+(?:[.,]\d+)?)\s*h/);
    const minutesMatch = text.match(/h\s*(\d{1,2})/);
    const hours = hoursMatch ? Number(hoursMatch[1].replace(",", ".")) : 0;
    const minutes = minutesMatch ? Number(minutesMatch[1]) : 0;
    return hours + minutes / 60;
  }

  function brusselsPrintDate() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("fr-BE", {
      timeZone: "Europe/Brussels",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(now);

    const get = type => parts.find(part => part.type === type)?.value || "";
    return {
      label: `${get("day")}/${get("month")}/${get("year")} à ${get("hour")}:${get("minute")}`,
      filename: `${get("year")}-${get("month")}-${get("day")}_${get("hour")}h${get("minute")}`
    };
  }

  function buildPdf() {
    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF || typeof jsPDF !== "function") {
      window.alert("La création du PDF n’est pas disponible pour le moment.");
      return;
    }

    const rows = visibleRows();
    if (results.hidden || !rows.length) return;

    const headers = [...head.querySelectorAll("th")].map(cell => cleanHeaderText(cell.textContent));
    const data = rows.map(row => [...row.cells].map(cell => cell.textContent.trim()));
    const printed = brusselsPrintDate();

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(28, 46, 171);
    doc.text("HEURES PRESTÉES PAR BÉNÉVOLE", 12, 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 100);
    doc.text(`Imprimé le ${printed.label}`, pageWidth - 12, 14, { align: "right" });

    const firstname = firstnameInput?.value.trim() || "";
    const lastname = lastnameInput?.value.trim() || "";
    if (firstname || lastname) {
      const criteria = [
        firstname ? `Prénom : ${firstname}` : "",
        lastname ? `NOM : ${lastname}` : ""
      ].filter(Boolean).join(" · ");
      doc.setFontSize(8.5);
      doc.text(criteria, 12, 20);
    }

    doc.autoTable({
      startY: firstname || lastname ? 24 : 20,
      head: [headers],
      body: data,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 2.2,
        lineColor: [207, 212, 232],
        lineWidth: 0.2,
        textColor: [20, 20, 24],
        valign: "middle"
      },
      headStyles: {
        fillColor: [28, 46, 171],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center"
      },
      columnStyles: {
        0: { halign: "left", cellWidth: 37 },
        1: { halign: "left", cellWidth: 42 },
        2: { halign: "center", cellWidth: 28, fillColor: [242, 244, 251], fontStyle: "bold" }
      },
      didParseCell: hook => {
        if (hook.section !== "body") return;
        if (hook.column.index !== 2) {
          if (hook.column.index >= 3) hook.cell.styles.halign = "center";
          return;
        }

        const total = parseHours(hook.cell.raw);
        hook.cell.styles.fontStyle = "bold";
        if (total > 8) {
          hook.cell.styles.textColor = [228, 2, 48];
        } else if (total >= 0 && total <= 7) {
          hook.cell.styles.textColor = [35, 122, 68];
        } else {
          hook.cell.styles.textColor = [28, 46, 171];
        }
      },
      didDrawPage: hook => {
        const pageNumber = doc.internal.getNumberOfPages();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(110, 110, 120);
        doc.text(`Page ${pageNumber}`, pageWidth - 12, doc.internal.pageSize.getHeight() - 7, { align: "right" });
      },
      margin: { left: 12, right: 12, bottom: 12 }
    });

    doc.save(`heures-prestees-benevoles_${printed.filename}.pdf`);
  }

  printButton.addEventListener("click", buildPdf);

  const observer = new MutationObserver(syncPrintButton);
  observer.observe(results, { attributes: true, attributeFilter: ["hidden"] });
  observer.observe(body, { childList: true, subtree: true });

  syncPrintButton();
})();
