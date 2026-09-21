/* =========================================================
   PORTAIL BÉNÉVOLES — TABLEAU DE BORD
   ========================================================= */

const SUPABASE_URL = "https://ftfhtyohyjezoibmumum.supabase.co";
const SUPABASE_KEY = "sb_publishable_oQOnxMDMyvx6ukcuJHgWuQ_Gu-utQe3";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const firstnameElement = document.getElementById("user-firstname");
const roleElement = document.getElementById("user-role");
const logoutButton = document.getElementById("logout-button");
const dashboardMain = document.querySelector(".dashboard-main");
const nextShiftContent = document.getElementById("next-shift-content");
const volunteerNextShiftSection = document.getElementById("volunteer-next-shift-section");
const teamMenuSection = document.getElementById("team-menu-section");

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
  const label = new Intl.DateTimeFormat("fr-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Brussels"
  }).format(new Date(dateValue));

  return label.charAt(0).toUpperCase() + label.slice(1);
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

function isReinforcementShift(shift) {
  const note = (shift.note || "").toLowerCase();
  return note.startsWith("renfort") || note.startsWith("affectation depuis la liste des bénévoles disponibles");
}

function getDisplayedStatus(shift) {
  if (shift.statut === "retard") {
    return { key: "retard", label: `En retard de ${shift.retard_minutes || 0} min (à ce poste)` };
  }

  if (shift.statut === "present" && shift.disponible) {
    return { key: "disponible", label: "Disponible (pour un autre poste)" };
  }

  const labels = {
    present: "Présent·e (à mon poste)",
    absent: "Absent·e (de ce poste)",
    hors_poste: "Absent·e (de ce poste)",
    en_pause: "En pause",
    termine: "Terminé",
    a_venir: "Inconnu (je ne suis plus là)",
    inconnu: "Inconnu (je ne suis plus là)"
  };

  return {
    key: shift.statut && labels[shift.statut] ? shift.statut : "inconnu",
    label: labels[shift.statut] || "Inconnu (je ne suis plus là)"
  };
}

async function savePresenceStatus(shift, status, retardMinutes = null) {
  const { error } = await supabaseClient.rpc("set_my_presence_status", {
    p_affectation_id: shift.affectation_id,
    p_statut: status,
    p_retard_minutes: retardMinutes,
    p_disponible: status === "disponible"
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
  const statusControl = document.createElement("div");
  statusControl.className = "volunteer-status-control";

  const statusButton = document.createElement("button");
  statusButton.type = "button";
  statusButton.className = "volunteer-status-button";
  statusButton.setAttribute("aria-label", `${current.label}. Cliquer pour modifier le statut.`);
  statusButton.setAttribute("aria-expanded", "false");

  const dot = document.createElement("span");
  dot.className = `volunteer-status-dot volunteer-status-${current.key}`;
  dot.setAttribute("aria-hidden", "true");

  const statusLabel = document.createElement("span");
  statusLabel.className = "volunteer-status-label";
  statusLabel.textContent = current.label;

  const chevron = document.createElement("span");
  chevron.className = "volunteer-status-chevron";
  chevron.textContent = "▾";
  chevron.setAttribute("aria-hidden", "true");

  statusButton.append(dot, statusLabel, chevron);

  const menu = document.createElement("div");
  menu.className = "volunteer-status-menu";
  menu.hidden = true;

  const choices = [
    ["present", "Présent·e (à mon poste)"],
    ["en_pause", "En pause"],
    ["disponible", "Disponible (pour un autre poste)"],
    ["retard", "En retard (à ce poste)"],
    ["absent", "Absent·e (de ce poste)"],
    ["inconnu", "Inconnu (je ne suis plus là)"]
  ];

  choices.forEach(([key, label]) => {
    if (key === "retard") {
      const delayBlock = document.createElement("div");
      delayBlock.className = "volunteer-delay-block";

      const delayHeader = document.createElement("button");
      delayHeader.type = "button";
      delayHeader.className = "volunteer-status-option volunteer-delay-toggle";

      const swatch = document.createElement("span");
      swatch.className = "volunteer-status-swatch volunteer-status-retard";
      const text = document.createElement("span");
      text.textContent = label;
      delayHeader.append(swatch, text);

      const delayChoices = document.createElement("div");
      delayChoices.className = "volunteer-delay-choices";
      delayChoices.hidden = true;

      [5, 10, 15, 20, 30, 45, 60].forEach(minutes => {
        const delayButton = document.createElement("button");
        delayButton.type = "button";
        delayButton.className = "volunteer-delay-choice";
        delayButton.textContent = `${minutes} min`;
        delayButton.addEventListener("click", async event => {
          event.stopPropagation();
          menu.hidden = true;
          statusButton.setAttribute("aria-expanded", "false");
          if (await savePresenceStatus(shift, "retard", minutes)) {
            await loadNextShift();
          }
        });
        delayChoices.appendChild(delayButton);
      });

      delayHeader.addEventListener("click", event => {
        event.stopPropagation();
        delayChoices.hidden = !delayChoices.hidden;
      });

      delayBlock.append(delayHeader, delayChoices);
      menu.appendChild(delayBlock);
      return;
    }

    const option = document.createElement("button");
    option.type = "button";
    option.className = "volunteer-status-option";

    const swatch = document.createElement("span");
    swatch.className = `volunteer-status-swatch volunteer-status-${key}`;
    const text = document.createElement("span");
    text.textContent = label;
    option.append(swatch, text);

    option.addEventListener("click", async event => {
      event.stopPropagation();
      menu.hidden = true;
      statusButton.setAttribute("aria-expanded", "false");
      if (await savePresenceStatus(shift, key)) {
        await loadNextShift();
      }
    });

    menu.appendChild(option);
  });

  statusButton.addEventListener("click", event => {
    event.stopPropagation();
    document.querySelectorAll(".volunteer-status-menu").forEach(other => {
      if (other !== menu) other.hidden = true;
    });
    menu.hidden = !menu.hidden;
    statusButton.setAttribute("aria-expanded", menu.hidden ? "false" : "true");
  });

  statusControl.append(statusButton, menu);
  wrapper.appendChild(statusControl);
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

  if (!shifts || shifts.length === 0) {
    nextShiftContent.className = "empty-shift";
    nextShiftContent.innerHTML = `
      <p class="empty-shift-title">Aucun horaire disponible pour le moment</p>
      <p>Ton planning apparaîtra ici dès qu'il sera disponible.</p>
    `;
    return;
  }

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
  schedule.textContent = isReinforcementShift(shift)
    ? `${formatShiftDate(shift.debut)} · ${formatShiftTime(shift.debut)} - renfort`
    : `${formatShiftDate(shift.debut)} · ${formatShiftTime(shift.debut)}-${formatShiftTime(shift.fin)}`;
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

  if (role === "benevole") {
    volunteerNextShiftSection.hidden = false;
    teamMenuSection.hidden = true;
    await loadNextShift();
  } else if (role === "responsable" || role === "admin") {
    volunteerNextShiftSection.hidden = true;
    teamMenuSection.hidden = false;
  }
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

document.addEventListener("click", () => {
  document.querySelectorAll(".volunteer-status-menu").forEach(menu => {
    menu.hidden = true;
  });
  document.querySelectorAll(".volunteer-status-button").forEach(button => {
    button.setAttribute("aria-expanded", "false");
  });
});

document.querySelectorAll('.dashboard-card[href="#"], .team-menu-future[href="#"]').forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    showDashboardMessage("Prochainement disponible");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

loadDashboard();
