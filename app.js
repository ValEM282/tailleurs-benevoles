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


/* =========================================================
   CONNEXION
   ========================================================= */

loginForm.addEventListener("submit", async (event) => {

  event.preventDefault();

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!email || !password) {
    alert("Indique ton e-mail et ton mot de passe.");
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
      "Connexion impossible. Vérifie ton e-mail et ton mot de passe."
    );

    return;
  }

  alert("Connexion réussie !");

  console.log("Utilisateur connecté :", data.user);

});


/* =========================================================
   CREATION DU COMPTE
   ========================================================= */

createAccountButton.addEventListener("click", async () => {

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!email) {
    alert(
      "Indique d'abord l'e-mail utilisé lors de ton inscription comme bénévole."
    );
    return;
  }

  if (!password) {
    alert(
      "Choisis également le mot de passe que tu souhaites utiliser."
    );
    return;
  }

  if (password.length < 8) {
    alert(
      "Choisis un mot de passe d'au moins 8 caractères."
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
      "Ton compte a été créé et tu es connecté."
    );

  } else {

    alert(
      "Ton compte a été créé. Consulte maintenant ta boîte e-mail pour confirmer ton adresse."
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
      "Indique d'abord ton adresse e-mail."
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
      "Impossible d'envoyer l'e-mail de réinitialisation."
    );

    return;
  }

  alert(
    "Si cette adresse correspond à un compte, un e-mail de réinitialisation vient d'être envoyé."
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
          "Le mot de passe doit contenir au moins 8 caractères."
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
          "Impossible de modifier le mot de passe."
        );

        return;
      }

      alert(
        "Ton mot de passe a bien été modifié."
      );

    }

  }
);
