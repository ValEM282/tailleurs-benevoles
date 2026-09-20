/* =========================================================
   PORTAIL BÉNÉVOLES — TABLEAU DE BORD
   ========================================================= */

const SUPABASE_URL = "https://ftfhtyohyjezoibmumum.supabase.co";
const SUPABASE_KEY = "sb_publishable_oQOnxMDMyvx6ukcuJHgWuQ_Gu-utQe3";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const firstnameElement = document.getElementById("user-firstname");
const roleElement = document.getElementById("user-role");
const logoutButton = document.getElementById("logout-button");
const responsableSection = document.getElementById("responsable-section");
const adminSection = document.getElementById("admin-section");
const dashboardMain = document.querySelector(".dashboard-main");
const nextShiftContent = document.getElementById("next-shift-content");

function showDashboardMessage(message, type = "info") {
  const oldMessage = document.querySelector(".dashboard-message");
  if (oldMessage) oldMessage.remove();

  const messageElement = document.createElement("div");
  messageElement.className = `dashboard-message ${type}`;
  messageElement.textContent = message;
  dashboardMain.prepend(messageElement);
}

function getRoleLabel(role) {
  switch (role) {
    case "admin": return "Administration · Coordination bénévoles";
    case "responsable": return "Responsable de poste";
    case "benevole": return "Bénévole";
    default: return "Bénévole";
  }
}

function formatShiftDate(dateValue) {
  return new Intl.DateTimeFormat("fr-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Brussels"
  }).format(new Date(dateValue));
}

function formatShiftTime(dateValue) {
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

function minutesUntil(value) {
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 60000));
}

function getDisplayedStatus(shift) {
  const now = Date.now();
  const start = new Date(shift.debut).getTime();
  const end = new Date(shift.fin).getTime();

  if (now >= end) {
    return { key: "termine", label: "Poste terminé", color: "gray" };
  }

  if (shift.statut === "absent") {
    return { key: "absent", label: "Absent·e", color: "red" };
  }

  if (shift.statut === "hors_poste") {
    return { key: "hors_poste", label: "Je ne suis pas à mon poste", color: "red" };
  }

  if (shift.statut === "retard") {
    return {
      key: "retard",
      label: `Je serai en retard de ${shift.retard_minutes || 0} min`,
      color: "orange"
    };
  }

  if (shift.statut === "present" && shift.disponible) {
    return { key: "disponible", label: "Je suis disponible pour un autre poste", color: "blue" };
  }

  if (shift.statut === "present") {
    return { key: "present", label: "Je suis à mon poste", color: "green" };
  }

  if (now < start) {
    return {
      key: "a_venir",
      label: `À venir dans ${minutesUntil(shift.debut)} min`,
      color: "orange"
    };
  }

  return { key: "a_confirmer", label: "Poste en cours · confirme ton arrivée", color: "orange" };
}

async function savePresenceStatus(shift, status, retardMinutes = null, disponible = false) {
  const { error } = await supabaseClient.rpc("set_my_presence_status", {
    p_affectation_id: shift.affectation_id,
    p_statut: status,
    p_retard_minutes: retardMinutes,
    p_disponible: disponible
  });

  if (error) {
    console.error("Erreur de mise à jour du statut :", error);
    showDashboardMessage("Impossible de mettre ton statut à jour.", "error");
    return false;
  }

  return true;
}

function buildPresenceArea(shift) {
  const wrapper = document.createElement("div");
  wrapper.className = "presence-area";

  const title = document.createElement("div");
  title.className = "presence-title";
  title.textContent = "Mon statut";
  wrapper.appendChild(title);

  const current = getDisplayedStatus(shift);
  const badge = document.createElement("div");
  badge.className = `presence-badge presence-${current.color}`;
  badge.textContent = current.label;
  wrapper.appendChild(badge);

  const now = Date.now();
  const start = new Date(shift.debut).getTime();
  const end = new Date(shift.fin).getTime();

  if (now >= end) return wrapper;

  const actions = document.createElement("div");
  actions.className = "presence-actions";

  const presentButton = document.createElement("button");
  presentButton.type = "button";
  presentButton.className = "presence-action presence-action-green";
  presentButton.textContent = "Je suis à mon poste";
  presentButton.addEventListener("click", async () => {
    if (await savePresenceStatus(shift, "present", null, false)) loadNextShift();
  });
  actions.appendChild(presentButton);

  const availableButton = document.createElement("button");
  availableButton.type = "button";
  availableButton.className = "presence-action presence-action-blue";
  availableButton.textContent = "Je suis disponible pour un autre poste";
  availableButton.addEventListener("click", async () => {
    if (await savePresenceStatus(shift, "present", null, true)) loadNextShift();
  });
  actions.appendChild(availableButton);

  if (now < start) {
    const delayWrap = document.createElement("div");
    delayWrap.className = "delay-control";

    const delaySelect = document.createElement("select");
    delaySelect.className = "delay-select";
    [5, 10, 15, 20, 30, 45, 60].forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = `${value} min`;
      delaySelect.appendChild(option);
    });

    const delayButton = document.createElement("button");
    delayButton.type = "button";
    delayButton.className = "presence-action presence-action-orange";
    delayButton.textContent = "Je serai en retard de";
    delayButton.addEventListener("click", async () => {
      const minutes = Number(delaySelect.value);
      if (await savePresenceStatus(shift, "retard", minutes, false)) loadNextShift();
    });

    delayWrap.appendChild(delayButton);
    delayWrap.appendChild(delaySelect);
    actions.appendChild(delayWrap);
  }

  const absentButton = document.createElement("button");
  absentButton.type = "button";
  absentButton.className = "presence-action presence-action-red";
  absentButton.textContent = now < start ? "Je serai absent·e" : "Je ne suis pas à mon poste";
  absentButton.addEventListener("click", async () => {
    const status = now < start ? "absent" : "hors_poste";
    if (await savePresenceStatus(shift, status, null, false)) loadNextShift();
  });
  actions.appendChild(absentButton);

  wrapper.appendChild(actions);
  return wrapper;
}

async function loadNextShift() {
  if (!nextShiftContent) return;

  const { data: shifts, error: shiftError } = await supabaseClient.rpc("get_my_next_shift");

  if (shiftError) {
    console.error("Impossible de charger le prochain poste :", shiftError);
    nextShiftContent.innerHTML = `
      <p class="empty-shift-title">Impossible de charger ton horaire</p>
      <p>Réessaie dans un instant.</p>
    `;
    return;
  }

  if (!shifts || shifts.length === 0) return;

  const shift = shifts[0];
  const posteName = shift.poste_nom || "Poste à confirmer";

  let locationName = shift.lieu_nom || "";
  if (!locationName && shift.note && shift.note.toLowerCase().includes("hall polyvalent / site")) {
    locationName = "Hall polyvalent / Site festival";
  }

  nextShiftContent.className = "next-shift-content";
  nextShiftContent.innerHTML = "";

  const poste = document.createElement("p");
  poste.className = "next-shift-poste";
  poste.textContent = posteName;
  nextShiftContent.appendChild(poste);

  const schedule = document.createElement("p");
  schedule.className = "next-shift-schedule";
  schedule.textContent = `${formatShiftDate(shift.debut)} · ${formatShiftTime(shift.debut)}-${formatShiftTime(shift.fin)}`;
  nextShiftContent.appendChild(schedule);

  if (locationName) {
    const location = document.createElement("p");
    location.className = "next-shift-location";
    location.textContent = `📍 ${locationName}`;
    nextShiftContent.appendChild(location);
  }

  if (shift.responsable_prenom) {
    const responsible = document.createElement("p");
    responsible.className = "next-shift-responsible";
    responsible.append("Responsable : ");

    const name = document.createElement("span");
    name.textContent = `${shift.responsable_prenom} ${shift.responsable_initiale || ""}.`.replace("..", ".");
    responsible.appendChild(name);

    if (shift.responsable_telephone) {
      responsible.append(" · ");
      const phone = document.createElement("a");
      phone.href = `tel:${formatPhoneForLink(shift.responsable_telephone)}`;
      phone.textContent = shift.responsable_telephone;
      phone.className = "responsible-phone";
      responsible.appendChild(phone);
    }

    nextShiftContent.appendChild(responsible);
  }

  nextShiftContent.appendChild(buildPresenceArea(shift));
}

async function loadAvailableVolunteers(role) {
  if (!(role === "responsable" || role === "admin") || !responsableSection) return;

  let box = document.getElementById("available-volunteers-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "available-volunteers-box";
    box.className = "available-volunteers-box";
    responsableSection.appendChild(box);
  }

  box.innerHTML = `<h3>Bénévoles disponibles sur site</h3><p class="available-loading">Chargement...</p>`;

  const { data, error } = await supabaseClient.rpc("get_available_volunteers");
  if (error) {
    console.error("Impossible de charger les bénévoles disponibles :", error);
    box.innerHTML = `<h3>Bénévoles disponibles sur site</h3><p>Aucun aperçu disponible pour le moment.</p>`;
    return;
  }

  if (!data || data.length === 0) {
    box.innerHTML = `<h3>Bénévoles disponibles sur site</h3><p>Aucun bénévole ne s'est déclaré disponible.</p>`;
    return;
  }

  box.innerHTML = `<h3>Bénévoles disponibles sur site</h3>`;
  const list = document.createElement("div");
  list.className = "available-list";

  data.forEach(person => {
    const row = document.createElement("div");
    row.className = "available-row";

    const info = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = `${person.prenom} ${person.nom_initiale}`;
    info.appendChild(strong);

    if (person.prochain_debut) {
      const next = document.createElement("small");
      next.textContent = `Prochain poste : ${person.prochain_poste || "à confirmer"} à ${formatShiftTime(person.prochain_debut)}`;
      info.appendChild(next);
    }

    row.appendChild(info);

    if (person.telephone) {
      const phone = document.createElement("a");
      phone.className = "available-phone";
      phone.href = `tel:${formatPhoneForLink(person.telephone)}`;
      phone.textContent = person.telephone;
      row.appendChild(phone);
    }

    list.appendChild(row);
  });

  box.appendChild(list);
}

async function loadDashboard() {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();

  if (userError || !userData || !userData.user) {
    window.location.replace("index.html");
    return;
  }

  const user = userData.user;

  const { data: benevole, error: benevoleError } = await supabaseClient
    .from("benevoles")
    .select("id, prenom, nom, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (benevoleError || !benevole) {
    console.error("Fiche bénévole introuvable :", benevoleError);
    firstnameElement.textContent = "Bénévole";
    showDashboardMessage("Ton compte est connecté mais ta fiche bénévole n'a pas pu être retrouvée. Contacte le responsable Bénévoles.", "error");
    return;
  }

  firstnameElement.textContent = benevole.prenom;

  const { data: participation, error: participationError } = await supabaseClient
    .from("participations")
    .select(`role, editions!inner (annee, active)`)
    .eq("benevole_id", benevole.id)
    .eq("actif", true)
    .eq("editions.active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (participationError || !participation) {
    console.error("Participation introuvable :", participationError);
    roleElement.textContent = "Bénévole";
    showDashboardMessage("Aucune participation active n'a été trouvée pour ton compte", "error");
    return;
  }

  const role = participation.role;
  roleElement.textContent = getRoleLabel(role);

  await loadNextShift();

  if (role === "responsable" || role === "admin") {
    responsableSection.hidden = false;
    await loadAvailableVolunteers(role);
  }

  if (role === "admin") adminSection.hidden = false;
}

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  logoutButton.textContent = "Déconnexion...";

  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error("Erreur de déconnexion :", error);
    logoutButton.disabled = false;
    logoutButton.textContent = "Se déconnecter";
    showDashboardMessage("La déconnexion a échoué, réessaie", "error");
    return;
  }

  window.location.replace("index.html");
});

const futureLinks = document.querySelectorAll('.dashboard-card[href="#"]');
futureLinks.forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    showDashboardMessage("Prochainement disponible");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

loadDashboard();
