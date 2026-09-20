/* =========================================================
   PORTAIL BÉNÉVOLES — TABLEAU DE BORD
   ========================================================= */

const SUPABASE_URL =
  "https://ftfhtyohyjezoibmumum.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_oQOnxMDMyvx6ukcuJHgWuQ_Gu-utQe3";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

/* =========================================================
   ÉLÉMENTS DE LA PAGE
   ========================================================= */

const firstnameElement =
  document.getElementById("user-firstname");

const roleElement =
  document.getElementById("user-role");

const logoutButton =
  document.getElementById("logout-button");

const responsableSection =
  document.getElementById("responsable-section");

const adminSection =
  document.getElementById("admin-section");

const dashboardMain =
  document.querySelector(".dashboard-main");

const nextShiftContent =
  document.getElementById("next-shift-content");

/* =========================================================
   PETIT MESSAGE DANS LA PAGE
   ========================================================= */

function showDashboardMessage(message, type = "info") {
  const oldMessage =
    document.querySelector(".dashboard-message");

  if (oldMessage) {
    oldMessage.remove();
  }

  const messageElement =
    document.createElement("div");

  messageElement.className =
    `dashboard-message ${type}`;

  messageElement.textContent =
    message;

  dashboardMain.prepend(messageElement);
}

/* =========================================================
   NOM DU RÔLE
   ========================================================= */

function getRoleLabel(role) {
  switch (role) {
    case "admin":
      return "Administration · Coordination bénévoles";

    case "responsable":
      return "Responsable de poste";

    case "benevole":
      return "Bénévole";

    default:
      return "Bénévole";
  }
}

/* =========================================================
   FORMATAGE DATE / HEURE
   ========================================================= */

function formatShiftDate(dateValue) {
  return new Intl.DateTimeFormat(
    "fr-BE",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Brussels"
    }
  ).format(new Date(dateValue));
}

function formatShiftTime(dateValue) {
  const parts = new Intl.DateTimeFormat(
    "fr-BE",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/Brussels"
    }
  ).formatToParts(new Date(dateValue));

  const hour = Number(
    parts.find(part => part.type === "hour")?.value || "0"
  );

  const minute =
    parts.find(part => part.type === "minute")?.value || "00";

  return minute === "00"
    ? `${hour}h`
    : `${hour}h${minute}`;
}

/* =========================================================
   PROCHAIN POSTE
   ========================================================= */

async function loadNextShift() {
  if (!nextShiftContent) {
    return;
  }

  const {
    data: shifts,
    error: shiftError
  } = await supabaseClient
    .rpc("get_my_next_shift");

  if (shiftError) {
    console.error(
      "Impossible de charger le prochain poste :",
      shiftError
    );

    nextShiftContent.innerHTML = `
      <p class="empty-shift-title">Impossible de charger ton horaire</p>
      <p>Réessaie dans un instant.</p>
    `;
    return;
  }

  if (!shifts || shifts.length === 0) {
    return;
  }

  const shift = shifts[0];

  const posteName =
    shift.poste_nom || "Poste à confirmer";

  let locationName =
    shift.lieu_nom || "";

  if (!locationName && shift.note) {
    if (
      shift.note.toLowerCase().includes("hall polyvalent / site")
    ) {
      locationName =
        "Hall polyvalent / Site festival";
    }
  }

  const dateLabel =
    formatShiftDate(shift.debut);

  const startTime =
    formatShiftTime(shift.debut);

  const endTime =
    formatShiftTime(shift.fin);

  nextShiftContent.className =
    "next-shift-content";

  nextShiftContent.innerHTML = "";

  const poste =
    document.createElement("p");

  poste.className =
    "next-shift-poste";

  poste.textContent =
    posteName;

  const schedule =
    document.createElement("p");

  schedule.className =
    "next-shift-schedule";

  schedule.textContent =
    `${dateLabel} · ${startTime}-${endTime}`;

  nextShiftContent.appendChild(poste);
  nextShiftContent.appendChild(schedule);

  if (locationName) {
    const location =
      document.createElement("p");

    location.className =
      "next-shift-location";

    location.textContent =
      `📍 ${locationName}`;

    nextShiftContent.appendChild(location);
  }
}

/* =========================================================
   CHARGEMENT DU PORTAIL
   ========================================================= */

async function loadDashboard() {
  const {
    data: userData,
    error: userError
  } = await supabaseClient.auth.getUser();

  if (
    userError ||
    !userData ||
    !userData.user
  ) {
    window.location.replace("index.html");
    return;
  }

  const user =
    userData.user;

  const {
    data: benevole,
    error: benevoleError
  } = await supabaseClient
    .from("benevoles")
    .select(
      "id, prenom, nom, email"
    )
    .eq(
      "user_id",
      user.id
    )
    .maybeSingle();

  if (
    benevoleError ||
    !benevole
  ) {
    console.error(
      "Fiche bénévole introuvable :",
      benevoleError
    );

    firstnameElement.textContent =
      "Bénévole";

    showDashboardMessage(
      "Ton compte est connecté mais ta fiche bénévole n'a pas pu être retrouvée. Contacte le responsable Bénévoles.",
      "error"
    );

    return;
  }

  firstnameElement.textContent =
    benevole.prenom;

  const {
    data: participation,
    error: participationError
  } = await supabaseClient
    .from("participations")
    .select(`
      role,
      editions!inner (
        annee,
        active
      )
    `)
    .eq(
      "benevole_id",
      benevole.id
    )
    .eq(
      "actif",
      true
    )
    .eq(
      "editions.active",
      true
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    )
    .limit(1)
    .maybeSingle();

  if (
    participationError ||
    !participation
  ) {
    console.error(
      "Participation introuvable :",
      participationError
    );

    roleElement.textContent =
      "Bénévole";

    showDashboardMessage(
      "Aucune participation active n'a été trouvée pour ton compte",
      "error"
    );

    return;
  }

  const role =
    participation.role;

  roleElement.textContent =
    getRoleLabel(role);

  await loadNextShift();

  if (
    role === "responsable" ||
    role === "admin"
  ) {
    responsableSection.hidden =
      false;
  }

  if (role === "admin") {
    adminSection.hidden =
      false;
  }
}

/* =========================================================
   DÉCONNEXION
   ========================================================= */

logoutButton.addEventListener(
  "click",
  async () => {
    logoutButton.disabled =
      true;

    logoutButton.textContent =
      "Déconnexion...";

    const { error } =
      await supabaseClient.auth.signOut();

    if (error) {
      console.error(
        "Erreur de déconnexion :",
        error
      );

      logoutButton.disabled =
        false;

      logoutButton.textContent =
        "Se déconnecter";

      showDashboardMessage(
        "La déconnexion a échoué, réessaie",
        "error"
      );

      return;
    }

    window.location.replace(
      "index.html"
    );
  }
);

/* =========================================================
   RUBRIQUES PAS ENCORE ACTIVES
   ========================================================= */

const futureLinks =
  document.querySelectorAll(
    '.dashboard-card[href="#"]'
  );

futureLinks.forEach((link) => {
  link.addEventListener(
    "click",
    (event) => {
      event.preventDefault();

      showDashboardMessage(
        "Prochainement disponible"
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }
  );
});

/* =========================================================
   DÉMARRAGE
   ========================================================= */

loadDashboard();
