(function () {
  "use strict";

  function initTabs(root) {
    var panel = root.querySelector("[data-tab-panel]");
    var links = Array.prototype.slice.call(root.querySelectorAll("[data-tab-link]"));
    var more = root.querySelector("[data-tab-more]");
    var moreToggle = root.querySelector("[data-tab-more-toggle]");
    var moreMenu = root.querySelector("[data-tab-more-menu]");
    var moreLabel = root.querySelector("[data-tab-more-label]");
    var searchInput = root.querySelector("[data-table-search-input]");
    var searchResults = root.querySelector("[data-table-search-results]");
    var filterToggle = root.querySelector("[data-filter-toggle]");
    var filterBadge = root.querySelector("[data-filter-badge]");
    var filterModalBackdrop = root.querySelector("[data-filter-modal-backdrop]");
    var filterModal = root.querySelector("[data-filter-modal]");
    var filterClose = root.querySelector("[data-filter-close]");
    var filterApply = root.querySelector("[data-filter-apply]");
    var filterSortSelect = root.querySelector("[data-filter-sort]");
    var filterPricingInputs = Array.prototype.slice.call(
      root.querySelectorAll('[data-filter-pricing] input[name="table-filter-pricing"]')
    );
    var filterDrMin = root.querySelector("[data-filter-dr-min]");
    var filterDrMax = root.querySelector("[data-filter-dr-max]");
    var filterVisitorsMin = root.querySelector("[data-filter-visitors-min]");
    var filterReset = root.querySelector("[data-filter-reset]");
    var datasetUrl = root.getAttribute("data-directories-url");
    var pageHeading = document.querySelector("[data-directory-heading]");
    var pageLede = document.querySelector("[data-directory-lede]");
    var datasetPromise = null;
    var activeSlug = "";
    var requestToken = 0;
    // Fields only take effect once "Apply filters" is clicked (see wiring below) -- this holds
    // the last-applied values so canceling the modal (backdrop click, Escape, the X button) can
    // revert any unsaved edits in the form back to what's actually active on the table.
    var lastAppliedFilters = { sort: "", pricing: "", drMin: "", drMax: "", visitorsMin: "" };
    var moreDefaultHTML =
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" class="tab-more-icon tab-more-ellipsis">' +
      '<circle cx="5" cy="12" r="1.6" fill="currentColor"/>' +
      '<circle cx="12" cy="12" r="1.6" fill="currentColor"/>' +
      '<circle cx="19" cy="12" r="1.6" fill="currentColor"/>' +
      "</svg>";

    // Comparators for the "Sort by" dropdown, keyed "<field>:<direction>" -- operate on
    // /directories.json items (see layouts/index.directories.json), same shape buildRow() reads.
    var SORTERS = {
      "title:asc": function (a, b) {
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      },
      "title:desc": function (a, b) {
        return b.title.localeCompare(a.title, undefined, { sensitivity: "base" });
      },
      "price:asc": function (a, b) {
        return priceValue(a) - priceValue(b);
      },
      "price:desc": function (a, b) {
        return priceValue(b) - priceValue(a);
      },
      "dr:asc": function (a, b) {
        return (parseFloat(a.ahrefs_dr) || 0) - (parseFloat(b.ahrefs_dr) || 0);
      },
      "dr:desc": function (a, b) {
        return (parseFloat(b.ahrefs_dr) || 0) - (parseFloat(a.ahrefs_dr) || 0);
      },
      "founded:asc": function (a, b) {
        return new Date(a.founded) - new Date(b.founded);
      },
      "founded:desc": function (a, b) {
        return new Date(b.founded) - new Date(a.founded);
      }
    };

    function priceValue(item) {
      return parseFloat((item.pricing || {}).starting_price) || 0;
    }

    // Mirrors the Free / Free tier / paid-only classification buildRow() and
    // layouts/partials/directory-table.html render as badges.
    function pricingModel(item) {
      var price = item.pricing || {};
      if (price.free_available && parseFloat(price.starting_price) === 0) return "free";
      if (price.free_available) return "freemium";
      return "paid";
    }

    function getCheckedPricing() {
      var checked = filterPricingInputs.filter(function (input) {
        return input.checked;
      })[0];
      return checked ? checked.value : "";
    }

    function setCheckedPricing(value) {
      filterPricingInputs.forEach(function (input) {
        input.checked = input.value === value;
      });
    }

    function readFilterFields() {
      return {
        sort: filterSortSelect ? filterSortSelect.value : "",
        pricing: getCheckedPricing(),
        drMin: filterDrMin ? filterDrMin.value : "",
        drMax: filterDrMax ? filterDrMax.value : "",
        visitorsMin: filterVisitorsMin ? filterVisitorsMin.value : ""
      };
    }

    function writeFilterFields(fields) {
      if (filterSortSelect) filterSortSelect.value = fields.sort || "";
      setCheckedPricing(fields.pricing || "");
      if (filterDrMin) filterDrMin.value = fields.drMin || "";
      if (filterDrMax) filterDrMax.value = fields.drMax || "";
      if (filterVisitorsMin) filterVisitorsMin.value = fields.visitorsMin || "";
    }

    function parseFilterNumber(value) {
      if (value === "" || value === null || typeof value === "undefined") return null;
      var n = parseFloat(value);
      return isNaN(n) ? null : n;
    }

    if (!panel || !links.length) return;

    links.forEach(function (link) {
      if (link.classList.contains("is-active")) {
        activeSlug = link.getAttribute("data-tab-slug") || "";
      }
    });

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
        if (overflowActiveLabel) {
          moreLabel.textContent = overflowActiveLabel;
        } else {
          moreLabel.innerHTML = moreDefaultHTML;
        }
      }
    }

    // Searches the full site-wide dataset (see layouts/index.directories.json), not just the
    // paginated page currently sitting in the panel -- so a match on page 3 of a category is
    // still found while page 1 is what's loaded. Fetched once and cached; filtered client-side
    // by the active tab's category slug plus the query, then rendered as a one-off table that
    // replaces the panel until the box is cleared.
    function loadDataset() {
      if (!datasetPromise) {
        datasetPromise = fetch(datasetUrl)
          .then(function (res) {
            return res.ok ? res.json() : [];
          })
          .catch(function () {
            return [];
          });
      }
      return datasetPromise;
    }

    // Mirrors layouts/partials/directory-table.html's row markup. Clones the real <thead>
    // (rather than re-typing its icons) so header cells always match what the server renders.
    function buildRow(item) {
      var row = document.createElement("tr");

      var nameCell = document.createElement("td");
      nameCell.setAttribute("data-sort-value", item.title);
      var nameWrap = document.createElement("div");
      nameWrap.className = "directory-name-cell";

      var link = document.createElement("a");
      link.className = "directory-link";
      link.href = item.url;
      var host = "";
      try {
        host = new URL(item.website).host;
      } catch (e) {
        // leave host blank -- the favicon service just returns a generic icon for it
      }
      var favicon = document.createElement("img");
      favicon.className = "favicon";
      favicon.width = 16;
      favicon.height = 16;
      favicon.loading = "lazy";
      favicon.alt = "";
      favicon.src = "https://www.google.com/s2/favicons?sz=64&domain=" + encodeURIComponent(host);
      link.appendChild(favicon);
      var titleSpan = document.createElement("span");
      titleSpan.textContent = item.title;
      link.appendChild(titleSpan);
      nameWrap.appendChild(link);

      var actions = document.createElement("div");
      actions.className = "directory-name-actions";

      var visitLink = document.createElement("a");
      visitLink.className = "visit-link";
      var sep = item.website && item.website.indexOf("?") !== -1 ? "&" : "?";
      visitLink.href = (item.website || "") + sep + "utm_source=directory.surf";
      visitLink.target = "_blank";
      visitLink.rel = "noopener nofollow";
      visitLink.referrerPolicy = "origin";
      visitLink.setAttribute("aria-label", "Open " + item.title + " in a new tab");
      visitLink.title = "Open in new tab";
      visitLink.innerHTML =
        '<svg class="visit-link-icon" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M9 6H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-3M14 4h6v6M20 4 10 14" ' +
        'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
      actions.appendChild(visitLink);
      if (window.SavedDirectories) {
        actions.appendChild(window.SavedDirectories.buildSaveButton(item.slug, item.title));
      }
      nameWrap.appendChild(actions);
      nameCell.appendChild(nameWrap);
      row.appendChild(nameCell);

      var price = item.pricing || {};
      var priceCell = document.createElement("td");
      priceCell.setAttribute("data-sort-value", price.starting_price);
      if (price.free_available && parseFloat(price.starting_price) === 0) {
        var freeBadge = document.createElement("span");
        freeBadge.className = "badge badge-free";
        freeBadge.textContent = "Free";
        priceCell.appendChild(freeBadge);
      } else if (price.free_available) {
        var tierBadge = document.createElement("span");
        tierBadge.className = "badge badge-free";
        tierBadge.textContent = "Free tier";
        priceCell.appendChild(tierBadge);
        priceCell.appendChild(
          document.createTextNode(" + from $" + price.starting_price + "/" + price.price_period)
        );
      } else {
        priceCell.textContent = "From $" + price.starting_price + "/" + price.price_period;
      }
      row.appendChild(priceCell);

      var drCell = document.createElement("td");
      drCell.setAttribute("data-sort-value", item.ahrefs_dr);
      drCell.textContent = item.ahrefs_dr;
      row.appendChild(drCell);

      var foundedCell = document.createElement("td");
      foundedCell.setAttribute("data-sort-value", item.founded);
      foundedCell.textContent = (item.founded || "").slice(0, 4);
      row.appendChild(foundedCell);

      return row;
    }

    function buildResultsTable(items) {
      var wrap = document.createElement("div");
      wrap.className = "table-wrap";
      var table = document.createElement("table");
      table.setAttribute("data-sortable", "");

      var sourceThead = panel.querySelector("table[data-sortable] thead");
      if (sourceThead) table.appendChild(sourceThead.cloneNode(true));

      var tbody = document.createElement("tbody");
      items.forEach(function (item) {
        tbody.appendChild(buildRow(item));
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      return wrap;
    }

    // The search box applies live as you type; everything in the filter modal (sort, pricing,
    // DR range, min visitors) only takes effect on "Apply filters" -- see lastAppliedFilters.
    function currentFilterState() {
      return {
        query: searchInput ? searchInput.value.trim() : "",
        sort: lastAppliedFilters.sort,
        pricing: lastAppliedFilters.pricing,
        drMin: parseFilterNumber(lastAppliedFilters.drMin),
        drMax: parseFilterNumber(lastAppliedFilters.drMax),
        visitorsMin: parseFilterNumber(lastAppliedFilters.visitorsMin)
      };
    }

    function isFilterActive(state) {
      return !!(
        state.query ||
        state.sort ||
        state.pricing ||
        state.drMin !== null ||
        state.drMax !== null ||
        state.visitorsMin !== null
      );
    }

    function updateFilterToggleUI(state) {
      var count =
        (state.sort ? 1 : 0) +
        (state.pricing ? 1 : 0) +
        (state.drMin !== null || state.drMax !== null ? 1 : 0) +
        (state.visitorsMin !== null ? 1 : 0);
      if (filterToggle) filterToggle.classList.toggle("is-active", count > 0);
      if (filterBadge) {
        filterBadge.hidden = count === 0;
        filterBadge.textContent = String(count);
      }
    }

    // Combines the search box's text query with the filter modal's applied choices into one
    // pass over the site-wide dataset (see loadDataset() above) -- like search, this covers
    // every directory, not just the paginated page currently sitting in the panel.
    function applyFilters() {
      var state = currentFilterState();
      updateFilterToggleUI(state);

      if (!isFilterActive(state)) {
        if (searchResults) {
          searchResults.hidden = true;
          searchResults.innerHTML = "";
        }
        panel.hidden = false;
        return;
      }

      panel.hidden = true;
      searchResults.hidden = false;
      if (!searchResults.firstChild) {
        searchResults.innerHTML = '<p class="table-empty">Filtering…</p>';
      }

      var token = ++requestToken;
      loadDataset().then(function (items) {
        // Superseded by a newer query/filter change while this fetch was in flight.
        if (token !== requestToken) return;

        var q = state.query.toLowerCase();
        var matches = items.filter(function (item) {
          if (activeSlug) {
            var inCategory = (item.categories || []).some(function (cat) {
              return cat.slug === activeSlug;
            });
            if (!inCategory) return false;
          }
          if (q && item.title.toLowerCase().indexOf(q) === -1) return false;
          if (state.pricing && pricingModel(item) !== state.pricing) return false;
          var dr = parseFloat(item.ahrefs_dr) || 0;
          if (state.drMin !== null && dr < state.drMin) return false;
          if (state.drMax !== null && dr > state.drMax) return false;
          if (state.visitorsMin !== null && (parseFloat(item.monthly_visitors) || 0) < state.visitorsMin) {
            return false;
          }
          return true;
        });
        matches.sort(SORTERS[state.sort] || SORTERS["dr:desc"]);

        searchResults.innerHTML = "";
        if (!matches.length) {
          var empty = document.createElement("p");
          empty.className = "table-empty";
          empty.textContent = "No directories match your search.";
          searchResults.appendChild(empty);
        } else {
          searchResults.appendChild(buildResultsTable(matches));
          if (window.DirectorySortable) window.DirectorySortable.init(searchResults);
        }
        if (window.SavedDirectories) window.SavedDirectories.sync(searchResults);
      });
    }

    function openFilterModal() {
      if (!filterModalBackdrop) return;
      writeFilterFields(lastAppliedFilters);
      filterModalBackdrop.hidden = false;
      document.body.classList.add("filter-modal-open");
      if (filterToggle) filterToggle.setAttribute("aria-expanded", "true");
      if (filterSortSelect) filterSortSelect.focus();
    }

    // revert: discard unsaved edits in the form and restore the last-applied values -- used
    // when the modal is dismissed without clicking "Apply filters" (X, backdrop, Escape).
    function closeFilterModal(revert) {
      if (!filterModalBackdrop) return;
      var wasOpen = !filterModalBackdrop.hidden;
      if (revert) writeFilterFields(lastAppliedFilters);
      filterModalBackdrop.hidden = true;
      document.body.classList.remove("filter-modal-open");
      if (filterToggle) {
        filterToggle.setAttribute("aria-expanded", "false");
        if (wasOpen) filterToggle.focus();
      }
    }

    function resetSearch() {
      if (searchInput) searchInput.value = "";
      lastAppliedFilters = { sort: "", pricing: "", drMin: "", drMax: "", visitorsMin: "" };
      writeFilterFields(lastAppliedFilters);
      closeFilterModal(false);
      updateFilterToggleUI(currentFilterState());
      if (searchResults) {
        searchResults.hidden = true;
        searchResults.innerHTML = "";
      }
      panel.hidden = false;
    }

    if (searchInput && searchResults) {
      searchInput.addEventListener("focus", loadDataset);
      searchInput.addEventListener("input", applyFilters);
    }

    if (filterToggle && filterModalBackdrop && filterModal) {
      loadDataset(); // filters need the full dataset the moment the modal opens, same as search

      filterToggle.addEventListener("click", function () {
        if (filterModalBackdrop.hidden) {
          openFilterModal();
        } else {
          closeFilterModal(true);
        }
      });

      if (filterClose) {
        filterClose.addEventListener("click", function () {
          closeFilterModal(true);
        });
      }

      filterModalBackdrop.addEventListener("click", function (e) {
        if (e.target === filterModalBackdrop) closeFilterModal(true);
      });

      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !filterModalBackdrop.hidden) closeFilterModal(true);
      });

      if (filterApply) {
        filterApply.addEventListener("click", function () {
          lastAppliedFilters = readFilterFields();
          applyFilters();
          closeFilterModal(false);
        });
      }

      if (filterReset) {
        filterReset.addEventListener("click", function () {
          lastAppliedFilters = { sort: "", pricing: "", drMin: "", drMax: "", visitorsMin: "" };
          writeFilterFields(lastAppliedFilters);
          applyFilters();
          closeFilterModal(false);
        });
      }
    }

    // The "All directories" blurb above the table (present on the homepage only, via
    // data-directory-heading/data-directory-lede) mirrors whichever tab is active, using the
    // title/description each tab link carries in data-tab-title/data-tab-desc.
    function updateHeading(url) {
      if (!pageHeading && !pageLede) return;
      var tabLink = links.filter(function (link) {
        return link.getAttribute("data-tab-url") === url;
      })[0];
      if (!tabLink) return;
      if (pageHeading) pageHeading.textContent = tabLink.getAttribute("data-tab-title") || "";
      if (pageLede) pageLede.textContent = tabLink.getAttribute("data-tab-desc") || "";
    }

    function loadTab(url, fragmentUrl, push, slug) {
      fetch(fragmentUrl, { headers: { "X-Requested-With": "fetch" } })
        .then(function (res) {
          return res.ok ? res.text() : Promise.reject(new Error("bad response"));
        })
        .then(function (html) {
          panel.innerHTML = html;
          setActive(url);
          updateHeading(url);
          activeSlug = slug || "";
          resetSearch();
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
          resetSearch();
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
          loadTab(url, fragmentUrl, true, link.getAttribute("data-tab-slug"));
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
        loadTab(url, match.getAttribute("data-tab-fragment"), false, match.getAttribute("data-tab-slug"));
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
