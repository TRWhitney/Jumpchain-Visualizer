(() => {
  const catalogSource = document.querySelector("#strategy-catalog");
  const downloadButton = document.querySelector("#download-strategy-catalog");
  const copyButton = document.querySelector("#copy-strategy-catalog");
  const status = document.querySelector("#catalog-status");
  if (!catalogSource || !downloadButton || !copyButton || !status) return;

  const catalog = JSON.parse(catalogSource.textContent);
  const serialized = `${JSON.stringify(catalog, null, 2)}\n`;

  downloadButton.addEventListener("click", () => {
    const url = URL.createObjectURL(
      new Blob([serialized], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "verification-performance-strategies.json";
    link.click();
    URL.revokeObjectURL(url);
    status.textContent = "Strategy catalog downloaded.";
  });

  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(serialized);
      status.textContent = "Strategy catalog copied.";
    } catch {
      status.textContent =
        "Clipboard access is unavailable; use Download JSON instead.";
    }
  });
})();
