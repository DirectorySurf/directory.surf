(function () {
  "use strict";

  function initTabs(root) {
    var panel = root.querySelector("[data-tab-panel]");
    var links = Array.prototype.slice.call(root.querySelectorAll("[data-tab-link]"));
    var more = root.querySelector("[data-tab-more]");
    var moreToggle = root.querySelector("[data-tab-more-toggle]");
    var moreMenu = root.querySelector("[data-tab-more-menu]");
    var moreLabel = root.querySelector("[data-tab-more-label]");
    var moreDefaultLabel = moreLabel ? moreLabel.getAttribute("data-tab-more-default") || "More" : "More";

    if (!panel || !links.length) return;

    function closeMore() {
      if (!more || !moreMenu || !moreToggle) return;
      moreMenu.hidden = true;
      moreToggle.setAttribute("aria-expanded", "false");
    }

    function setActive(url) {
      var overflowActiveLabel = null;

      links.forEach(function (link) {
        var isActive = link.getAttribute("data-tab-url") === url;
        link.classList.toggle("is-active", isActive);
        link.setAttribute("aria-selected", isActive ? "true" : "false");
        if (isActive && moreMenu && moreMenu.contains(link)) {
          overflowActiveLabel = link.textContent;
        }
      });

      if (more) {
        more.classList.toggle("is-active", !!overflowActiveLabel);
      }
      if (moreToggle) {
        moreToggle.classList.toggle("is-active", !!overflowActiveLabel);
      }
      if (moreLabel) {
        moreLabel.textContent = overflowActiveLabel || moreDefaultLabel;
      }
    }

    function loadTab(url, fragmentUrl, push) {
      fetch(fragmentUrl, { headers: { "X-Requested-With": "fetch" } })
        .then(function (res) {
          return res.ok ? res.text() : Promise.reject(new Error("bad response"));
        })
        .then(function (html) {
          panel.innerHTML = html;
          setActive(url);
          if (window.DirectorySortable) window.DirectorySortable.init(panel);
          if (window.SavedDirectories) window.SavedDirectories.sync(panel);
          if (push) window.history.pushState({ directoryTab: url }, "", url);
          closeMore();
        })
        .catch(function () {
          window.location.href = url;
        });
    }

    // Pagination links live inside the panel and are re-rendered on every swap, so bind the
    // click handler once on the panel itself and let it delegate. Unlike tab links, paging
    // doesn't change which tab is active.
    function loadPage(url, fragmentUrl, push) {
      fetch(fragmentUrl, { headers: { "X-Requested-With": "fetch" } })
        .then(function (res) {
          return res.ok ? res.text() : Promise.reject(new Error("bad response"));
        })
        .then(function (html) {
          panel.innerHTML = html;
          if (window.DirectorySortable) window.DirectorySortable.init(panel);
          if (window.SavedDirectories) window.SavedDirectories.sync(panel);
          if (push) window.history.pushState({ directoryPage: url }, "", url);
        })
        .catch(function () {
          window.location.href = url;
        });
    }

    panel.addEventListener("click", function (e) {
      var link = e.target.closest ? e.target.closest("[data-page-link]") : null;
      if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
        return;
      }
      var url = link.getAttribute("data-page-url");
      var fragmentUrl = link.getAttribute("data-page-fragment");
      if (!url || !fragmentUrl) return;
      e.preventDefault();
      loadPage(url, fragmentUrl, true);
    });

    links.forEach(function (link) {
      link.addEventListener("click", function (e) {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
          return;
        }
        var url = link.getAttribute("data-tab-url");
        var fragmentUrl = link.getAttribute("data-tab-fragment");
        if (!url || !fragmentUrl) return;
        e.preventDefault();
        if (!link.classList.contains("is-active")) {
          loadTab(url, fragmentUrl, true);
        } else {
          closeMore();
        }
      });
    });

    if (more && moreToggle && moreMenu) {
      moreToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        var isOpen = !moreMenu.hidden;
        moreMenu.hidden = isOpen;
        moreToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
      });

      document.addEventListener("click", function (e) {
        if (!more.contains(e.target)) closeMore();
      });

      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !moreMenu.hidden) {
          closeMore();
          moreToggle.focus();
        }
      });
    }

    window.addEventListener("popstate", function () {
      var url = window.location.pathname;
      var match = null;
      links.forEach(function (link) {
        if (link.getAttribute("data-tab-url") === url) match = link;
      });
      if (match) {
        loadTab(url, match.getAttribute("data-tab-fragment"), false);
        return;
      }
      // Not a tab root (e.g. we navigated back to a paginated /page/N/ URL under the
      // current tab) -- every listing URL has a "table.html" fragment at the same path.
      var fragmentUrl = url.charAt(url.length - 1) === "/" ? url + "table.html" : url + "/table.html";
      loadPage(url, fragmentUrl, false);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-directory-tabs]").forEach(initTabs);
  });
})();
