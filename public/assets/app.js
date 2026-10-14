// Muestra una tarea como completada o pendiente.
function setCompleted(task, form, completed) {
  var button = form.querySelector("button");
  var status = task.querySelector(".task-status");

  task.classList.toggle("task-completed", completed);

  var label = completed ? "Reabrir" : "Completar";
  button.querySelector(".toggle-label").textContent = label;
  button.setAttribute("aria-pressed", String(completed));
  button.setAttribute("aria-label", label + " tarea: " + task.querySelector(".task-title").textContent);
  button.setAttribute("title", label + " tarea");

  if (completed && !status) {
    status = document.createElement("span");
    status.className = "task-status";
    status.textContent = "Completada";
    task.insertBefore(status, task.querySelector(".task-actions"));
  } else if (!completed && status) {
    status.remove();
  }
}

// Pide confirmación antes de enviar formularios marcados con data-confirm.
document.addEventListener("submit", function (event) {
  var form = event.target;
  if (form.dataset.confirm && !window.confirm(form.dataset.confirm)) {
    event.preventDefault();
  }

  if (!form.matches("[data-task-toggle]")) {
    return;
  }

  event.preventDefault();

  var task = form.closest(".task");
  var button = form.querySelector("button");
  var completed = !task.classList.contains("task-completed");

  setCompleted(task, form, completed);
  button.disabled = true;

  // Envía el formulario real (POST con _method=PUT y authenticity_token);
  // si el servidor no lo guarda, la tarea vuelve a su estado anterior.
  fetch(form.action, {
    method: "POST",
    body: new FormData(form),
    credentials: "same-origin",
    headers: { Accept: "text/html" }
  }).then(function (response) {
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }
  }).catch(function () {
    setCompleted(task, form, !completed);
  }).then(function () {
    button.disabled = false;
  });
});

// Tema claro/oscuro: data-theme en <html> lo fija el script del <head>.
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  var button = document.querySelector("[data-theme-toggle]");
  if (button) {
    button.setAttribute("aria-pressed", String(theme === "dark"));
  }
}

function storedTheme() {
  try {
    return localStorage.getItem("theme");
  } catch (e) {
    return null;
  }
}

applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");

document.addEventListener("click", function (event) {
  if (!event.target.closest("[data-theme-toggle]")) {
    return;
  }

  var theme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(theme);
  try {
    localStorage.setItem("theme", theme);
  } catch (e) {}
});

// Sin elección guardada, el tema sigue los cambios de preferencia del sistema.
var systemDark = window.matchMedia("(prefers-color-scheme: dark)");
systemDark.addEventListener("change", function (event) {
  var stored = storedTheme();
  if (stored !== "light" && stored !== "dark") {
    applyTheme(event.matches ? "dark" : "light");
  }
});
