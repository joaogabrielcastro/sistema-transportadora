import test from "node:test";
import assert from "node:assert/strict";
import {
  CODEC12_RESPONSE,
  buildCodec12Command,
  isCodec12Packet,
  tryParseCodec12,
} from "../../src/services/telemetry/protocols/teltonika/codec12.js";

test("Codec 12: comando 'getinfo' igual ao exemplo oficial Teltonika", () => {
  // Exemplo da documentação "Codec 12" (comando getinfo).
  const expected = "000000000000000F0C010500000007676574696E666F0100004312";
  assert.equal(buildCodec12Command("getinfo").toString("hex").toUpperCase(), expected);
});

test("Codec 12: lê a resposta do aparelho e separa de pacotes AVL", () => {
  const answer = buildCodec12Command("DOUT1:1 DOUT2:IGNORED", CODEC12_RESPONSE);
  assert.equal(isCodec12Packet(answer), true);
  const parsed = tryParseCodec12(Buffer.concat([answer, Buffer.from([0, 0])]));
  assert.deepEqual(parsed, {
    type: CODEC12_RESPONSE,
    text: "DOUT1:1 DOUT2:IGNORED",
    bytesConsumed: answer.length,
  });
  // incompleto → espera mais bytes
  assert.equal(tryParseCodec12(answer.subarray(0, answer.length - 2)), null);
  // CRC errado → erro
  const bad = Buffer.from(answer);
  bad[bad.length - 1] ^= 0xff;
  assert.throws(() => tryParseCodec12(bad), /CRC/);
});

test("texto do setdigout por modelo e leitura da resposta", async () => {
  const { commandTextFor, commandSucceeded } = await import("../../src/services/telemetry/telemetryCommands.js");
  assert.equal(commandTextFor("bloquear", "FMC650"), "setdigout 1???");
  assert.equal(commandTextFor("desbloquear", "FMC650"), "setdigout 0???");
  assert.equal(commandTextFor("bloquear", "FMC130"), "setdigout 1?");
  assert.equal(commandTextFor("bloquear", "FMB920"), "setdigout 1");
  assert.equal(commandSucceeded("DOUT1:1 DOUT2:IGNORED"), true);
  assert.equal(commandSucceeded("DOUT1:Command not executed-NOFIX"), false);
  assert.equal(commandSucceeded("ERR:Bad Syntax"), false);
  assert.equal(commandSucceeded(""), false);
});
