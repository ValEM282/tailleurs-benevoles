/* Liens de navigation des lieux — source unique : table public.lieux */

(() => {
  const SUPABASE_URL = "https://ftfhtyohyjezoibmumum.supabase.co";
  const SUPABASE_KEY = "sb_publishable_oQOnxMDMyvx6ukcuJHgWuQ_Gu-utQe3";

  const client = window.PortalAuth?.client || window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_KEY);
  if (!client) return;

  let linksByName = new Map();
  let loaded = false;

  function normalize(value) {
    return String(value || "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("fr");
  }

  function isPlanLink(anchor) {
    const href = anchor.getAttribute("href") || "";
    return href === "plan.html" || href.endsWith("/plan.html");
  }

  function makePastLocationStatic(anchor) {
    const span = document.createElement("span");
    span.className = `${anchor.className || ""} schedule-shift-location-static`.trim();
    span.textContent = anchor.textContent;
    anchor.replaceWith(span);
  }

  function applyLinks(root = document) {
    if (!loaded) return;

    root.querySelectorAll?.('a[href]').forEach(anchor => {
      if (!isPlanLink(anchor) && anchor.dataset.googleMapsLieu !== "true") return;

      if (anchor.closest(".schedule-shift-card-past")) {
        makePastLocationStatic(anchor);
        return;
      }

      if (!isPlanLink(anchor)) return;

      const url = linksByName.get(normalize(anchor.textContent));
      if (!url) return;

      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener";
      anchor.dataset.googleMapsLieu = "true";
      anchor.title = "Ouvrir l’itinéraire dans Google Maps";
    });
  }

  async function loadLinks() {
    const { data, error } = await client.rpc("get_lieux_navigation_links");
    if (error) {
      console.error("Impossible de charger les liens Google Maps des lieux :", error);
      return;
    }

    linksByName = new Map(
      (Array.isArray(data) ? data : [])
        .filter(lieu => lieu.google_maps_url)
        .map(lieu => [normalize(lieu.nom), lieu.google_maps_url])
    );
    loaded = true;
    applyLinks(document);
  }

  const observer = new MutationObserver(mutations => {
    if (!loaded) return;
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.('a[href]')) applyLinks(node.parentElement || document);
        else applyLinks(node);
      });
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  loadLinks();
})();
