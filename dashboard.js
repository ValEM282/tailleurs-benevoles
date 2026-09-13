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
   CHARGEMENT DU PORTAIL
   ========================================================= */

async function loadDashboard() {

  /*
     On vérifie d'abord que la personne
     possède réellement une session Supabase.
  */

  const {
    data: userData,
    error: userError
  } =
    await supabaseClient.auth.getUser();


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


  /*
     On recherche maintenant la fiche bénévole
     reliée à l'utilisateur connecté.
  */

  const {
    data: benevole,
    error: benevoleError
  } =
    await supabaseClient

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
      "Ton compte est connecté mais ta fiche bénévole n'a pas pu être retrouvée. Contacte le reponsable Bénévoles.",
      "error"
    );

    return;
  }


  /*
     On affiche le prénom.
  */

  firstnameElement.textContent =
    benevole.prenom;


  /*
     On recherche la participation
     correspondant à l'édition active.
  */

  const {
    data: participation,
    error: participationError
  } =
    await supabaseClient

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

  const edition =
    participation.editions?.annee;


  /*
     Affichage du rôle.
  */

  roleElement.textContent =
    edition
      ? `${getRoleLabel(role)} · Édition ${edition}`
      : getRoleLabel(role);


  /*
     Zones visibles selon le rôle.
  */

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
