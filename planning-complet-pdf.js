(() => {
  const button = document.getElementById("print-planning-button");
  const result = document.getElementById("complete-result");
  if (!button || !result) return;

  function formatStamp() {
    const parts = new Intl.DateTimeFormat("fr-BE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Europe/Brussels"
    }).formatToParts(new Date());
    const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${v.day}-${v.month}-${v.year}  |  ${v.hour}:${v.minute}:${v.second}`;
  }

  function safeFilenamePart(value) {
    return (value || "planning")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  }

  function drawTitleCard(doc, block, y, pageWidth, margin) {
    const card = block.querySelector(".complete-title-card");
    const post = card?.querySelector(".complete-title-post")?.textContent?.trim() || "";
    const place = card?.querySelector(".complete-title-place")?.textContent?.trim() || "";
    const day = card?.querySelector(".complete-title-day")?.textContent?.trim() || "";
    const width = pageWidth - margin * 2;

    doc.setFillColor(244, 245, 252);
    doc.setDrawColor(215, 220, 242);
    doc.roundedRect(margin, y, width, 19, 4, 4, "FD");

    doc.setTextColor(28, 46, 171);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(post, margin + 4, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(place, margin + 4, y + 12);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(day, pageWidth - margin - 4, y + 12.5, { align: "right" });

    return y + 23;
  }

  function tableData(block) {
    const table = block.querySelector("table.complete-grid");
    if (!table) return null;

    const headerCells = [...table.querySelectorAll("thead th")];
    const times = headerCells.map(th =>
      th.querySelector(".complete-column-time")?.textContent?.trim() || ""
    );
    const counts = headerCells.map(th =>
      th.querySelector(".complete-column-count")?.textContent?.trim() || ""
    );

    const cells = [...table.querySelectorAll("tbody td")].map(td => {
      const names = [...td.querySelectorAll(".complete-volunteer-name")].map(el => el.textContent.trim());
      return names.length ? names.join("\n") : "—";
    });

    return { times, counts, cells };
  }

  async function createPdf(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const jsPDFCtor = window.jspdf?.jsPDF;
    if (!jsPDFCtor) {
      alert("Impossible de créer le PDF pour le moment.");
      return;
    }

    const blocks = [...result.querySelectorAll(".complete-result-block")];
    if (!blocks.length) {
      alert("Aucun planning à exporter pour cette sélection.");
      return;
    }

    const pdfWindow = window.open("", "_blank");
    if (!pdfWindow) {
      alert("Le navigateur a bloqué l'ouverture du PDF. Autorise les fenêtres pop-up pour ce site puis réessaie.");
      return;
    }

    pdfWindow.document.write('<!doctype html><html><head><title>Création du PDF…</title></head><body style="font-family:Arial,sans-serif;padding:30px;text-align:center">Création du PDF en cours…</body></html>');
    pdfWindow.document.close();

    try {
      const doc = new jsPDFCtor({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const stamp = formatStamp();

      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(stamp, pageWidth / 2, 9, { align: "center" });

      doc.setTextColor(28, 46, 171);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("PLANNING COMPLET", margin, 18);

      let y = 25;

      blocks.forEach((block, index) => {
        const data = tableData(block);
        if (!data) return;

        if (index > 0 && y > pageHeight - 58) {
          doc.addPage("a4", "landscape");
          doc.setTextColor(40, 40, 40);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.text(stamp, pageWidth / 2, 9, { align: "center" });
          y = 16;
        }

        y = drawTitleCard(doc, block, y, pageWidth, margin);

        doc.autoTable({
          startY: y,
          head: [data.times],
          body: [data.cells],
          margin: { left: margin, right: margin },
          theme: "grid",
          styles: {
            font: "helvetica",
            fontSize: 8.5,
            textColor: [20, 20, 20],
            halign: "center",
            valign: "middle",
            cellPadding: 3,
            lineColor: [215, 220, 242],
            lineWidth: 0.25,
            overflow: "linebreak"
          },
          headStyles: {
            fillColor: [244, 245, 252],
            textColor: [28, 46, 171],
            fontStyle: "bold",
            fontSize: 11.5,
            valign: "top",
            cellPadding: { top: 2.3, right: 3, bottom: 5.4, left: 3 },
            minCellHeight: 13.5
          },
          didDrawCell: hookData => {
            if (hookData.section !== "head") return;
            const count = data.counts[hookData.column.index];
            if (!count) return;

            doc.setTextColor(28, 46, 171);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.text(
              count,
              hookData.cell.x + hookData.cell.width / 2,
              hookData.cell.y + hookData.cell.height - 2.2,
              { align: "center" }
            );
          },
          didDrawPage: () => {
            doc.setTextColor(40, 40, 40);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.text(stamp, pageWidth / 2, 9, { align: "center" });
          }
        });

        y = doc.lastAutoTable.finalY + 10;
      });

      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      pdfWindow.location.replace(url);
      setTimeout(() => URL.revokeObjectURL(url), 180000);
    } catch (error) {
      console.error("PDF planning error", error);
      pdfWindow.close();
      alert("Impossible de créer le PDF pour le moment.");
    }
  }

  button.addEventListener("click", createPdf, true);
})();
