/* Affiche sur le dashboard les postes réellement gérés par un responsable. */
(async function () {
  if (typeof supabaseClient === "undefined") return;

  const badge = document.getElementById("user-role");
  if (!badge) return;

  const { data: userData } = await supabaseClient.auth.getUser();
  const user = userData?.user;
  if (!user) return;

  const { data: benevole } = await supabaseClient
    .from("benevoles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!benevole) return;

  const { data: participation } = await supabaseClient
    .from("participations")
    .select(`role, editions!inner (active)`)
    .eq("benevole_id", benevole.id)
    .eq("actif", true)
    .eq("editions.active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (participation?.role !== "responsable") return;

  const { data: posts, error } = await supabaseClient.rpc("get_my_responsible_posts");
  if (error) {
    console.error("Impossible de charger les postes du responsable :", error);
    return;
  }

  const names = [...new Set((posts || []).map(row => row.poste_nom).filter(Boolean))];
  if (!names.length) return;

  const label = names.join(" · ");

  const applyLabel = () => {
    if (badge.textContent !== label) badge.textContent = label;
  };

  applyLabel();

  const observer = new MutationObserver(applyLabel);
  observer.observe(badge, { childList: true, characterData: true, subtree: true });
  setTimeout(() => observer.disconnect(), 5000);
})();
