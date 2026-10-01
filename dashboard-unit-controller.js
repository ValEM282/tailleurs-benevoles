/* Contrôle d'affichage des responsables d'unité.
   Réutilise le client Supabase créé par dashboard.js et garantit que
   l'ancien affichage ne peut pas remasquer l'espace Responsable. */
(async function () {
  if (typeof supabaseClient === "undefined") return;

  const personalized = document.getElementById("dashboard-personalized");
  const teamSection = document.getElementById("team-menu-section");
  const volunteerSection = document.getElementById("volunteer-next-shift-section");
  const role = document.getElementById("user-role");

  if (!personalized || !teamSection || !volunteerSection || !role) return;

  const { data: scopes, error: scopesError } = await supabaseClient.rpc("get_my_management_roles");
  if (scopesError) {
    console.error("Impossible de charger les responsabilités d’unité :", scopesError);
    return;
  }

  const allScopes = Array.isArray(scopes) ? scopes : [];
  const units = [...new Set(
    allScopes
      .filter(item => item.kind === "responsable_unite")
      .map(item => item.poste_nom)
      .filter(Boolean)
  )];

  if (!units.length) return;

  const hasPostManagement = allScopes.some(item =>
    item.kind === "responsable" || item.kind === "co_responsable"
  );
  const unitOnly = !hasPostManagement;

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

  function applyUnitDisplay() {
    if (personalized.hidden) personalized.hidden = false;
    if (teamSection.hidden) teamSection.hidden = false;

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

    if (unitOnly) {
      if (volunteerSection.hidden !== expectedVolunteerHidden) {
        volunteerSection.hidden = expectedVolunteerHidden;
      }

      const parent = teamSection.parentNode;
      if (parent && teamSection.nextElementSibling !== volunteerSection) {
        parent.insertBefore(teamSection, volunteerSection);
      }
    }
  }

  applyUnitDisplay();

  // dashboard.js est asynchrone et peut terminer après ce contrôleur.
  // On surveille uniquement les attributs concernés et on rétablit l'état correct
  // si un ancien traitement tente de le modifier ensuite.
  const observer = new MutationObserver(() => applyUnitDisplay());
  observer.observe(personalized, { attributes: true, attributeFilter: ["hidden"] });
  observer.observe(teamSection, { attributes: true, attributeFilter: ["hidden"] });
  observer.observe(volunteerSection, { attributes: true, attributeFilter: ["hidden"] });
  observer.observe(role, { attributes: true, attributeFilter: ["hidden"] });
})();
