# Feature: Diseño en azul con tema claro y oscuro

## Encargo y criterios de aceptación

Origen: issue https://github.com/MiguelSavignanoC/desarrollo-agentico-todo-03/issues/1 («Diseño en azul con tema claro y oscuro»).

Requisitos explícitos:
1. **Paleta azul.** Sustituir el primario rojo (`--color-primary: #b73526`, `--color-primary-hover`) y los acentos derivados (botón «Añadir», enlace activo de la barra lateral, marca `+`, punto de la marca, etc.) por una paleta azul. El color de peligro (eliminar) puede seguir siendo rojo.
2. **Tema claro y oscuro.**
   - Por defecto, la app sigue `prefers-color-scheme`.
   - Un botón en la barra lateral cambia entre claro y oscuro; la elección se guarda en `localStorage` y se aplica al recargar sin parpadeo del tema contrario.
   - Todos los colores son variables CSS en `:root` y se redefinen para el tema oscuro; no queda ningún color fijo fuera de esas variables.
3. **Accesibilidad.** Contraste WCAG AA (4.5:1 para texto normal) en ambos temas, incluidos el texto atenuado, las etiquetas de prioridad, los mensajes de error y el estado de foco.
4. **Sin cambios funcionales.** Crear, editar, completar, reabrir, eliminar y prioridad se comportan igual.

Criterios de aceptación:
1. La lista de tareas, el formulario de alta, la edición y los mensajes de error usan el azul como acento en tema claro y en tema oscuro (botón «Añadir» / «Guardar cambios», enlace activo «Tareas», marca `+`, punto de `todo.`).
2. Con el sistema en oscuro y sin elección guardada, la app abre en oscuro (`<html data-theme="dark">`); con el sistema en claro, en claro (`data-theme="light"`).
3. Al pulsar el botón «Tema oscuro» cambia al otro tema; tras recargar se mantiene la elección, aunque la preferencia del sistema sea la contraria.
4. El tema se aplica antes del primer pintado: el script que fija `data-theme` es síncrono y va en `<head>` antes de la hoja de estilos.
5. En `public/assets/app.css` no hay colores literales (`#…`, `rgb(…)`, nombres como `white`) fuera de los bloques de definición de variables.
6. Todos los pares texto/fondo de la tabla de tokens cumplen ≥ 4.5:1, y los indicadores no textuales (foco, borde de controles, círculo de completar) ≥ 3:1, en ambos temas.
7. Los tests Go y los escenarios e2e existentes (`persistencia-al-completar-tarea`, `prioridad-de-tareas`) siguen pasando.

Inferencias (a confirmar en revisión):
- (inferencia) El tema se representa con el atributo `data-theme="light|dark"` en `<html>`. Un script en línea lo fija siempre: con el valor guardado o, si no lo hay, con `matchMedia("(prefers-color-scheme: dark)")`. Así las variables oscuras se definen **una sola vez** (`:root[data-theme="dark"]`), sin duplicarlas dentro de un `@media`. Contrapartida: sin JavaScript la app se ve siempre en claro (aceptable, véase Riesgos).
- (inferencia) Clave de `localStorage`: `theme`, con valores `light` | `dark`. Sin elección guardada, si el sistema cambia de preferencia con la página abierta, el tema la sigue (listener `change` de `matchMedia`); con elección guardada, no.
- (inferencia) El botón es un *toggle* con etiqueta fija «Tema oscuro» y `aria-pressed="true|false"` según el tema activo, el mismo patrón `aria-pressed` que el botón de completar. Texto visible, sin icono nuevo (los iconos quedan fuera de alcance).
- (inferencia) Se suben las versiones de caché: `app.css?v=5`, `app.js?v=4`.
- (verificado) No hay Content-Security-Policy: `actions/app.go` solo usa `forcessl` con `secure.Options{SSLRedirect, SSLProxyHeaders}`, así que el script en línea no se bloquea.

## Comportamiento actual y propuesta

Actual (verificado en el código):
- `public/assets/app.css` define 8 variables en `:root` (líneas 17-27), con el primario rojo `#b73526` y el hover `#992b1e`, y unos 35 colores literales repartidos por las reglas (líneas 35-396: fondo del body, enlace activo `#f7e9e4`/`#a03123`, hover de completar, prioridades, botones, errores, flash…).
- `templates/application.plush.html` es el layout: barra lateral `aside.sidebar` con la marca `todo.` y el `nav` con el enlace «Tareas»; `app.css?v=4` en `<head>` y `app.js?v=3` con `defer` al final del `body`.
- `public/assets/app.js` gestiona la confirmación al eliminar y el toggle de completar mediante delegación sobre `submit`.
- No existe tema oscuro ni ningún control de tema.

Propuesta:
- Reorganizar `app.css` en tokens semánticos: un bloque `:root` (claro) y un bloque `:root[data-theme="dark"]` (oscuro), con `color-scheme` en cada uno para que los controles nativos (select, scrollbar) sigan el tema. Todas las reglas pasan a usar `var(--…)`.
- Añadir en `<head>`, **antes** del `<link>` del CSS, un script en línea síncrono que fije `data-theme`.
- Añadir un botón `button.theme-toggle[data-theme-toggle]` en la barra lateral y su lógica en `app.js` (alternar, guardar, sincronizar `aria-pressed`, seguir al sistema si no hay elección).

## Alcance

Incluido:
- `public/assets/app.css`: tokens claro/oscuro, sustitución de todos los literales y estilos del botón de tema.
- `templates/application.plush.html`: script en línea, botón y versiones de caché.
- `public/assets/app.js`: lógica del botón de tema.
- Un test Go del layout (presencia del script y del botón).
- Escenario e2e `tema-azul-claro-oscuro` (lo escribe `/adw` en su fase e2e, no `/implement`).

Excluido:
- Tipografía, maquetación (salvo colocar el botón en la barra lateral) e iconos.
- Guardar la preferencia en el servidor, en cookies o por usuario.
- Cambios en acciones, modelos, migraciones o rutas.
- Selector de tres estados («sistema / claro / oscuro»). Una vez pulsado el botón, la elección queda fija; volver a «seguir al sistema» exige borrar `localStorage` (véase Riesgos).

## Diseño por capas

### Renderizado (layout Plush)

`templates/application.plush.html`:

1. Justo después de `<meta name="viewport">` y **antes** del `<link rel="stylesheet">`:

```html
    <script>
      (function () {
        var theme;
        try {
          theme = localStorage.getItem("theme");
        } catch (e) {}
        if (theme !== "light" && theme !== "dark") {
          theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        }
        document.documentElement.setAttribute("data-theme", theme);
      })();
    </script>
```

   El `try` cubre los navegadores que bloquean `localStorage` (modo privado o cookies desactivadas).

2. `app.css?v=4` → `app.css?v=5`; `app.js?v=3` → `app.js?v=4`.

3. Dentro de `aside.sidebar`, después de `</nav>`:

```html
        <button type="button" class="theme-toggle" data-theme-toggle aria-pressed="false">Tema oscuro</button>
```

   `aria-pressed` se renderiza en `false` y `app.js` lo sincroniza al cargar con el tema real. Como `app.js` va con `defer`, se ejecuta antes de que el usuario pueda interactuar. El estado inicial del atributo no afecta al color: el color depende solo de `data-theme`.

### JavaScript

Añadir al final de `public/assets/app.js` (sin tocar la lógica existente), siguiendo el estilo del archivo (`var`, funciones con nombre, comentarios en español):

```js
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
```

### CSS

`public/assets/app.css`:

1. Sustituir el bloque `:root` (líneas 17-27) por el bloque claro y añadir a continuación el bloque oscuro, con **exactamente** estos tokens y valores. Todos los pares de la columna «Pares comprobados» se calcularon con la fórmula de luminancia relativa de WCAG 2.x (véase Tests y validación):

| Token | Claro | Oscuro | Uso (selector actual) | Pares comprobados (claro / oscuro) |
|---|---|---|---|---|
| `--color-bg` | `#ffffff` | `#17191e` | `body` background | — |
| `--color-text` | `#282826` | `#e7e8ea` | texto general | sobre bg 14.77 / 14.34 |
| `--color-muted` | `#686864` | `#a4a8b1` | contador, hint, completadas, placeholder, prioridad neutra | sobre bg 5.60 / 7.38; sobre sidebar 5.22 / 6.76; sobre hover-bg 4.99 / 6.04 |
| `--color-border` | `#e9e9e5` | `#2e323b` | separadores (decorativo) | — |
| `--color-sidebar` | `#f7f7f5` | `#1e2128` | fondo de `.sidebar` | texto 13.77 / 13.14 |
| `--color-sidebar-border` | `#efefeb` | `#2a2e36` | `.sidebar` border-right (antes `#efefeb`) | decorativo |
| `--color-primary` | `#1f5fbf` | `#7fb0ff` | `.brand-dot`, `.add-mark`, hover de completar, `.button-primary` | sobre bg 6.09 / 8.00 |
| `--color-primary-hover` | `#194d9b` | `#a3c6ff` | `.button-primary:hover` | — |
| `--color-on-primary` | `#ffffff` | `#0e1a2e` | texto de `.button-primary` (antes `#ffffff`) | sobre primary 6.09 / 7.92; sobre hover 8.15 / 10.02 |
| `--color-accent-bg` | `#e8effb` | `#1f3354` | `.nav-link` bg (antes `#f7e9e4`) y `.task-toggle-button:hover .completion-icon` bg (antes `#f7e9e4`) | primary sobre accent-bg 5.27 / 5.76 |
| `--color-accent-bg-hover` | `#d9e5f8` | `#284068` | `.nav-link:hover` (antes `#f2ded6`) | — |
| `--color-accent-text` | `#1a4f9e` | `#b5d0ff` | `.nav-link` color (antes `#a03123`) | sobre accent-bg 6.84 / 8.09; sobre accent-bg-hover 6.22 / 6.64 |
| `--color-focus` | `#1f5fbf` | `#7fb0ff` | `outline` de `:focus-visible` (antes `#245ab4`) | sobre bg 6.09 / 8.00; sobre sidebar 5.68 / 7.33 |
| `--color-danger` | `#a52b25` | `#ff8f85` | eliminar (hover), prioridad alta, borde inválido | sobre bg 7.07 / 7.97; sobre danger-bg 6.33 / 6.79 |
| `--color-danger-bg` | `#fcf0ec` | `#3b1f1f` | `.icon-danger:hover` y `.task-priority-high` bg (antes `#fcf0ec`) | — |
| `--color-error-text` | `#912a20` | `#ffb4ab` | `.field-error` color | sobre error-bg 7.40 / 8.82 |
| `--color-error-bg` | `#fff0eb` | `#3b1f1f` | `.field-error` bg | — |
| `--color-invalid-bg` | `#fff9f7` | `#2a1c1c` | `input/select[aria-invalid]` bg | texto 14.17 / 13.37 |
| `--color-input-bg` | `#ffffff` | `#1c1f25` | `input[type=text]`, `select` bg (antes `#ffffff`) | texto ≥ 13 en ambos |
| `--color-control-border` | `#92928a` | `#80848d` | borde de input/select | sobre bg 3.13 / 4.69 (≥ 3, no textual) |
| `--color-check-border` | `#858580` | `#8b8f98` | `.completion-icon` border | sobre bg 3.71 / 5.43 |
| `--color-check-done` | `#777771` | `#8b8f98` | `.task-completed .completion-icon` bg y border | — |
| `--color-on-check` | `#ffffff` | `#17191e` | `.completion-icon` color (marca ✓) | sobre check-done 4.50 / 5.43 |
| `--color-strike` | `#96968f` | `#6f737c` | `text-decoration-color` de completadas (decorativo) | — |
| `--color-hover-bg` | `#f2f2ee` | `#262a32` | `.icon-action:hover` bg | texto 13.16 / 11.73 |
| `--color-button-text` | `#41413d` | `#e7e8ea` | `.button` color | sobre button-bg 9.46 / 11.73; sobre hover 8.49 / 10.04 |
| `--color-button-bg` | `#f6f6f2` | `#262a32` | `.button` bg | — |
| `--color-button-hover` | `#eaeae4` | `#30353f` | `.button:hover` bg | — |
| `--color-button-border` | `#dadad4` | `#3a3f4a` | `.button` border (decorativo) | — |
| `--color-priority-medium-text` | `#6b5200` | `#f0d27a` | `.task-priority-medium` color | sobre su bg 6.78 / 8.71 |
| `--color-priority-medium-border` | `#d9c27a` | `#7a6526` | borde (decorativo) | — |
| `--color-priority-medium-bg` | `#fbf5dc` | `#3a3115` | bg | — |
| `--color-priority-low-text` | `#1f5c3a` | `#8fd6a8` | `.task-priority-low` color | sobre su bg 7.25 / 8.04 |
| `--color-priority-low-border` | `#a9d3b9` | `#2f6b47` | borde (decorativo) | — |
| `--color-priority-low-bg` | `#eef7f1` | `#173325` | bg | — |
| `--color-success-text` | `#245131` | `#a6dcb3` | `.flash-success` color | sobre su bg 8.22 / 9.01 |
| `--color-success-bg` | `#eef5e9` | `#183121` | `.flash-success` bg | — |
| `--color-success-border` | `#d5e4ce` | `#2c5238` | `.flash-success` border (decorativo) | — |

   Estructura:

```css
:root {
  color-scheme: light;
  /* tokens claros de la tabla */
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

:root[data-theme="dark"] {
  color-scheme: dark;
  /* tokens oscuros de la tabla (sin --font-family) */
}
```

2. Sustituir cada literal de las reglas por su token, según la columna «Uso» de la tabla. Lista exhaustiva de literales actuales (número de línea en el archivo original):
   - 35 `body` bg `#ffffff` → `var(--color-bg)`
   - 48 `.sidebar` border `#efefeb` → `var(--color-sidebar-border)`
   - 77-78 `.nav-link` `#f7e9e4` / `#a03123` → `var(--color-accent-bg)` / `var(--color-accent-text)`
   - 85 `.nav-link:hover` `#f2ded6` → `var(--color-accent-bg-hover)`
   - 164, 166 `.completion-icon` `#858580` / `#ffffff` → `var(--color-check-border)` / `var(--color-on-check)`
   - 177 hover de completar `#f7e9e4` → `var(--color-accent-bg)`
   - 189 `#96968f` → `var(--color-strike)`
   - 193-194 `#777771` → `var(--color-check-done)`
   - 218 `#f2f2ee` → `var(--color-hover-bg)`
   - 223 `#fcf0ec` → `var(--color-danger-bg)`
   - 255-256 y 269-270 input/select `#ffffff` / `#92928a` → `var(--color-input-bg)` / `var(--color-control-border)`
   - 276 y 319 `#fff9f7` → `var(--color-invalid-bg)`
   - 298 `#fcf0ec` → `var(--color-danger-bg)`
   - 302-304 → tokens `--color-priority-medium-*`
   - 308-310 → tokens `--color-priority-low-*`
   - 329, 331, 332 `.button` → `--color-button-border`, `--color-button-text`, `--color-button-bg`
   - 343 `#eaeae4` → `var(--color-button-hover)`
   - 349 `.button-primary` `#ffffff` → `var(--color-on-primary)`
   - 374-375 `.field-error` → `--color-error-text` / `--color-error-bg`
   - 394-396 `.flash-success` → `--color-success-*`

3. Foco: ampliar el selector de `:focus-visible` (línea 357) para que incluya `select:focus-visible`, porque hoy el `select` no tiene el anillo de foco propio y el requisito de foco cubre todos los controles. No cambia el estilo: misma regla `outline: 3px solid var(--color-focus); outline-offset: 3px`.

4. Botón de tema (nuevo, después de `.nav-link svg`), con el aspecto de `.button` y ancho completo en escritorio:

```css
.theme-toggle {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 44px;
  margin-top: 1rem;
  padding: 0.55rem 0.7rem;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-button-text);
  background: var(--color-button-bg);
  border: 1px solid var(--color-button-border);
  border-radius: 6px;
  cursor: pointer;
}

.theme-toggle:hover {
  background: var(--color-button-hover);
}
```

   En `@media (max-width: 760px)` añadir `.theme-toggle { width: auto; margin-top: 0; }`, para que quepa en la fila flex de la barra lateral móvil junto a la marca y el `nav`.

## Archivos relevantes

| Ruta | Responsabilidad |
|---|---|
| `public/assets/app.css` | Tokens de color claro/oscuro y estilos; único sitio de colores. |
| `templates/application.plush.html` | Layout: script de tema en `<head>`, botón en la barra lateral, versiones de caché. |
| `public/assets/app.js` | Alternar y guardar el tema; sincronizar `aria-pressed`; seguir al sistema. |
| `actions/tasks_test.go` | Test de que el layout incluye el script de tema y el botón. |
| `actions/app.go` | Solo lectura: confirma que no hay CSP. |
| `.claude/skills/e2e/scenarios/tema-azul-claro-oscuro.mjs` | Escenario e2e (lo crea `/adw`, no `/implement`). |

## Implementación paso a paso

1. `public/assets/app.css`: reemplazar el bloque `:root` por los bloques claro y oscuro de la tabla (con `color-scheme`).
2. `public/assets/app.css`: sustituir cada literal por su token según la lista del apartado CSS, punto 2.
3. `public/assets/app.css`: añadir `select:focus-visible` al selector de foco; añadir `.theme-toggle` y `.theme-toggle:hover`, y el ajuste móvil.
4. `templates/application.plush.html`: insertar el script en línea antes del `<link>`, subir `?v=` de CSS y JS y añadir el botón tras `</nav>`.
5. `public/assets/app.js`: añadir al final el bloque de tema.
6. `actions/tasks_test.go`: añadir el test del layout (véase abajo).
7. Ejecutar la validación.

## Tests y validación

Test Go nuevo en `actions/tasks_test.go`, siguiendo el estilo de `Test_TasksIndex*`:

```go
func (as *ActionSuite) Test_Layout_ThemeToggle() {
	res := as.HTML("/").Get()
	as.Equal(200, res.Code)
	body := res.Body.String()
	as.Contains(body, `data-theme-toggle`)
	as.Contains(body, `localStorage.getItem("theme")`)
	as.Contains(body, `prefers-color-scheme: dark`)
	// El script de tema va antes de la hoja de estilos para evitar el parpadeo.
	as.Less(strings.Index(body, `localStorage.getItem("theme")`), strings.Index(body, `/assets/app.css`))
}
```

(El archivo ya importa `strings` y usa `as.HTML("/").Get()` y `as.Equal(200, res.Code)`, como el test.)

Comandos (desde la raíz; necesitan PostgreSQL y la base `todo_test` migrada; `GO_ENV=test` es imprescindible, porque sin él los `POST`/`PUT` devuelven 403 por CSRF):
- `gofmt -l .` → sin salida.
- `go vet ./...`
- `GO_ENV=test go test -p 1 ./...`
- `go build ./...`

Comprobaciones específicas del CSS:
- **Sin literales fuera de las variables**. Este comando debe imprimir solo líneas `--color-…:` dentro de los dos bloques de tokens:
  `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\b(white|black)\b' public/assets/app.css`
- **Contraste**: crear `tmp/contrast/check.mjs` (no se commitea; `tmp/` está ignorado) que calcule la razón WCAG `(L1+0.05)/(L2+0.05)` de cada par de la columna «Pares comprobados» con los valores finales del CSS, y ejecutarlo con `node`: todos los pares de texto ≥ 4.5 y los no textuales ≥ 3. Si se cambia algún valor de la tabla, hay que repetirlo.

E2E (fase de `/adw`): escenario `tema-azul-claro-oscuro` derivado de los criterios 1-3:
- con `page.emulateMedia({ colorScheme: "dark" })` y sin elección guardada → `html[data-theme="dark"]`; con `light` → `light`;
- el color de fondo de `.button-primary` coincide con `--color-primary` del tema (azul);
- pulsar `[data-theme-toggle]` cambia `data-theme` y `aria-pressed`; tras `reload()` se mantiene aunque el sistema emulado sea el contrario;
- el runner abre cada escenario en un contexto nuevo (`browser.newPage()`), así que `localStorage` empieza vacío.

Además, `/e2e --rebuild` con todos los escenarios como regresión.

## Riesgos y recuperación

- **Sin JavaScript** la app se ve siempre en claro (no se aplica `data-theme="dark"`). Es aceptable porque el botón también requiere JS; si se quisiera cubrir, habría que duplicar los tokens oscuros en `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }`. Se descarta para no tener dos copias que mantener.
- **Volver a «seguir al sistema»** tras pulsar el botón exige borrar `localStorage`. Es una consecuencia del botón de dos estados que pide la issue; un selector de tres estados quedaría para otra issue.
- **Caché del navegador**: si no se suben los `?v=`, un navegador con el CSS antiguo vería el rojo. Recuperación: subir la versión.
- **CSP futura**: si más adelante se añade una Content-Security-Policy, el script en línea necesitará un nonce o un hash.
- **Contraste**: los valores se verificaron por cálculo, no con una herramienta de navegador. El hover de iconos (`muted` sobre `hover-bg`, 4.99 en claro) es el par más ajustado de texto.
- **Recuperación general**: el cambio se limita a tres archivos estáticos y un test, y se revierte con `git revert`. No hay migraciones ni datos afectados.
