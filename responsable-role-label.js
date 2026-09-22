/* Affiche les responsabilités réelles à la place du libellé générique « Responsable de poste ». */
(async function () {
  const roleElement = document.getElementById("user-role");
  if (!roleElement || typeof supabase === "undefined") return;

  const client = supabase.createClient(
    "https://ftfhtyohyjezoibmumum.supabase.co",
    "sb_publishable_oQOnxMDMyvx6ukcuJHgWuQ_Gu-utQe3"
  );

  const { data: userData } = await client.auth.getUser();
  const user = userData?.user;
  if (!user) return;

  const { data: personne } = await client
    .from("benevoles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!personne) return;

  const { data: participation } = await client
    .from("participations")
    .select("role, fonction_orga, editions!inner(active)")
    .eq("benevole_id", personne.id)
    .eq("actif", true)
    .eq("editions.active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (participation?.role === "responsable" && participation.fonction_orga) {
    roleElement.hidden = false;
    roleElement.textContent = participation.fonction_orga;
  }
})();
