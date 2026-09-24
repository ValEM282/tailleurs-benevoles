(() => {
  const root = document.getElementById("now-groups");
  if (!root) return;

  function formatHeaders() {
    root.querySelectorAll(".now-group-title").forEach(title => {
      if (title.dataset.currentHeaderFormatted === "true") return;

      const raw = (title.textContent || "").trim();
      const separatorIndex = raw.indexOf(" · ");
      if (separatorIndex < 0) return;

      const post = raw.slice(0, separatorIndex).trim();
      const place = raw.slice(separatorIndex + 3).trim() || "Lieu à confirmer";

      const main = document.createElement("span");
      main.className = "current-title-main";

      const postName = document.createElement("span");
      postName.className = "current-title-post";
      postName.textContent = post;

      const placeName = document.createElement("span");
      placeName.className = "current-title-place";
      placeName.textContent = place;

      main.append(postName, placeName);
      title.replaceChildren(main);
      title.classList.add("current-group-title");
      title.dataset.currentHeaderFormatted = "true";
    });
  }

  const observer = new MutationObserver(formatHeaders);
  observer.observe(root, { childList: true, subtree: true });
  formatHeaders();
})();
