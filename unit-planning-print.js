/* Impression du planning de l'unité du responsable connecté.
   Le rendu reprend celui du bouton "Imprimer le planning horaire"
   de la liste ADMIN des mouvements de jeunesse. */
(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function compareFrench(a, b) {
    return String(a || "").trim().localeCompare(String(b || "").trim(), "fr", {
      sensitivity: "base",
      ignorePunctuation: true
    });
  }

  function festivalDate(iso) {
    const d = new Date(iso);
    d.setHours(d.getHours() - 4);
    return d.toLocaleDateString("sv-SE");
  }

  function festivalDayLabel(iso) {
    const d = new Date(iso);
    d.setHours(d.getHours() - 4);
    return d.toLocaleDateString("fr-BE", {
      weekday: "long",
      day: "numeric",
      month: "long"
    }).toUpperCase();
  }

  function minutes(iso) {
    const d = new Date(iso);
    return d.getHours() * 60 + d.getMinutes();
  }

  function slotLabel(value) {
    const h = Math.floor(value / 60);
    const m = value % 60;
    return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
  }

  function assignmentCoversSlot(row, slotStart) {
    let start = minutes(row.debut);
    let end = minutes(row.fin);
    if (end <= start) end += 24 * 60;
    return start < slotStart + 15 && end > slotStart;
  }

  function render(rows) {
    const order = ["Guides", "Patro", "Pionniers"];
    const units = order
      .map(name => [name, rows.filter(row => row.unite === name)])
      .filter(([, unitRows]) => unitRows.length);
    const slots = Array.from({ length: 49 }, (_, i) => 9 * 60 + i * 15);
    let body = "";

    for (const [unitName, unitRows] of units) {
      const assigned = unitRows.filter(row => row.debut && row.fin);
      const dates = [...new Set(assigned.map(row => festivalDate(row.debut)))].sort();

      if (!dates.length) {
        body += `<section class="yp-sheet"><h1>PLANNING DES ${escapeHtml(unitName.toUpperCase())}</h1>
          <div class="yp-chef">Chef : ${escapeHtml(unitRows[0].chef_prenom || "—")} · ${escapeHtml(unitRows[0].chef_telephone || "—")}</div>
          <p>Aucun horaire attribué.</p></section>`;
        continue;
      }

      for (const date of dates) {
        const dayRows = assigned.filter(row => festivalDate(row.debut) === date);
        const groups = new Map();

        dayRows.forEach(row => {
          const key = `${row.poste || "—"}|${row.lieu || "—"}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(row);
        });

        const first = dayRows[0];
        let daySlots = slots;
        const occupiedSlots = slots.filter(slot =>
          dayRows.some(row => assignmentCoversSlot(row, slot))
        );

        if (occupiedSlots.length) {
          const firstOccupied = occupiedSlots[0];
          const lastOccupied = occupiedSlots[occupiedSlots.length - 1];
          daySlots = slots.filter(slot => slot >= firstOccupied && slot <= lastOccupied);
        }

        body += `<section class="yp-sheet" data-unit="${escapeHtml(unitName)}"><h1>PLANNING DES ${escapeHtml(unitName.toUpperCase())}</h1>
          <div class="yp-top"><div class="yp-chef">Chef : ${escapeHtml(unitRows[0].chef_prenom || "—")} · ${escapeHtml(unitRows[0].chef_telephone || "—")}</div><div class="yp-date">${escapeHtml(festivalDayLabel(first.debut))}</div></div>
          <table><thead><tr><th class="yp-post">POSTE</th>${daySlots.map(slot => `<th class="${slot % 60 === 0 ? "yp-full-hour" : "yp-quarter-hour"}">${slotLabel(slot)}</th>`).join("")}</tr></thead><tbody>`;

        [...groups.entries()].sort((a, b) => compareFrench(a[0], b[0])).forEach(([key, groupRows]) => {
          const [post, place] = key.split("|");
          body += `<tr><td class="yp-post"><strong>${escapeHtml(post)}</strong><small>${escapeHtml(place)}</small></td>`;

          daySlots.forEach(slot => {
            const ids = new Set(
              groupRows
                .filter(row => assignmentCoversSlot(row, slot))
                .map(row => row.personne_id)
            );
            const count = ids.size;
            body += `<td class="${count ? "yp-filled" : ""}">${count ? `<strong>${count}</strong><span>animé·e${count > 1 ? "·s" : ""}</span>` : ""}</td>`;
          });

          body += `</tr>`;
        });

        body += `<tr class="yp-total-row"><td class="yp-post"><strong>TOTAL</strong></td>`;
        daySlots.forEach(slot => {
          const ids = new Set(
            dayRows
              .filter(row => assignmentCoversSlot(row, slot))
              .map(row => row.personne_id)
          );
          const count = ids.size;
          body += `<td class="yp-total-cell"><strong>${count}</strong><span>animé·e${count > 1 ? "·s" : ""}</span></td>`;
        });
        body += `</tr></tbody></table></section>`;
      }
    }

    return body;
  }

  async function print(client, onError) {
    const reportError = typeof onError === "function" ? onError : console.error;

    // Ouvrir immédiatement pendant le clic évite le blocage des pop-ups
    // pendant que les données Supabase se chargent.
    const popup = window.open("", "_blank");
    if (!popup) {
      reportError("Autorise les fenêtres pop-up pour imprimer le planning.");
      return;
    }

    popup.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Chargement du planning…</title></head><body style="font-family:Arial,sans-serif;padding:24px">Chargement du planning…</body></html>`);
    popup.document.close();

    const { data, error } = await client.rpc("get_my_youth_unit_planning");
    if (error) {
      console.error("Impossible de charger le planning de l’unité :", error);
      popup.close();
      reportError("Impossible de charger le planning de ton unité.");
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) {
      popup.close();
      reportError("Aucun planning d’unité n’est disponible pour ton compte.");
      return;
    }

    const body = render(rows);
    popup.document.open();
    popup.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Planning horaire — Mouvements de jeunesse</title>
    <style>@page{size:A4 landscape;margin:5mm}*{box-sizing:border-box}body{font-family:"Titillium Web",Arial,sans-serif;color:#17204a;margin:0}.yp-sheet{break-after:auto;page-break-after:auto;break-inside:auto;page-break-inside:auto;margin-bottom:3mm}.yp-sheet:nth-of-type(even){break-after:page;page-break-after:always;margin-bottom:0}.yp-sheet:last-child{break-after:auto;page-break-after:auto}h1{color:#1C2EAB;margin:0 0 1px;font-size:14px}.yp-top{margin-bottom:3px}.yp-chef{font-weight:600;font-size:11px}.yp-date{color:#E40230;font-weight:700;font-size:11px;margin-top:1px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #cbd1e6;padding:1px 0;text-align:center;font-size:5.5px;height:23px;overflow:hidden}th{background:#f1f3fb;color:#1C2EAB;font-weight:700;white-space:nowrap}.yp-full-hour{font-size:9px!important;background:#e7eaf8!important}.yp-quarter-hour{background:#fff!important}.yp-post{width:150px!important;text-align:left;padding-left:4px;padding-right:2px}.yp-post strong{font-size:9px;line-height:10px}.yp-post small{display:block;font-size:8px;font-weight:400;color:#555;line-height:9px}.yp-post .yp-resp{margin-top:2px;color:#1C2EAB;font-weight:600}.yp-filled{background:#f2f4fb}.yp-filled strong{display:block;color:#1C2EAB;font-size:8px;line-height:8px}.yp-filled span{display:block;font-size:4.5px;line-height:6px;white-space:nowrap}.yp-total-row td{border-top:2px solid #1C2EAB;background:#fff;height:25px}.yp-total-row .yp-post strong{font-size:9px;color:#1C2EAB}.yp-total-cell strong{display:block;font-size:11px;line-height:11px;color:#1C2EAB;font-weight:800}.yp-total-cell span{display:block;font-size:5px;line-height:7px;font-weight:600;white-space:nowrap}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>${body}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
    popup.document.close();
  }

  window.UnitPlanningPrinter = { print };
})();
