const SUPABASE_URL = "https://ftfhtyohyjezoibmumum.supabase.co";
const SUPABASE_KEY = "sb_publishable_oQOnxMDMyvx6ukcuJHgWuQ_Gu-utQe3";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const dispoList = document.getElementById("dispo-list");
const messageBox = document.getElementById("dispo-message");
const logoutButton = document.getElementById("logout-button");

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

      const name = document.createElement("div");
      name.className = "dispo-name";
      const first = document.createElement("strong");
      first.textContent = person.prenom || "";
      const surname = document.createElement("span");
      surname.textContent = ` ${(person.nom || "").toUpperCase()}`;
      name.append(first, surname);
      identity.appendChild(name);

      if (person.telephone) {
        const phone = document.createElement("a");
        phone.className = "dispo-phone";
        phone.href = `tel:${formatPhoneForLink(person.telephone)}`;
        phone.textContent = `📞 ${person.telephone}`;
        identity.appendChild(phone);
      }

      row.appendChild(identity);

      const since = document.createElement("div");
      since.className = "dispo-since";
      since.textContent = `Disponible depuis ${formatTime(person.disponible_depuis)}`;
      row.appendChild(since);

      dispoList.appendChild(row);
    });
}

async function loadVolunteers() {
  hideMessage();
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

  await loadVolunteers();
}

logoutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.replace("index.html");
});

init();
