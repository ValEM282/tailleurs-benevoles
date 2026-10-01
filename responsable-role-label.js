/* Affiche les responsabilités réellement gérées sous le prénom. */
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

  if (!participation || !["responsable", "admin"].includes(participation.role)) return;

  const { data: posts, error } = await client.rpc("get_my_responsible_posts");
  if (error) {
    console.error("Impossible de charger les postes du responsable :", error);
    return;
  }

  const names = [...new Set((posts || []).map(row => row.poste_nom).filter(Boolean))];
  let label = names.join(" · ");

  // Un responsable d'unité n'est pas forcément responsable d'un poste.
  // Dans ce cas, on affiche son unité (Guides, Patro, Pionniers) au lieu
  // de masquer son rôle.
  if (!label && participation.role !== "admin") {
    const { data: scopes, error: scopesError } = await client.rpc("get_my_management_roles");
    if (scopesError) {
      console.error("Impossible de charger les responsabilités d'unité :", scopesError);
      return;
    }

    const units = [...new Set((scopes || [])
      .filter(row => row.kind === "responsable_unite")
      .map(row => row.poste_nom)
      .filter(Boolean))];

    if (units.length) {
      label = `Responsable d’unité : ${units.join(" · ")}`;
    }
  }

  if (!label) {
    if (participation.role !== "admin") roleElement.hidden = true;
    return;
  }

  const applyLabel = () => {
    roleElement.hidden = false;
    if (roleElement.textContent !== label) roleElement.textContent = label;
  };

  applyLabel();

  const observer = new MutationObserver(applyLabel);
  observer.observe(roleElement, { childList: true, characterData: true, subtree: true });
  setTimeout(() => observer.disconnect(), 5000);
})();
