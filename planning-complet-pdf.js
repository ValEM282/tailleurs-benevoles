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

    const cellPeople = [...table.querySelectorAll("tbody td")].map(td =>
      [...td.querySelectorAll(".complete-volunteer-name")].map(el => ({
        text: el.textContent.trim(),
        status: el.classList.contains("complete-volunteer-absent")
          ? "absent"
          : el.classList.contains("complete-volunteer-retard")
            ? "retard"
            : "normal"
      }))
    );

    const cells = cellPeople.map(people =>
      people.length ? people.map(person => person.text).join("\n") : "—"
    );

    return { times, counts, cells, cellPeople };
  }

  function splitTableDataForReadability(doc, data, pageWidth, margin) {
    const columnCount = data.times.length;
    if (columnCount < 2) return [data];

    const availableWidth = pageWidth - margin * 2;
    const columnWidth = availableWidth / columnCount;
    const horizontalPadding = 6; // 3 mm de chaque côté, comme dans autoTable
    const usableTextWidth = Math.max(1, columnWidth - horizontalPadding);

    // On ne coupe que si au moins un nom ne peut pas tenir sur une seule ligne
    // dans la largeur qu'aurait sa colonne sur le PDF.
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const hasWrappedName = data.cells.some(cell =>
      String(cell || "")
        .split("\n")
        .filter(name => name && name !== "—")
        .some(name => doc.getTextWidth(name) > usableTextWidth)
    );

    if (!hasWrappedName) return [data];

    const splitAt = Math.ceil(columnCount / 2);
    return [
      {
        times: data.times.slice(0, splitAt),
        counts: data.counts.slice(0, splitAt),
        cells: data.cells.slice(0, splitAt),
        cellPeople: data.cellPeople.slice(0, splitAt)
      },
      {
        times: data.times.slice(splitAt),
        counts: data.counts.slice(splitAt),
        cells: data.cells.slice(splitAt),
        cellPeople: data.cellPeople.slice(splitAt)
      }
    ].filter(part => part.times.length);
  }

  function estimateBlockHeight(data) {
    const maxLines = Math.max(
      1,
      ...data.cells.map(cell => String(cell || "").split("\n").length)
    );

    const titleAndGap = 23;
    const headerHeight = 13.5;
    const bodyPadding = 5.5;
    const bodyLineHeight = 3.7;
    const safety = 3;
    const gapAfterBlock = 10;

    return titleAndGap + headerHeight + bodyPadding + (maxLines * bodyLineHeight) + safety + gapAfterBlock;
  }

  function drawStamp(doc, stamp, pageWidth) {
    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(stamp, pageWidth / 2, 9, { align: "center" });
  }

  function addPlanningPage(doc, stamp, pageWidth) {
    doc.addPage("a4", "landscape");
    drawStamp(doc, stamp, pageWidth);
    return 16;
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
      const printableBottom = pageHeight - margin;
      const stamp = formatStamp();

      drawStamp(doc, stamp, pageWidth);

      doc.setTextColor(28, 46, 171);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("PLANNING COMPLET", margin, 18);

      let y = 25;

      blocks.forEach(block => {
        const data = tableData(block);
        if (!data) return;

        const tableParts = splitTableDataForReadability(doc, data, pageWidth, margin);
        const requiredHeight = tableParts.reduce(
          (sum, part) => sum + estimateBlockHeight(part) - 23 - 10,
          23 + 10 + Math.max(0, tableParts.length - 1) * 7
        );
        const fullFreshPageHeight = printableBottom - 16;

        if (y + requiredHeight > printableBottom && requiredHeight <= fullFreshPageHeight) {
          y = addPlanningPage(doc, stamp, pageWidth);
        }

        y = drawTitleCard(doc, block, y, pageWidth, margin);

        tableParts.forEach((part, partIndex) => {
          if (partIndex > 0) y += 7;

          doc.autoTable({
            startY: y,
            head: [part.times],
            body: [part.cells],
            margin: { top: 16, left: margin, right: margin, bottom: margin },
            pageBreak: "avoid",
            rowPageBreak: "avoid",
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
            bodyStyles: {
              valign: "top",
              cellPadding: { top: 2.5, right: 3, bottom: 3, left: 3 }
            },
            didParseCell: hookData => {
              if (hookData.section !== "body") return;
              const people = part.cellPeople?.[hookData.column.index] || [];
              if (people.length) {
                // Le texte natif sert encore au calcul de hauteur, mais il est
                // rendu invisible : chaque nom est redessiné ci-dessous avec
                // son statut (absent/retard).
                hookData.cell.styles.textColor = [255, 255, 255];
              }
            },
            didDrawCell: hookData => {
              if (hookData.section === "head") {
                const count = part.counts[hookData.column.index];
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
                return;
              }

              if (hookData.section !== "body") return;

              const people = part.cellPeople?.[hookData.column.index] || [];
              if (!people.length) return;

              const centerX = hookData.cell.x + hookData.cell.width / 2;
              const maxTextWidth = Math.max(1, hookData.cell.width - 6);
              const lineHeight = 3.7;
              let cursorY = hookData.cell.y + 5.3;

              doc.setFontSize(8.5);

              people.forEach(person => {
                const emphasized = person.status === "absent" || person.status === "retard";
                doc.setFont("helvetica", emphasized ? "bold" : "normal");

                if (person.status === "absent") {
                  doc.setTextColor(228, 2, 48);
                } else if (person.status === "retard") {
                  doc.setTextColor(200, 116, 0);
                } else {
                  doc.setTextColor(20, 20, 20);
                }

                const lines = doc.splitTextToSize(person.text, maxTextWidth);
                lines.forEach(line => {
                  doc.text(line, centerX, cursorY, { align: "center" });

                  if (person.status === "absent") {
                    const textWidth = doc.getTextWidth(line);
                    doc.setDrawColor(17, 17, 17);
                    doc.setLineWidth(0.2);
                    doc.line(
                      centerX - textWidth / 2,
                      cursorY - 1.05,
                      centerX + textWidth / 2,
                      cursorY - 1.05
                    );
                  }

                  cursorY += lineHeight;
                });
              });
            },
            didDrawPage: () => {
              drawStamp(doc, stamp, pageWidth);
            }
          });

          y = doc.lastAutoTable.finalY;
        });

        y += 10;
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
