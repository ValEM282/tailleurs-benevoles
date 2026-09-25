/* Liste des bénévoles — NOM Prénom, tri alphabétique par NOM, sans téléphone. */
(() => {
  if (!window.PortalAuth?.client?.rpc) return;

  const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });
  const originalRpc = PortalAuth.client.rpc.bind(PortalAuth.client);

  PortalAuth.client.rpc = async function (functionName, args) {
    const result = await originalRpc(functionName, args);

    if (functionName !== "admin_get_need_candidates" || !Array.isArray(result?.data)) {
      return result;
    }

    result.data = [...result.data]
      .sort((a, b) => {
        const byName = collator.compare(String(a.nom || ""), String(b.nom || ""));
        if (byName !== 0) return byName;
        return collator.compare(String(a.prenom || ""), String(b.prenom || ""));
      })
      .map(row => {
        const nom = String(row.nom || "").trim().toUpperCase();
        const prenom = String(row.prenom || "").trim();

        return {
          ...row,
          prenom: `${nom} ${prenom}`.trim(),
          nom: "",
          telephone: ""
        };
      });

    return result;
  };
})();
