import "./styles.css";

const menuButton = document.querySelector<HTMLButtonElement>(".menu-toggle");
const menu = document.querySelector<HTMLElement>("#main-nav");

function closeMenu(): void {
  menu?.classList.remove("is-open");
  menuButton?.setAttribute("aria-expanded", "false");
  menuButton?.setAttribute("aria-label", "Mở menu");
}
menuButton?.addEventListener("click", () => {
  const isOpen = menu?.classList.toggle("is-open") ?? false;
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Đóng menu" : "Mở menu");
});
menu?.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});
window.addEventListener("resize", () => {
  if (window.innerWidth > 780) closeMenu();
});

const filters = document.querySelectorAll<HTMLButtonElement>("[data-filter]");
const articleItems = document.querySelectorAll<HTMLElement>("#article-list [data-category]");
const counter = document.querySelector<HTMLElement>("#article-count");
const empty = document.querySelector<HTMLElement>("#empty-results");
filters.forEach((filter) => filter.addEventListener("click", () => {
  const category = filter.dataset.filter;
  let shown = 0;
  filters.forEach((item) => item.classList.toggle("is-active", item === filter));
  articleItems.forEach((item) => {
    const visible = category === "Tất cả" || item.dataset.category === category;
    item.hidden = !visible;
    if (visible) shown++;
  });
  if (counter) counter.textContent = shown + " bài viết";
  if (empty) empty.hidden = shown !== 0;
}));
