/* Recherche locale — bénévoles par poste */
(() => {
  const results = document.getElementById("post-stats-results");
  const body = document.getElementById("post-stats-body");
  const postSelect = document.getElementById("post-stats-post-search");
  const subpostSelect = document.getElementById("post-stats-subpost-search");
  const searchButton = document.getElementById("post-stats-search-button");
  const daySelect = document.getElementById("stats-day");
  const printButton = document.getElementById("post-stats-print-button");

  if (!results || !body || !postSelect || !subpostSelect || !searchButton) return;

  const collator = new Intl.Collator("fr", {
    sensitivity: "base",
    numeric: true
  });

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("fr")
      .trim();
  }

  function dataRows() {
    return [...body.querySelectorAll("tr")].filter(row => {
      if (row.classList.contains("post-search-empty")) return false;
      return row.querySelectorAll("td").length >= 2;
    });
  }

  function rowPost(row) {
    return (row.querySelectorAll("td")[0]?.textContent || "").trim();
  }

  function rowSubpost(row) {
    if (row.classList.contains("stats-post-total")) return "";
    const value = (row.querySelectorAll("td")[1]?.textContent || "").trim();
    return value === "—" ? "" : value;
  }

  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => collator.compare(a, b));
  }

  function setOptions(select, values, allLabel, preferredValue = "") {
    const normalizedPreferred = normalize(preferredValue);
    select.innerHTML = `<option value="">${allLabel}</option>`;

    values.forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });

    const matchingOption = [...select.options].find(option => normalize(option.value) === normalizedPreferred);
    select.value = matchingOption ? matchingOption.value : "";
  }

  function refreshPostOptions() {
    const previousPost = postSelect.value;
    const posts = uniqueSorted(dataRows().map(rowPost));
    setOptions(postSelect, posts, "Choisir un poste", previousPost);
    refreshSubpostOptions();
  }

  function refreshSubpostOptions() {
    const previousSubpost = subpostSelect.value;
    const selectedPost = normalize(postSelect.value);

    const subposts = uniqueSorted(
      dataRows()
        .filter(row => !selectedPost || normalize(rowPost(row)) === selectedPost)
        .map(rowSubpost)
    );

    setOptions(subpostSelect, subposts, "Choisir un sous-poste", previousSubpost);
  }

  function removeEmptyRow() {
    body.querySelector(".post-search-empty")?.remove();
  }

  function hideResultsUntilSearch() {
    results.hidden = true;
    if (printButton) printButton.hidden = true;
    removeEmptyRow();
  }

  function applySearch() {
    removeEmptyRow();

    const postFilter = normalize(postSelect.value);
    const subpostFilter = normalize(subpostSelect.value);
    const rows = dataRows();
    let visibleCount = 0;

    rows.forEach(row => {
      const postText = normalize(rowPost(row));
      const subpostText = normalize(rowSubpost(row));
      const isTotal = row.classList.contains("stats-post-total");

      const matchesPost = !postFilter || postText === postFilter;
      const matchesSubpost = !subpostFilter || (!isTotal && subpostText === subpostFilter);
      const visible = matchesPost && matchesSubpost;

      row.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    if (!visibleCount) {
      const emptyRow = document.createElement("tr");
      emptyRow.className = "post-search-empty";
      emptyRow.innerHTML = '<td colspan="3" class="stats-empty-row">Aucun résultat ne correspond à la recherche.</td>';
      body.appendChild(emptyRow);
    }

    results.hidden = false;
    if (printButton) printButton.hidden = visibleCount === 0;
  }

  function buildPdf() {
    const jsPDF = window.jspdf?.jsPDF;
    const rows = dataRows().filter(row => !row.hidden);
    if (!jsPDF || !rows.length || results.hidden) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const now = new Intl.DateTimeFormat("fr-BE", {timeZone:"Europe/Brussels",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date());
    doc.setFont("helvetica","bold"); doc.setFontSize(16); doc.setTextColor(28,46,171); doc.text("BÉNÉVOLES PAR POSTE",12,14);
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(90,90,100); doc.text(`Imprimé le ${now}`,285,14,{align:"right"});
    const criteria=[postSelect.value ? `Poste : ${postSelect.value}`:"",subpostSelect.value ? `Sous-poste : ${subpostSelect.value}`:"",daySelect?.value ? `Jour : ${daySelect.options[daySelect.selectedIndex]?.textContent || daySelect.value}`:""].filter(Boolean).join(" · ");
    if(criteria){doc.setFontSize(8.5);doc.text(criteria,12,20);}
    doc.autoTable({startY:criteria?24:20,head:[["Poste","Sous-poste","Bénévoles"]],body:rows.map(row=>[...row.cells].map((cell,index)=>index===1 && cell.textContent.trim().toLocaleLowerCase("fr")==="total du poste" ? "TOTAL DU POSTE" : cell.textContent.trim())),theme:"grid",styles:{font:"helvetica",fontSize:9,cellPadding:2.5,lineColor:[207,212,232],lineWidth:.2,textColor:[20,20,24]},headStyles:{fillColor:[28,46,171],textColor:[255,255,255],fontStyle:"bold"},columnStyles:{2:{halign:"center",fontSize:11,fontStyle:"bold"}},didParseCell(data){if(data.section==="body" && data.row.raw?.[1]==="TOTAL DU POSTE"){data.cell.styles.fillColor=[235,236,240];data.cell.styles.fontStyle="bold";if(data.column.index===0)data.cell.styles.fontSize=10;}}});
    doc.save("benevoles-par-poste.pdf");
  }

  function resetSearchView() {
    postSelect.value = "";
    refreshSubpostOptions();
    subpostSelect.value = "";
    results.hidden = true;
    removeEmptyRow();
  }

  postSelect.addEventListener("change", () => {
    refreshSubpostOptions();
    hideResultsUntilSearch();
  });

  subpostSelect.addEventListener("change", hideResultsUntilSearch);
  searchButton.addEventListener("click", applySearch);
  printButton?.addEventListener("click", buildPdf);

  [postSelect, subpostSelect].forEach(select => {
    select.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      applySearch();
    });
  });

  if (daySelect) {
    daySelect.addEventListener("change", resetSearchView);
  }

  const observer = new MutationObserver(() => {
    refreshPostOptions();
    results.hidden = true;
  });
  observer.observe(body, { childList: true });

  refreshPostOptions();
  results.hidden = true;
})();
