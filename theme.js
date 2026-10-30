"use strict";

(() => {
  const storageKey = "kodlox.theme";
  const root = document.documentElement;
  const lightStyles = document.getElementById("light-theme");
  const darkStyles = document.getElementById("dark-theme");
  const themeColor = document.querySelector('meta[name="theme-color"]');

  function savedTheme() {
    try {
      return localStorage.getItem(storageKey) === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  }

  function applyTheme(theme) {
    const dark = theme === "dark";
    root.dataset.theme = dark ? "dark" : "light";
    lightStyles.media = dark ? "not all" : "all";
    darkStyles.media = dark ? "all" : "not all";
    themeColor.content = dark ? "#141416" : "#fffdf5";

    const button = document.getElementById("theme-toggle");
    if (button) {
      const label = dark ? "Включить светлую тему" : "Включить тёмную тему";
      button.setAttribute("aria-pressed", String(dark));
      button.setAttribute("aria-label", label);
      button.title = label;
    }
  }

  // Restore the selected stylesheet before the page body is rendered.
  applyTheme(savedTheme());

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(root.dataset.theme);
    document.getElementById("theme-toggle").addEventListener("click", () => {
      const theme = root.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(theme);
      try {
        localStorage.setItem(storageKey, theme);
      } catch {
        // Switching still works when browser storage is unavailable.
      }
    });
  });

  window.addEventListener("storage", (event) => {
    if (event.key === storageKey || event.key === null) {
      applyTheme(savedTheme());
    }
  });
})();
