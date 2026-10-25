const saved = localStorage.getItem("numelio-theme");
if (saved === "dark") document.documentElement.classList.add("dark");

document.getElementById("themeBtn")?.addEventListener("click", () => {
  document.documentElement.classList.toggle("dark");
  localStorage.setItem(
    "numelio-theme",
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  );
});

const searchInput = document.getElementById("search");
const noResults = document.getElementById("noResults");
const searchStatus = document.getElementById("searchStatus");

searchInput?.addEventListener("input", event => {
  const query = event.target.value.trim().toLocaleLowerCase("es");
  const cards = [...document.querySelectorAll("#herramientas .card")];
  let visibleCount = 0;

  for (const card of cards) {
    const matches = (card.dataset.name || card.textContent).toLocaleLowerCase("es").includes(query);
    card.hidden = !matches;
    if (matches) visibleCount++;
  }

  if (noResults) noResults.hidden = visibleCount > 0;
  if (searchStatus) {
    searchStatus.hidden = query.length === 0;
    searchStatus.textContent = query
      ? visibleCount === 1
        ? "Se ha encontrado 1 herramienta."
        : `Se han encontrado ${visibleCount} herramientas.`
      : "";
  }
});
