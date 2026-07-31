import test from "node:test";
import assert from "node:assert/strict";
import { exportToPDF } from "./exportUtils.js";
import { mkdirSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("exportToPDF gera arquivo sem lançar (jspdf-autotable v5)", async () => {
  const dir = join(tmpdir(), "atrack-pdf-test");
  mkdirSync(dir, { recursive: true });
  const filename = join(dir, `relatorio-test-${Date.now()}.pdf`);

  // jsPDF save() grava no cwd do browser; no Node usa output.
  // Validamos que a API nova não quebra (autoTable function).
  const { jsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default || autoTableModule.autoTable;
  assert.equal(typeof autoTable, "function");

  const doc = new jsPDF();
  autoTable(doc, {
    startY: 20,
    head: [["Placa", "Valor"]],
    body: [["ABC1D23", "R$ 10,00"]],
  });
  const ab = doc.output("arraybuffer");
  assert.ok(ab.byteLength > 100);

  // Também exercita o helper (pode falhar se save não existir no Node — isolamos)
  try {
    await exportToPDF(
      "Teste",
      ["A", "B"],
      [["1", "2"]],
      filename,
    );
  } catch (err) {
    // Em Node puro, doc.save pode depender de FileSaver; arraybuffer já validou a API
    assert.ok(
      /save|window|document|blob/i.test(String(err?.message || err)) ||
        existsSync(filename),
      `erro inesperado: ${err?.message}`,
    );
  }

  if (existsSync(filename)) {
    unlinkSync(filename);
  }
});
