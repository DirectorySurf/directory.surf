(function () {
  "use strict";

  var STORAGE_KEY = "directorySurf:savedDirectories";

  function readStore() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeStore(store) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      // localStorage unavailable (private browsing, disabled storage) -- saving silently no-ops.
    }
  }

  function list() {
    return Object.keys(readStore());
  }

  function has(slug) {
    return !!readStore()[slug];
  }

  function toggle(slug) {
    var store = readStore();
    var saved = !store[slug];
    if (saved) {
      store[slug] = true;
    } else {
      delete store[slug];
    }
    writeStore(store);
    return saved;
  }

  function syncNavCount() {
    var count = list().length;
    document.querySelectorAll("[data-saved-count]").forEach(function (el) {
      el.textContent = count ? "(" + count + ")" : "";
      el.hidden = count === 0;
    });
  }

  function sync(root) {
    (root || document).querySelectorAll("[data-save-toggle]").forEach(function (btn) {
      var saved = has(btn.getAttribute("data-save-slug"));
      btn.classList.toggle("is-saved", saved);
      btn.setAttribute("aria-pressed", saved ? "true" : "false");
    });
    syncNavCount();
  }

  // Mirrors layouts/partials/save-button.html so cards/rows rendered client-side here and in
  // directory-tabs.js's table search results get the same toggle as server-rendered pages.
  // Exposed on window.SavedDirectories so directory-tabs.js doesn't need its own copy.
  function buildSaveButton(slug, title) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "save-toggle";
    btn.setAttribute("data-save-toggle", "");
    btn.setAttribute("data-save-slug", slug);
    btn.setAttribute("aria-label", "Save " + title + " for later");
    btn.title = "Save for later";
    btn.innerHTML =
      '<svg class="save-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M6.5 3.5h11a1 1 0 0 1 1 1V20l-6.5-4-6.5 4V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
      "</svg>";
    return btn;
  }

  // Mirrors layouts/partials/directory-cards.html's markup so /saved/ looks like the rest of
  // the site. `item` comes from /directories.json (see layouts/index.directories.json).
  function buildCard(item) {
    var a = document.createElement("a");
    a.className = "directory-card";
    a.href = item.url;

    var header = document.createElement("div");
    header.className = "directory-card-header";

    var host = "";
    try {
      host = new URL(item.website).host;
    } catch (e) {
      // leave host blank -- the favicon service just returns a generic icon for it
    }
    var img = document.createElement("img");
    img.className = "favicon";
    img.width = 16;
    img.height = 16;
    img.loading = "lazy";
    img.alt = "";
    img.src = "https://www.google.com/s2/favicons?sz=64&domain=" + encodeURIComponent(host);
    header.appendChild(img);

    var title = document.createElement("span");
    title.className = "directory-card-title";
    title.textContent = item.title;
    header.appendChild(title);

    var dr = document.createElement("span");
    dr.className = "directory-card-dr";
    dr.textContent = "DR " + item.ahrefs_dr;
    header.appendChild(dr);

    header.appendChild(buildSaveButton(item.slug, item.title));
    a.appendChild(header);

    var desc = document.createElement("p");
    desc.className = "directory-card-desc";
    desc.textContent = item.description;
    a.appendChild(desc);

    var meta = document.createElement("div");
    meta.className = "directory-card-meta";
    (item.categories || []).forEach(function (cat) {
      var span = document.createElement("span");
      span.className = "badge badge-category";
      var iconSpan = document.createElement("span");
      iconSpan.className = "badge-icon";
      iconSpan.innerHTML = cat.icon || "";
      span.appendChild(iconSpan);
      span.appendChild(document.createTextNode(cat.title));
      meta.appendChild(span);
    });

    var price = item.pricing || {};
    var priceBadge = document.createElement("span");
    if (price.free_available && parseFloat(price.starting_price) === 0) {
      priceBadge.className = "badge badge-free";
      priceBadge.textContent = "Free";
    } else if (price.free_available) {
      priceBadge.className = "badge badge-free";
      priceBadge.textContent = "Free tier";
    } else {
      priceBadge.className = "badge";
      priceBadge.textContent = "From $" + price.starting_price + "/" + price.price_period;
    }
    meta.appendChild(priceBadge);
    a.appendChild(meta);

    return a;
  }

  function renderSavedPage() {
    var container = document.querySelector("[data-saved-list]");
    if (!container) return;

    var empty = document.querySelector("[data-saved-empty]");
    var indexUrl = container.getAttribute("data-index-url");
    var cachedItems = null;
    var fetchStarted = false;

    function ensureFetched() {
      if (fetchStarted) return;
      fetchStarted = true;
      fetch(indexUrl)
        .then(function (res) {
          return res.ok ? res.json() : Promise.reject(new Error("bad response"));
        })
        .then(function (items) {
          cachedItems = items;
          render();
        })
        .catch(function () {
          container.innerHTML = '<p class="table-empty">Couldn’t load saved directories. Try again later.</p>';
        });
    }

    function render() {
      var slugs = list();
      if (!slugs.length) {
        container.innerHTML = "";
        if (empty) empty.hidden = false;
        return;
      }
      if (!cachedItems) {
        ensureFetched();
        return;
      }
      var matched = cachedItems.filter(function (item) {
        return slugs.indexOf(item.slug) !== -1;
      });
      container.innerHTML = "";
      if (!matched.length) {
        if (empty) empty.hidden = false;
        return;
      }
      if (empty) empty.hidden = true;
      var wrap = document.createElement("div");
      wrap.className = "directory-cards";
      matched.forEach(function (item) {
        wrap.appendChild(buildCard(item));
      });
      container.appendChild(wrap);
      sync(container);
    }

    render();
    document.addEventListener("saveddirectories:change", render);
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest("[data-save-toggle]") : null;
    if (!btn) return;
    var slug = btn.getAttribute("data-save-slug");
    if (!slug) return;
    e.preventDefault();
    e.stopPropagation();
    var saved = toggle(slug);
    sync(document);
    document.dispatchEvent(new CustomEvent("saveddirectories:change", { detail: { slug: slug, saved: saved } }));
  });

  document.addEventListener("DOMContentLoaded", function () {
    sync(document);
    renderSavedPage();
  });

  window.SavedDirectories = {
    list: list,
    has: has,
    toggle: toggle,
    sync: sync,
    buildSaveButton: buildSaveButton,
  };
})();
