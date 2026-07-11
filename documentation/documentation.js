(() => {
  const article = document.querySelector(".document article");
  const tableOfContents = document.querySelector("#table-of-contents");

  if (!article || !tableOfContents) {
    return;
  }

  const slugCounts = new Map();
  const headings = [...article.querySelectorAll("h2, h3")]
    .filter((heading) => !heading.closest("[data-toc-ignore]"));
  const tocList = document.createElement("ol");
  tocList.className = "toc-list";

  const createSlug = (text) => {
    const base = text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/[\s-]+/g, "-") || "section";
    const count = slugCounts.get(base) || 0;
    slugCounts.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };

  headings.forEach((heading) => {
    const label = heading.textContent.trim();
    heading.id = heading.id || createSlug(label);

    const anchor = document.createElement("a");
    anchor.className = "heading-anchor";
    anchor.href = `#${heading.id}`;
    anchor.setAttribute("aria-label", `Link to ${label}`);
    anchor.textContent = "#";
    heading.append(anchor);

    const item = document.createElement("li");
    item.className = `toc-level-${heading.tagName.slice(1)}`;

    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = label;
    item.append(link);
    tocList.append(item);
  });

  tableOfContents.replaceChildren(tocList);

  if (!("IntersectionObserver" in window)) {
    return;
  }

  const linksById = new Map(
    [...tocList.querySelectorAll("a")].map((link) => [
      decodeURIComponent(link.hash.slice(1)),
      link,
    ]),
  );

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

      if (!visible) {
        return;
      }

      linksById.forEach((link) => link.removeAttribute("aria-current"));
      linksById.get(visible.target.id)?.setAttribute("aria-current", "location");
    },
    { rootMargin: "0px 0px -75%", threshold: 0 },
  );

  headings.forEach((heading) => observer.observe(heading));
})();
