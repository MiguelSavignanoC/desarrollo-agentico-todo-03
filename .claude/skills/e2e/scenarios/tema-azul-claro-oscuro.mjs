// Escenario: paleta azul y tema claro/oscuro que sigue al sistema y recuerda la elección.
import assert from "node:assert";

export const description = "tema por defecto del sistema, botón de tema persistente y acentos azules";

export default async function ({ page, base, step, shot }) {
  const theme = () => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  const toggle = page.locator("[data-theme-toggle]");

  // Comprueba que el botón primario usa --color-primary y que ese color es azul.
  const assertBluePrimary = async (label) => {
    const { bg, primary } = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.color = getComputedStyle(document.documentElement).getPropertyValue("--color-primary");
      document.body.appendChild(probe);
      const primary = getComputedStyle(probe).color;
      probe.remove();
      return { bg: getComputedStyle(document.querySelector(".button-primary")).backgroundColor, primary };
    });
    assert.equal(bg, primary, `${label}: el botón primario no usa --color-primary`);
    const [r, g, b] = bg.match(/\d+/g).map(Number);
    assert.ok(b > r && b > g, `${label}: el color primario ${bg} no es azul`);
  };

  step("Sistema en oscuro sin elección guardada: abre en oscuro");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(base + "/");
  assert.equal(await theme(), "dark");
  assert.equal(await toggle.getAttribute("aria-pressed"), "true");
  await assertBluePrimary("oscuro");
  await shot("oscuro-sistema");

  step("Sistema en claro sin elección guardada: abre en claro");
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  assert.equal(await theme(), "light");
  assert.equal(await toggle.getAttribute("aria-pressed"), "false");
  await assertBluePrimary("claro");

  step("Pulsar el botón cambia a oscuro");
  await toggle.click();
  assert.equal(await theme(), "dark");
  assert.equal(await toggle.getAttribute("aria-pressed"), "true");

  step("Tras recargar con el sistema en claro, se mantiene oscuro");
  await page.reload();
  assert.equal(await theme(), "dark", "la elección de tema no se recuerda al recargar");
  await assertBluePrimary("oscuro elegido");

  step("Pulsar de nuevo vuelve a claro y se mantiene con el sistema en oscuro");
  await toggle.click();
  assert.equal(await theme(), "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  assert.equal(await theme(), "light", "la elección de tema claro no se recuerda al recargar");

  step("La pantalla de edición también usa el tema y el azul");
  await page.goto(base + "/");
  const editLink = page.locator('a[title="Editar tarea"]').first();
  if (await editLink.count()) {
    await editLink.click();
    await page.waitForURL(/\/tasks\/.+\/edit$/);
    assert.equal(await theme(), "light");
    await assertBluePrimary("edición");
  }

  step("Error de validación visible en oscuro");
  await page.goto(base + "/");
  await toggle.click();
  assert.equal(await theme(), "dark");
  await page.fill("#task-title", "");
  await page.click("text=Añadir");
  await page.locator("#title-error").waitFor();
  assert.ok((await page.locator("#title-error").textContent()).includes("El título es obligatorio."));
  assert.equal(await theme(), "dark", "el tema se pierde al re-renderizar con error");
  await shot("error-oscuro");
}
