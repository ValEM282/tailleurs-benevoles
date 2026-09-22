/* Affiche les postes réellement gérés à la place du libellé générique Responsable. */
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
    .select("role, editions!inner(active)")
    .eq("benevole_id", personne.id)
    .eq("actif", true)
    .eq("editions.active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (participation?.role !== "responsable") return;

  const { data: posts, error } = await client.rpc("get_my_responsible_posts");
  if (error) {
    console.error("Impossible de charger les postes du responsable :", error);
    return;
  }

  const names = [...new Set((posts || []).map(row => row.poste_nom).filter(Boolean))];
  if (!names.length) return;

  const label = names.join(" · ");
  const applyLabel = () => {
    roleElement.hidden = false;
    if (roleElement.textContent !== label) roleElement.textContent = label;
  };

  applyLabel();

  const observer = new MutationObserver(applyLabel);
  observer.observe(roleElement, { childList: true, characterData: true, subtree: true });
  setTimeout(() => observer.disconnect(), 5000);
})();
