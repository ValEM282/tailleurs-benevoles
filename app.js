const SUPABASE_URL = "https://ftfhtyohyjezoibmumum.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_oQOnxMDMyvx6ukcuJHgWuQ_Gu-utQe3";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


const loginForm = document.getElementById("login-form");
const createAccountButton = document.getElementById("create-account");
const forgotPasswordLink = document.getElementById("forgot-password");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const emailError = document.getElementById("email-error");

const togglePasswordButton =
  document.getElementById("toggle-password");

/* =========================================================
   AFFICHER / MASQUER LE MOT DE PASSE
   ========================================================= */

togglePasswordButton.addEventListener("click", () => {

  const passwordIsHidden =
    passwordInput.type === "password";

  passwordInput.type =
    passwordIsHidden ? "text" : "password";

  togglePasswordButton.textContent =
    passwordIsHidden ? "🙈" : "👀​​​";

  togglePasswordButton.setAttribute(
    "aria-label",
    passwordIsHidden
      ? "Masquer le mot de passe"
      : "Afficher le mot de passe"
  );

  togglePasswordButton.setAttribute(
    "title",
    passwordIsHidden
      ? "Masquer le mot de passe"
      : "Afficher le mot de passe"
  );

});


/* =========================================================
   CONNEXION
   ========================================================= */

loginForm.addEventListener("submit", async (event) => {

  event.preventDefault();

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!email || !password) {
    alert("Indique ton e-mail et ton mot de passe");
    return;
  }

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    console.error(error);

    alert(
      "Connexion impossible ! Vérifie ton e-mail et ton mot de passe ou crée ton accès pour la première fois"
    );

    return;
  }

window.location.href = "dashboard.html";

});


/* =========================================================
   CREATION DU COMPTE
   ========================================================= */

createAccountButton.addEventListener("click", async () => {

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

if (!email) {
  emailError.textContent =
    "Indique d'abord l'e-mail utilisé lors de ton inscription comme bénévole, et ensuite choisis un mot de passe en 8 caractères";

  emailInput.focus();

  return;
}

emailError.textContent = "";

  if (!password) {
    alert(
      "Choisis également un mot de passe de 8 caractères"
    );
    return;
  }

  if (password.length < 8) {
    alert(
      "Choisis un mot de passe d'au moins 8 caractères !"
    );
    return;
  }

  const { data, error } =
    await supabaseClient.auth.signUp({

      email,
      password,

      options: {
        emailRedirectTo:
          "https://valem282.github.io/tailleurs-benevoles/"
      }

    });

  if (error) {

    console.error(error);

    alert(error.message);

    return;
  }

  if (data.session) {

    alert(
      "Ton compte a été créé et tu es connecté"
    );

  } else {

    alert(
      "Ton compte a été créé, consulte maintenant ta boîte mail pour confirmer"
    );

  }

});


/* =========================================================
   MOT DE PASSE OUBLIE
   ========================================================= */

forgotPasswordLink.addEventListener("click", async (event) => {

  event.preventDefault();

  const email = emailInput.value.trim().toLowerCase();

  if (!email) {

    alert(
      "Indique d'abord ton e-mail"
    );

    return;
  }

  const { error } =
    await supabaseClient.auth.resetPasswordForEmail(
      email,
      {
        redirectTo:
          "https://valem282.github.io/tailleurs-benevoles/"
      }
    );

  if (error) {

    console.error(error);

    alert(
      "Impossible d'envoyer le mail de réinitialisation"
    );

    return;
  }

  alert(
    "Si cet e-mail correspond à un compte, un mail de réinitialisation vient d'être envoyé"
  );

});


/* =========================================================
   RETOUR APRES REINITIALISATION DU MOT DE PASSE
   ========================================================= */

supabaseClient.auth.onAuthStateChange(
  async (event, session) => {

    if (event === "PASSWORD_RECOVERY") {

      const newPassword = prompt(
        "Choisis ton nouveau mot de passe :"
      );

      if (!newPassword) {
        return;
      }

      if (newPassword.length < 8) {

        alert(
          "Le mot de passe doit contenir au moins 8 caractères"
        );

        return;
      }

      const { error } =
        await supabaseClient.auth.updateUser({
          password: newPassword
        });

      if (error) {

        console.error(error);

        alert(
          "Impossible de modifier le mot de passe"
        );

        return;
      }

      alert(
        "Ton mot de passe a bien été modifié"
      );

    }

  }
);
