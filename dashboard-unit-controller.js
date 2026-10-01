/* Contrôle d'affichage des responsables de poste, co-responsables et responsables d'unité.
   Réutilise le client Supabase créé par dashboard.js et garantit que
   l'affichage final respecte les responsabilités réelles de l'utilisateur. */
(async function () {
  if (typeof supabaseClient === "undefined") return;

  const personalized = document.getElementById("dashboard-personalized");
  const teamSection = document.getElementById("team-menu-section");
  const volunteerSection = document.getElementById("volunteer-next-shift-section");
  const role = document.getElementById("user-role");
  const unitPlanningButton = document.getElementById("unit-planning-button");

  if (!personalized || !teamSection || !volunteerSection || !role) return;

  const { data: scopes, error: scopesError } = await supabaseClient.rpc("get_my_management_roles");
  if (scopesError) {
    console.error("Impossible de charger les responsabilités :", scopesError);
    return;
  }

  const allScopes = Array.isArray(scopes) ? scopes : [];
  const units = [...new Set(
    allScopes
      .filter(item => item.kind === "responsable_unite")
      .map(item => item.poste_nom)
      .filter(Boolean)
  )];

  const hasResponsiblePost = allScopes.some(item => item.kind === "responsable");
  const hasCoResponsiblePost = allScopes.some(item => item.kind === "co_responsable");
  const hasPostManagement = hasResponsiblePost || hasCoResponsiblePost;
  const hasUnitManagement = units.length > 0;

  if (!hasPostManagement && !hasUnitManagement) return;

  const unitOnly = hasUnitManagement && !hasPostManagement;

  let hasVolunteerSchedule = false;
  if (unitOnly) {
    const scheduleResult = await supabaseClient.rpc("get_my_schedule");
    if (scheduleResult.error) {
      console.error("Impossible de vérifier les horaires personnels :", scheduleResult.error);
    } else {
      hasVolunteerSchedule = Array.isArray(scheduleResult.data) && scheduleResult.data.length > 0;
    }
  }

  const expectedVolunteerHidden = unitOnly ? !hasVolunteerSchedule : volunteerSection.hidden;

  function reportPlanningError(message) {
    if (typeof showDashboardMessage === "function") {
      showDashboardMessage(message, "error");
    } else {
      alert(message);
    }
  }

  if (hasUnitManagement && unitPlanningButton) {
    unitPlanningButton.hidden = false;
    unitPlanningButton.addEventListener("click", event => {
      event.preventDefault();

      if (!window.UnitPlanningPrinter || typeof window.UnitPlanningPrinter.print !== "function") {
        reportPlanningError("Le planning de l’unité n’a pas pu être ouvert.");
        return;
      }

      window.UnitPlanningPrinter.print(supabaseClient, reportPlanningError);
    });
  }

  function placeManagerSectionFirst() {
    const parent = teamSection.parentNode;
    if (!parent) return;

    // Responsable et co-responsable ont exactement la même priorité d'affichage.
    // Si l'espace bénévole existe aussi, RESPONSABLE reste toujours au-dessus.
    if (!volunteerSection.hidden && teamSection.nextElementSibling !== volunteerSection) {
      parent.insertBefore(teamSection, volunteerSection);
    }
  }

  function applyManagementDisplay() {
    if (personalized.hidden) personalized.hidden = false;
    if (teamSection.hidden) teamSection.hidden = false;

    // Les responsables d'unité ont leur libellé et leur vue spécifiques.
    if (hasUnitManagement) {
      role.textContent = `Responsable d’unité : ${units.join(" · ")}`;
      if (role.hidden) role.hidden = false;

      const heading = teamSection.querySelector(".section-heading h2");
      if (heading && unitOnly) {
        heading.textContent = `Mes animé·e·s · ${units.join(" · ")}`;
      }

      const availableLink = teamSection.querySelector('a[href="benevoles-dispo.html"]');
      if (availableLink && unitOnly && !availableLink.hidden) {
        availableLink.hidden = true;
      }

      if (unitPlanningButton && unitPlanningButton.hidden) {
        unitPlanningButton.hidden = false;
      }

      if (unitOnly && volunteerSection.hidden !== expectedVolunteerHidden) {
        volunteerSection.hidden = expectedVolunteerHidden;
      }
    }

    // Pour un poste, aucune différence de dashboard entre responsable et co-responsable.
    if (hasPostManagement) {
      placeManagerSectionFirst();
    } else if (unitOnly) {
      placeManagerSectionFirst();
    }
  }

  applyManagementDisplay();

  // dashboard.js est asynchrone et peut terminer après ce contrôleur.
  // On rétablit donc l'état final si un ancien traitement modifie l'affichage ensuite.
  const observer = new MutationObserver(() => applyManagementDisplay());
  observer.observe(personalized, { attributes: true, attributeFilter: ["hidden"] });
  observer.observe(teamSection, { attributes: true, attributeFilter: ["hidden"] });
  observer.observe(volunteerSection, { attributes: true, attributeFilter: ["hidden"] });
  observer.observe(role, { attributes: true, attributeFilter: ["hidden"] });
  if (unitPlanningButton) {
    observer.observe(unitPlanningButton, { attributes: true, attributeFilter: ["hidden"] });
  }

  const parent = teamSection.parentNode;
  if (parent) {
    observer.observe(parent, { childList: true });
  }
})();
