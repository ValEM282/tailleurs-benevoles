/* Affiche le bouton ADMIN uniquement aux admins actifs du portail. */
(async function () {
  const button = document.getElementById("admin-portal-button");
  if (!button || typeof supabase === "undefined") return;

  const client = supabase.createClient(
    "https://ftfhtyohyjezoibmumum.supabase.co",
    "sb_publishable_oQOnxMDMyvx6ukcuJHgWuQ_Gu-utQe3"
  );

  const { data: userData } = await client.auth.getUser();
  if (!userData?.user) return;

  const { data: isAdmin, error } = await client.rpc("is_current_portal_admin");
  if (error) {
    console.error("Impossible de vérifier l'accès ADMIN :", error);
    return;
  }

  button.hidden = !isAdmin;
})();
