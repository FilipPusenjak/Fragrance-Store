/* ============================================================
   Robot Fragrances — interactions
   Progressive enhancement only; site works without JS.
   ============================================================ */
(function () {
  "use strict";

  /* --- Mobile nav toggle --------------------------------- */
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");

  if (header && toggle) {
    toggle.addEventListener("click", function () {
      const open = header.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    // Close the menu after tapping a link
    header.querySelectorAll(".nav-links a").forEach(function (link) {
      link.addEventListener("click", function () {
        header.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* --- Scroll reveal ------------------------------------- */
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    const io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach(function (el) {
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  /* --- Shop filter (demo) -------------------------------- */
  const filterBar = document.querySelector(".filter-bar");
  if (filterBar) {
    const cards = Array.from(document.querySelectorAll("[data-family]"));
    filterBar.addEventListener("click", function (e) {
      const btn = e.target.closest("button[data-filter]");
      if (!btn) return;

      filterBar.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });

      const filter = btn.dataset.filter;
      cards.forEach(function (card) {
        const show = filter === "all" || card.dataset.family === filter;
        card.style.display = show ? "" : "none";
      });
    });
  }

  /* --- Add-to-decant (demo feedback) --------------------- */
  document.querySelectorAll(".product-add").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const original = btn.textContent;
      btn.textContent = "Added ✓";
      btn.disabled = true;
      setTimeout(function () {
        btn.textContent = original;
        btn.disabled = false;
      }, 1400);
    });
  });

  /* --- Demo forms (no backend) --------------------------- */
  document.querySelectorAll("form[data-demo]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const note = form.querySelector("[data-form-note]");
      if (note) {
        note.textContent = "Thank you — this is a demo, so nothing was sent. We'll be in touch soon.";
        note.style.color = "var(--accent)";
      }
      form.reset();
    });
  });

  /* --- Footer year --------------------------------------- */
  const yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
