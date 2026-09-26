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
const volunteerAddButton = document.getElementById("admin-volunteer-add");
const youthUnitSearch = document.getElementById("youth-unit-search");
const youthSearchButton = document.getElementById("admin-youth-search");
const volunteerCreatePanel = document.getElementById("admin-volunteer-create-panel");
const volunteerCreateForm = document.getElementById("admin-volunteer-create-form");
const volunteerCreateCancel = document.getElementById("admin-volunteer-create-cancel");
const volunteerCreateError = document.getElementById("admin-volunteer-create-error");
const volunteerFirstname = document.getElementById("new-volunteer-firstname");
const volunteerLastname = document.getElementById("new-volunteer-lastname");
const volunteerPhone = document.getElementById("new-volunteer-phone");
const volunteerEmail = document.getElementById("new-volunteer-email");
const volunteerTshirt = document.getElementById("new-volunteer-tshirt");
const volunteerTailloux = document.getElementById("new-volunteer-tailloux");

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

function setVolunteerCreateOpen(open) {
  volunteerCreatePanel.hidden = !open;
  volunteerAddButton.setAttribute("aria-expanded", String(open));
  volunteerCreateError.hidden = true;
  volunteerCreateError.textContent = "";

  if (open) {
    volunteerFirstname.focus();
  } else {
    volunteerCreateForm.reset();
    volunteerAddButton.focus();
  }
}

function showVolunteerCreateError(message, input) {
  volunteerCreateError.textContent = message;
  volunteerCreateError.hidden = false;
  if (input) input.focus();
}

function formatBelgianPhoneDigits(digits) {
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8), digits.slice(8, 10)]
    .filter(Boolean)
    .join(" ");
}

function formatVolunteerPhoneInput(input) {
  const original = input.value;
  const phone = original.trimStart();
  if (phone.startsWith("+") || phone.startsWith("00")) return;

  const cursor = input.selectionStart ?? original.length;
  const digitsBeforeCursor = original.slice(0, cursor).replace(/\D/g, "").length;
  const formatted = formatBelgianPhoneDigits(original.replace(/\D/g, "").slice(0, 10));
  if (formatted === original) return;

  input.value = formatted;
  let newCursor = 0;
  let digitsSeen = 0;
  while (newCursor < formatted.length && digitsSeen < digitsBeforeCursor) {
    if (/\d/.test(formatted[newCursor])) digitsSeen += 1;
    newCursor += 1;
  }
  input.setSelectionRange(cursor === original.length ? formatted.length : newCursor, cursor === original.length ? formatted.length : newCursor);
}

function normalizeVolunteerPhone(value) {
  const phone = value.trim();
  if (!phone) return { value: null };

  if (phone.startsWith("+") || phone.startsWith("00")) {
    return phone.startsWith("+32") || phone.startsWith("0032")
      ? { error: "Un numéro belge doit être au format 04XX XX XX XX." }
      : { value: phone };
  }

  const digits = phone.replace(/\D/g, "");
  if (!/^04\d{8}$/.test(digits)) {
    return { error: "Format attendu : 04XX XX XX XX (sauf indicatif étranger)." };
  }

  return { value: formatBelgianPhoneDigits(digits) };
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

if (youthSearchButton) {
  youthSearchButton.addEventListener("click", () => {
    const params = new URLSearchParams({ mouvement: "jeunesse" });
    if (youthUnitSearch?.value) params.set("unite", youthUnitSearch.value);
    window.location.href = `benevoles-liste.html?${params.toString()}`;
  });
}

for (let count = 0; count <= 25; count += 1) {
  const option = document.createElement("option");
  option.value = String(count);
  option.textContent = String(count);
  volunteerTailloux.appendChild(option);
}

volunteerAddButton.addEventListener("click", () => {
  setVolunteerCreateOpen(volunteerCreatePanel.hidden);
});

volunteerCreateCancel.addEventListener("click", () => {
  setVolunteerCreateOpen(false);
});

volunteerLastname.addEventListener("change", () => {
  volunteerLastname.value = volunteerLastname.value.trim().toLocaleUpperCase("fr");
});

volunteerPhone.addEventListener("input", () => {
  formatVolunteerPhoneInput(volunteerPhone);
});

volunteerCreateForm.addEventListener("submit", async event => {
  event.preventDefault();

  const prenom = volunteerFirstname.value.trim();
  const nom = volunteerLastname.value.trim().toLocaleUpperCase("fr");
  const email = volunteerEmail.value.trim().toLowerCase();
  const tshirt = volunteerTshirt.value;
  const tailloux = Number(volunteerTailloux.value);
  const phone = normalizeVolunteerPhone(volunteerPhone.value);
  volunteerLastname.value = nom;
  if (!phone.error) volunteerPhone.value = phone.value || "";

  if (!prenom || !nom) {
    showVolunteerCreateError("Indique le prénom et le nom du bénévole.", !prenom ? volunteerFirstname : volunteerLastname);
    return;
  }

  if (phone.error) {
    showVolunteerCreateError(phone.error, volunteerPhone);
    return;
  }

  if (!tshirt || volunteerTailloux.value === "" || !Number.isInteger(tailloux) || tailloux < 0 || tailloux > 25) {
    showVolunteerCreateError("Choisis un T-shirt et un nombre de Tailloux entre 0 et 25.", !tshirt ? volunteerTshirt : volunteerTailloux);
    return;
  }

  volunteerCreateError.hidden = true;
  const submit = volunteerCreateForm.querySelector('[type="submit"]');
  submit.disabled = true;
  volunteerCreateCancel.disabled = true;

  try {
    const { error } = await PortalAuth.client.rpc("admin_create_benevole", {
      p_prenom: prenom,
      p_nom: nom,
      p_telephone: phone.value,
      p_email: email,
      p_tshirt: tshirt,
      p_tailloux: tailloux
    });

    if (error) {
      console.error("Impossible de créer le bénévole :", error);
      showVolunteerCreateError(error.code === "23505"
        ? "Cette adresse e-mail est déjà utilisée par un autre bénévole."
        : error.message || "Impossible de créer le bénévole pour le moment.");
      return;
    }

    const params = new URLSearchParams({ prenom, nom });
    window.location.href = `benevoles-liste.html?${params.toString()}`;
  } catch (error) {
    console.error("Impossible de créer le bénévole :", error);
    showVolunteerCreateError("Impossible de créer le bénévole pour le moment.");
  } finally {
    submit.disabled = false;
    volunteerCreateCancel.disabled = false;
  }
});

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
