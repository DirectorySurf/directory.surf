(function () {
  "use strict";

  var root = document.querySelector("[data-site-search]");
  if (!root) return;

  var input = root.querySelector("[data-site-search-input]");
  var resultsEl = root.querySelector("[data-site-search-results]");
  var indexUrl = root.getAttribute("data-index-url") || "/index.json";
  var index = null;
  var indexPromise = null;
  var selectedIndex = -1;
  var currentItems = [];

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(indexUrl)
        .then(function (res) {
          return res.ok ? res.json() : [];
        })
        .then(function (data) {
          index = Array.isArray(data) ? data : [];
          return index;
        })
        .catch(function () {
          index = [];
          return index;
        });
    }
    return indexPromise;
  }

  function closeResults() {
    resultsEl.hidden = true;
    resultsEl.innerHTML = "";
    selectedIndex = -1;
    currentItems = [];
  }

  function render(items, query) {
    currentItems = items;
    selectedIndex = -1;
    resultsEl.innerHTML = "";

    if (!items.length) {
      var empty = document.createElement("li");
      empty.className = "navbar-search-empty";
      empty.textContent = 'No matches for "' + query + '"';
      resultsEl.appendChild(empty);
      resultsEl.hidden = false;
      return;
    }

    items.forEach(function (item) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.className = "navbar-search-result";
      a.href = item.url;

      var title = document.createElement("span");
      title.className = "navbar-search-result-title";
      title.textContent = item.title;

      var meta = document.createElement("span");
      meta.className = "navbar-search-result-meta";
      meta.textContent = item.type;

      a.appendChild(title);
      a.appendChild(meta);
      li.appendChild(a);
      resultsEl.appendChild(li);
    });

    resultsEl.hidden = false;
  }

  function search(query) {
    var q = query.trim().toLowerCase();
    if (!q) {
      closeResults();
      return;
    }

    loadIndex().then(function (items) {
      var matches = items
        .filter(function (item) {
          return (
            item.title.toLowerCase().indexOf(q) !== -1 ||
            (item.description && item.description.toLowerCase().indexOf(q) !== -1)
          );
        })
        .slice(0, 8);

      render(matches, query.trim());
    });
  }

  function moveSelection(delta) {
    var links = resultsEl.querySelectorAll(".navbar-search-result");
    if (!links.length) return;

    selectedIndex = (selectedIndex + delta + links.length) % links.length;

    links.forEach(function (link, i) {
      link.classList.toggle("is-selected", i === selectedIndex);
    });
    links[selectedIndex].scrollIntoView({ block: "nearest" });
  }

  input.addEventListener("focus", loadIndex);

  input.addEventListener("input", function (e) {
    search(e.target.value);
  });

  input.addEventListener("keydown", function (e) {
    if (resultsEl.hidden) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSelection(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSelection(-1);
    } else if (e.key === "Enter") {
      var links = resultsEl.querySelectorAll(".navbar-search-result");
      if (selectedIndex >= 0 && links[selectedIndex]) {
        e.preventDefault();
        window.location.href = links[selectedIndex].href;
      }
    } else if (e.key === "Escape") {
      closeResults();
      input.blur();
    }
  });

  document.addEventListener("click", function (e) {
    if (!root.contains(e.target)) {
      closeResults();
    }
  });
})();
