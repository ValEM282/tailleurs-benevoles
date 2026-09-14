/* =========================================================
   PORTAIL BÉNÉVOLES — SÉCURITÉ DES PAGES PRIVÉES
   ========================================================= */

(() => {

  const SUPABASE_URL =
    "https://ftfhtyohyjezoibmumum.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_oQOnxMDMyvx6ukcuJHgWuQ_Gu-utQe3";


  const client = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );


  /* =========================================================
     VÉRIFIE QU'UN UTILISATEUR EST CONNECTÉ
     ========================================================= */

  async function requireAuth() {

    const {
      data,
      error
    } = await client.auth.getUser();


    if (
      error ||
      !data ||
      !data.user
    ) {

      window.location.replace("index.html");

      return null;
    }


    return data.user;
  }


  /* =========================================================
     DÉCONNEXION
     ========================================================= */

  async function logout() {

    const { error } =
      await client.auth.signOut();


    if (error) {

      console.error(
        "Erreur lors de la déconnexion :",
        error
      );

      return false;
    }


    window.location.replace("index.html");

    return true;
  }


  /* =========================================================
     REND LES FONCTIONS DISPONIBLES AUX AUTRES PAGES
     ========================================================= */

  window.PortalAuth = {
    client,
    requireAuth,
    logout
  };

})();
