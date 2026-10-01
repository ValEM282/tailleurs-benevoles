/* Correctif robuste pour les responsables d’unité.
   Ce script est chargé en dernier afin que les anciens traitements du dashboard
   ne puissent pas remasquer l’espace responsable après détection du rôle. */
(async function () {
  if (typeof supabase === "undefined") return;

  const personalized = document.getElementById("dashboard-personalized");
  const firstnameElement = document.getElementById("user-firstname");
  const roleElement = document.getElementById("user-role");
  const volunteerSection = document.getElementById("volunteer-next-shift-section");
  const teamSection = document.getElementById("team-menu-section");

  if (!personalized || !firstnameElement || !roleElement || !volunteerSection || !teamSection) return;

  const client = supabase.createClient(
    "https://ftfhtyohyjezoibmumum.supabase.co",
    "sb_publishable_oQOnxMDMyvx6ukcuJHgWuQ_Gu-utQe3"
  );

  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData?.user) return;

    const { data: personne, error: personneError } = await client
      .from("benevoles")
      .select("id, prenom")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (personneError || !personne) return;

    const { data: scopes, error: scopesError } = await client.rpc("get_my_management_roles");
    if (scopesError) {
      console.error("Impossible de charger les responsabilités d’unité :", scopesError);
      return;
    }

    const allScopes = Array.isArray(scopes) ? scopes : [];
    const units = [...new Set(allScopes
      .filter(item => item.kind === "responsable_unite")
      .map(item => item.poste_nom)
      .filter(Boolean))];

    if (!units.length) return;

    const hasPostManagement = allScopes.some(item =>
      item.kind === "responsable" || item.kind === "co_responsable"
    );
    const unitOnly = !hasPostManagement;

    let hasVolunteerSchedule = false;
    if (unitOnly) {
      const scheduleResult = await client.rpc("get_my_schedule");
      if (!scheduleResult.error) {
        hasVolunteerSchedule = Array.isArray(scheduleResult.data) && scheduleResult.data.length > 0;
      }
    }

    const applyUnitDisplay = () => {
      firstnameElement.textContent = personne.prenom || firstnameElement.textContent || "Responsable";
      roleElement.textContent = `Responsable d’unité : ${units.join(" · ")}`;
      roleElement.hidden = false;

      teamSection.hidden = false;

      const heading = teamSection.querySelector(".section-heading h2");
      if (heading && unitOnly) heading.textContent = `Mes animé·e·s · ${units.join(" · ")}`;

      const availableLink = teamSection.querySelector('a[href="benevoles-dispo.html"]');
      if (availableLink) availableLink.hidden = unitOnly;

      if (unitOnly) {
        volunteerSection.hidden = !hasVolunteerSchedule;
        const parent = teamSection.parentNode;
        if (parent && teamSection.nextElementSibling !== volunteerSection) {
          parent.insertBefore(teamSection, volunteerSection);
        }
      }

      personalized.hidden = false;
    };

    applyUnitDisplay();

    // Les anciens scripts du portail sont asynchrones. On réapplique brièvement
    // le bon état pour éviter qu’une réponse tardive ne remasque l’encadré.
    let attempts = 0;
    const timer = setInterval(() => {
      applyUnitDisplay();
      attempts += 1;
      if (attempts >= 20) clearInterval(timer);
    }, 250);
  } catch (error) {
    console.error("Erreur lors de l’affichage du responsable d’unité :", error);
  }
})();
