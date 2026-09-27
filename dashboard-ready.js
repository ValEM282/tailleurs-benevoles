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
    const volunteerVisible = !volunteerSection.hidden;
    const managerVisible = !teamSection.hidden;

    // Une fois le prénom chargé et au moins un espace déterminé par dashboard.js,
    // le dashboard peut être révélé. Cette règle couvre les 4 combinaisons réelles.
    if (!volunteerVisible && !managerVisible) return false;
    if (!roleText) return false;

    role.hidden = roleText === "Bénévole";
    personalized.hidden = false;
    return true;
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
