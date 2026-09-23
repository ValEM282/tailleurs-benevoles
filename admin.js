/* Administration du portail — accès admin + PIN personnel */

const adminLoading = document.getElementById("admin-loading");
const adminError = document.getElementById("admin-error");
const createSection = document.getElementById("admin-pin-create");
const unlockSection = document.getElementById("admin-pin-unlock");
const adminContent = document.getElementById("admin-content");
const logoutButton = document.getElementById("logout-button");
const createForm = document.getElementById("admin-pin-create-form");
const unlockForm = document.getElementById("admin-pin-unlock-form");
const newPinInput = document.getElementById("new-admin-pin");
const confirmPinInput = document.getElementById("confirm-admin-pin");
const pinInput = document.getElementById("admin-pin");
const lockMessage = document.getElementById("admin-lock-message");
const volunteerListButton = document.getElementById("admin-volunteer-list");
const volunteerSearchButton = document.getElementById("admin-volunteer-search");
const volunteerSearchFirstname = document.getElementById("volunteer-search-firstname");
const volunteerSearchLastname = document.getElementById("volunteer-search-lastname");

let currentUser = null;
const unlockDurationMs = 30 * 60 * 1000;

function hideAllPanels() {
  adminLoading.hidden = true;
  adminError.hidden = true;
  createSection.hidden = true;
  unlockSection.hidden = true;
  adminContent.hidden = true;
}

function showError(message) {
  hideAllPanels();
  adminError.textContent = message;
  adminError.hidden = false;
}

function unlockStorageKey() {
  return currentUser ? `portalAdminUnlockedUntil:${currentUser.id}` : "";
}

function isLocallyUnlocked() {
  if (!currentUser) return false;
  const until = Number(sessionStorage.getItem(unlockStorageKey()) || 0);
  return until > Date.now();
}

function storeUnlockedSession() {
  sessionStorage.setItem(unlockStorageKey(), String(Date.now() + unlockDurationMs));
}

function clearUnlockedSession() {
  if (currentUser) sessionStorage.removeItem(unlockStorageKey());
}

function showAdminContent() {
  hideAllPanels();
  adminContent.hidden = false;
}

function formatLockedUntil(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-BE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Brussels"
  }).format(new Date(value));
}

function openVolunteerSearch() {
  const prenom = (volunteerSearchFirstname?.value || "").trim();
  const nom = (volunteerSearchLastname?.value || "").trim();

  const params = new URLSearchParams();
  if (prenom) params.set("prenom", prenom);
  if (nom) params.set("nom", nom);

  const query = params.toString();
  window.location.href = query
    ? `benevoles-liste.html?${query}`
    : "benevoles-liste.html";
}

async function loadAdminPage() {
  adminLoading.hidden = false;

  const user = await PortalAuth.requireAuth();
  if (!user) return;
  currentUser = user;

  const { data: isAdmin, error: roleError } = await PortalAuth.client.rpc("is_current_portal_admin");
  if (roleError || !isAdmin) {
    showError("Cette page est réservée aux administrateurs du portail.");
    return;
  }

  const { data, error } = await PortalAuth.client.rpc("get_admin_pin_status");
  if (error) {
    console.error("Impossible de lire l'état du PIN administrateur :", error);
    showError("Impossible de vérifier la configuration du PIN administrateur.");
    return;
  }

  const status = data?.[0] || { configured: false, locked_until: null };

  if (status.configured && isLocallyUnlocked()) {
    showAdminContent();
    return;
  }

  hideAllPanels();

  if (!status.configured) {
    createSection.hidden = false;
    newPinInput.focus();
    return;
  }

  unlockSection.hidden = false;
  if (status.locked_until && new Date(status.locked_until).getTime() > Date.now()) {
    pinInput.disabled = true;
    unlockForm.querySelector("button").disabled = true;
    lockMessage.textContent = `Trop de tentatives incorrectes. Réessaie après ${formatLockedUntil(status.locked_until)}.`;
    lockMessage.hidden = false;
  } else {
    pinInput.focus();
  }
}

createForm.addEventListener("submit", async event => {
  event.preventDefault();

  const pin = newPinInput.value.trim();
  const confirmation = confirmPinInput.value.trim();

  if (!/^\d{6,12}$/.test(pin)) {
    alert("Le PIN doit contenir entre 6 et 12 chiffres.");
    return;
  }

  if (pin !== confirmation) {
    alert("Les deux PIN ne correspondent pas.");
    confirmPinInput.focus();
    return;
  }

  const submit = createForm.querySelector("button");
  submit.disabled = true;

  const { error } = await PortalAuth.client.rpc("set_admin_pin", { p_pin: pin });
  if (error) {
    console.error("Impossible d'enregistrer le PIN administrateur :", error);
    submit.disabled = false;
    alert("Impossible d'enregistrer le PIN pour le moment.");
    return;
  }

  newPinInput.value = "";
  confirmPinInput.value = "";
  storeUnlockedSession();
  showAdminContent();
});

unlockForm.addEventListener("submit", async event => {
  event.preventDefault();

  const pin = pinInput.value.trim();
  if (!/^\d{6,12}$/.test(pin)) {
    alert("Saisis ton PIN administrateur.");
    return;
  }

  const submit = unlockForm.querySelector("button");
  submit.disabled = true;
  pinInput.disabled = true;
  lockMessage.hidden = true;

  const { data, error } = await PortalAuth.client.rpc("verify_admin_pin", { p_pin: pin });
  if (error) {
    console.error("Impossible de vérifier le PIN administrateur :", error);
    submit.disabled = false;
    pinInput.disabled = false;
    alert("Impossible de vérifier le PIN pour le moment.");
    return;
  }

  const result = data?.[0] || { success: false, locked_until: null };
  pinInput.value = "";

  if (result.success) {
    storeUnlockedSession();
    showAdminContent();
    return;
  }

  if (result.locked_until) {
    lockMessage.textContent = `Trop de tentatives incorrectes. Réessaie après ${formatLockedUntil(result.locked_until)}.`;
    lockMessage.hidden = false;
    return;
  }

  submit.disabled = false;
  pinInput.disabled = false;
  lockMessage.textContent = "PIN incorrect.";
  lockMessage.hidden = false;
  pinInput.focus();
});

if (volunteerListButton) {
  volunteerListButton.addEventListener("click", () => {
    window.location.href = "benevoles-liste.html";
  });
}

if (volunteerSearchButton) {
  volunteerSearchButton.addEventListener("click", openVolunteerSearch);
}

[volunteerSearchFirstname, volunteerSearchLastname].forEach(input => {
  if (!input) return;
  input.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    openVolunteerSearch();
  });
});

logoutButton.addEventListener("click", async () => {
  clearUnlockedSession();
  logoutButton.disabled = true;
  logoutButton.textContent = "Déconnexion...";
  const success = await PortalAuth.logout();
  if (!success) {
    logoutButton.disabled = false;
    logoutButton.textContent = "Se déconnecter";
  }
});

loadAdminPage();
