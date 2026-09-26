(function () {
  "use strict";

  function compareValues(type, a, b) {
    if (type === "number") {
      return parseFloat(a) - parseFloat(b);
    }
    if (type === "date") {
      return new Date(a) - new Date(b);
    }
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  }

  function sortTable(table, columnIndex, type, direction) {
    var tbody = table.tBodies[0];
    var rows = Array.prototype.slice.call(tbody.rows);

    rows.sort(function (rowA, rowB) {
      var cellA = rowA.cells[columnIndex];
      var cellB = rowB.cells[columnIndex];
      var valueA = cellA.getAttribute("data-sort-value") || cellA.textContent.trim();
      var valueB = cellB.getAttribute("data-sort-value") || cellB.textContent.trim();
      var result = compareValues(type, valueA, valueB);
      return direction === "asc" ? result : -result;
    });

    rows.forEach(function (row) {
      tbody.appendChild(row);
    });
  }

  function initTable(table) {
    var headers = table.querySelectorAll("thead th[data-sort-type]");

    headers.forEach(function (th, columnIndex) {
      th.setAttribute("aria-sort", "none");
      th.tabIndex = 0;

      function activate() {
        var type = th.getAttribute("data-sort-type");
        var currentDirection = th.getAttribute("aria-sort");
        var nextDirection = currentDirection === "ascending" ? "descending" : "ascending";

        headers.forEach(function (otherTh) {
          otherTh.setAttribute("aria-sort", "none");
        });
        th.setAttribute("aria-sort", nextDirection);

        sortTable(table, columnIndex, type, nextDirection === "ascending" ? "asc" : "desc");
      }

      th.addEventListener("click", activate);
      th.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
    });
  }

  function initAll(root) {
    (root || document).querySelectorAll("table[data-sortable]").forEach(initTable);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initAll();
  });

  window.DirectorySortable = { init: initAll };
})();
