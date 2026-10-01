/* Empêche le flash d'un contenu de rôle incorrect pendant le chargement du dashboard
   et applique les droits spécifiques des responsables d'unité. */
(async function () {
  const personalized = document.getElementById("dashboard-personalized");
  const firstname = document.getElementById("user-firstname");
  const role = document.getElementById("user-role");
  const volunteerSection = document.getElementById("volunteer-next-shift-section");
  const teamSection = document.getElementById("team-menu-section");

  if (!personalized || !firstname || !role || !volunteerSection || !teamSection) return;
  if (typeof supabase === "undefined") return;

  const client = supabase.createClient(
    "https://ftfhtyohyjezoibmumum.supabase.co",
    "sb_publishable_oQOnxMDMyvx6ukcuJHgWuQ_Gu-utQe3"
  );

  let unitNames = [];
  let unitOnly = false;
  let hasVolunteerSchedule = false;
  let accessResolved = false;

  function isLoaded() {
    return firstname.textContent.trim() && firstname.textContent.trim() !== "...";
  }

  function enforceUnitAccess() {
    if (!unitNames.length) return;

    teamSection.hidden = false;

    const heading = teamSection.querySelector(".section-heading h2");
    if (heading && unitOnly) {
      heading.textContent = `Mes animé·e·s · ${unitNames.join(" · ")}`;
    }

    const availableLink = teamSection.querySelector('a[href="benevoles-dispo.html"]');
    if (availableLink) {
      availableLink.hidden = unitOnly;
    }

    // Un responsable d'unité seul gère ses animé·e·s, pas un poste :
    // on ne lui affiche l'espace BÉNÉVOLE que s'il possède réellement
    // un horaire personnel.
    if (unitOnly) {
      volunteerSection.hidden = !hasVolunteerSchedule;

      const parent = teamSection.parentNode;
      if (parent && teamSection.nextElementSibling !== volunteerSection) {
        parent.insertBefore(teamSection, volunteerSection);
      }
    }
  }

  function revealIfReady() {
    if (!accessResolved || !isLoaded()) return false;

    enforceUnitAccess();

    const roleText = role.textContent.trim();
    const volunteerVisible = !volunteerSection.hidden;
    const managerVisible = !teamSection.hidden;

    if (!volunteerVisible && !managerVisible) return false;
    if (!roleText && !unitNames.length) return false;

    role.hidden = !roleText || roleText === "Bénévole";
    personalized.hidden = false;
    return true;
  }

  const observer = new MutationObserver(() => {
    enforceUnitAccess();
    revealIfReady();
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["hidden"]
  });

  try {
    const { data: userData } = await client.auth.getUser();
    const user = userData?.user;

    let isAdmin = false;
    if (user) {
      const { data: personne } = await client
        .from("benevoles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (personne) {
        const { data: participation } = await client
          .from("participations")
          .select("role, editions!inner(active)")
          .eq("benevole_id", personne.id)
          .eq("actif", true)
          .eq("editions.active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        isAdmin = participation?.role === "admin";
      }
    }

    const { data: scopes, error: scopesError } = await client.rpc("get_my_management_roles");
    if (scopesError) {
      console.error("Impossible de déterminer les responsabilités d'unité :", scopesError);
    } else {
      const allScopes = Array.isArray(scopes) ? scopes : [];
      unitNames = [...new Set(allScopes
        .filter(item => item.kind === "responsable_unite")
        .map(item => item.poste_nom)
        .filter(Boolean))];

      const hasPostManagement = allScopes.some(item =>
        item.kind === "responsable" || item.kind === "co_responsable"
      );

      unitOnly = unitNames.length > 0 && !isAdmin && !hasPostManagement;

      if (unitOnly) {
        const scheduleResult = await client.rpc("get_my_schedule");
        if (scheduleResult.error) {
          console.error("Impossible de vérifier les horaires personnels :", scheduleResult.error);
        } else {
          hasVolunteerSchedule = Array.isArray(scheduleResult.data) && scheduleResult.data.length > 0;
        }
      }
    }
  } catch (error) {
    console.error("Impossible d'appliquer les droits du responsable d'unité :", error);
  } finally {
    accessResolved = true;
    enforceUnitAccess();
    revealIfReady();
    setTimeout(() => observer.disconnect(), 6000);
  }
})();
