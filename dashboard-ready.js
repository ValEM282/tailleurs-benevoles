/* Empêche le flash d'un contenu de rôle incorrect pendant le chargement du dashboard. */
(function () {
  const personalized = document.getElementById("dashboard-personalized");
  const firstname = document.getElementById("user-firstname");
  const role = document.getElementById("user-role");
  const volunteerSection = document.getElementById("volunteer-next-shift-section");
  const teamSection = document.getElementById("team-menu-section");

  if (!personalized || !firstname || !role || !volunteerSection || !teamSection) return;

  function isLoaded() {
    return firstname.textContent.trim() && firstname.textContent.trim() !== "...";
  }

  function revealIfReady() {
    if (!isLoaded()) return false;

    const roleText = role.textContent.trim();

    // Bénévole : le bloc bénévole est prêt et le libellé du rôle reste masqué.
    if (!volunteerSection.hidden && teamSection.hidden && roleText === "Bénévole") {
      role.hidden = true;
      personalized.hidden = false;
      return true;
    }

    // Admin : il cumule maintenant aussi l'encadré bénévole.
    if (!volunteerSection.hidden && !teamSection.hidden && roleText.startsWith("Administration")) {
      role.hidden = false;
      personalized.hidden = false;
      return true;
    }

    // Responsable / co-responsable : les deux encadrés sont affichés.
    // Le libellé peut être détaillé par dashboard.js (Responsable / Co-responsable + postes).
    if (
      !volunteerSection.hidden &&
      !teamSection.hidden &&
      roleText &&
      roleText !== "Responsable de poste" &&
      roleText !== "Responsable"
    ) {
      role.hidden = false;
      personalized.hidden = false;
      return true;
    }

    return false;
  }

  if (revealIfReady()) return;

  const observer = new MutationObserver(() => {
    if (revealIfReady()) observer.disconnect();
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["hidden"]
  });
})();
