const SUPABASE_URL = "https://ftfhtyohyjezoibmumum.supabase.co";
const SUPABASE_KEY = "sb_publishable_oQOnxMDMyvx6ukcuJHgWuQ_Gu-utQe3";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const dispoList = document.getElementById("dispo-list");
const messageBox = document.getElementById("dispo-message");
const logoutButton = document.getElementById("logout-button");

let activeTargets = [];

const alphaCollator = new Intl.Collator("fr", {
  sensitivity: "base",
  ignorePunctuation: true,
  numeric: true
});

function formatTime(dateValue) {
  const parts = new Intl.DateTimeFormat("fr-BE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Brussels"
  }).formatToParts(new Date(dateValue));
  const hour = Number(parts.find(part => part.type === "hour")?.value || "0");
  const minute = parts.find(part => part.type === "minute")?.value || "00";
  return minute === "00" ? `${hour}h` : `${hour}h${minute}`;
}

function formatPhoneForLink(value) {
  return (value || "").replace(/[^+\d]/g, "");
}

function showMessage(text, type = "info") {
  messageBox.hidden = false;
  messageBox.className = `dispo-message ${type}`;
  messageBox.textContent = text;
}

function hideMessage() {
  messageBox.hidden = true;
}

function targetValue(target) {
  return `${target.poste_id}|${target.lieu_id ?? ""}`;
}

function targetLabel(target) {
  return `${target.poste_nom} · ${target.lieu_nom}`;
}

async function assignVolunteer(person, select, button) {
  if (!select.value) return;

  const [posteIdRaw, lieuIdRaw] = select.value.split("|");
  const posteId = Number(posteIdRaw);
  const lieuId = lieuIdRaw === "" ? null : Number(lieuIdRaw);

  button.disabled = true;
  select.disabled = true;
  button.textContent = "Affectation…";

  const { error } = await supabaseClient.rpc("assign_available_volunteer_to_active_post", {
    p_personne_id: person.personne_id,
    p_poste_id: posteId,
    p_lieu_id: lieuId
  });

  if (error) {
    console.error(error);
    showMessage(error.message || "Impossible d'affecter ce bénévole.", "error");
    button.disabled = false;
    select.disabled = false;
    button.textContent = "Affecter";
    return;
  }

  showMessage(`${person.prenom} ${(person.nom || "").toUpperCase()} a été affecté·e au poste sélectionné.`);
  await Promise.all([loadTargets(), loadVolunteers(false)]);
}

function renderVolunteers(rows) {
  dispoList.innerHTML = "";

  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "dispo-empty";
    empty.textContent = "Aucun bénévole n'est actuellement disponible";
    dispoList.appendChild(empty);
    return;
  }

  [...rows]
    .sort((a, b) => alphaCollator.compare(a.nom || "", b.nom || "") || alphaCollator.compare(a.prenom || "", b.prenom || ""))
    .forEach(person => {
      const row = document.createElement("div");
      row.className = "dispo-row";

      const dot = document.createElement("span");
      dot.className = "dispo-dot";
      dot.setAttribute("aria-label", "Disponible");
      row.appendChild(dot);

      const identity = document.createElement("div");
      identity.className = "dispo-identity";

      const first = document.createElement("div");
      first.className = "dispo-firstname";
      first.textContent = person.prenom || "";
      identity.appendChild(first);

      const meta = document.createElement("div");
      meta.className = "dispo-meta";

      const surname = document.createElement("span");
      surname.className = "dispo-surname";
      surname.textContent = (person.nom || "").toUpperCase();
      meta.appendChild(surname);

      if (person.telephone) {
        const phone = document.createElement("a");
        phone.className = "dispo-phone";
        phone.href = `tel:${formatPhoneForLink(person.telephone)}`;
        phone.textContent = `📞 ${person.telephone}`;
        meta.appendChild(phone);
      }

      identity.appendChild(meta);
      row.appendChild(identity);

      const since = document.createElement("div");
      since.className = "dispo-since";
      since.textContent = `Depuis ${formatTime(person.disponible_depuis)}`;
      row.appendChild(since);

      const assignArea = document.createElement("div");
      assignArea.className = "dispo-assign";

      const select = document.createElement("select");
      select.className = "dispo-assign-select";
      select.setAttribute("aria-label", `Poste à attribuer à ${person.prenom}`);

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = activeTargets.length ? "Choisir un poste + lieu en cours" : "Aucun poste en cours disponible";
      select.appendChild(placeholder);

      activeTargets.forEach(target => {
        const option = document.createElement("option");
        option.value = targetValue(target);
        option.textContent = targetLabel(target);
        select.appendChild(option);
      });

      const button = document.createElement("button");
      button.type = "button";
      button.className = "dispo-assign-button";
      button.textContent = "Affecter";
      button.disabled = true;

      select.disabled = !activeTargets.length;
      select.addEventListener("change", () => {
        button.disabled = !select.value;
      });
      button.addEventListener("click", () => assignVolunteer(person, select, button));

      assignArea.append(select, button);
      row.appendChild(assignArea);

      dispoList.appendChild(row);
    });
}

async function loadTargets() {
  const { data, error } = await supabaseClient.rpc("get_active_assignment_targets");

  if (error) {
    console.error(error);
    activeTargets = [];
    return;
  }

  activeTargets = [...(data || [])].sort((a, b) =>
    alphaCollator.compare(a.poste_nom || "", b.poste_nom || "") ||
    alphaCollator.compare(a.lieu_nom || "", b.lieu_nom || "")
  );
}

async function loadVolunteers(clearMessage = true) {
  if (clearMessage) hideMessage();
  dispoList.innerHTML = `<div class="dispo-empty">Chargement…</div>`;

  const { data, error } = await supabaseClient.rpc("get_available_volunteers_all");

  if (error) {
    console.error(error);
    dispoList.innerHTML = "";
    showMessage("Impossible de charger les bénévoles disponibles.", "error");
    return;
  }

  renderVolunteers(data || []);
}

async function init() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData?.session) {
    window.location.replace("index.html");
    return;
  }

  await loadTargets();
  await loadVolunteers();
}

logoutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.replace("index.html");
});

init();
