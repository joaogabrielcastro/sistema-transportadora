import test from "node:test";
import assert from "node:assert/strict";
import { ZodError } from "zod";
import prismaClientPkg from "@prisma/client";
import {
  errorHandler,
  notFound,
} from "../../src/middleware/errorHandler.js";

const { Prisma } = prismaClientPkg;

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

const req = { path: "/api/test", method: "POST", body: { a: 1 } };

test("errorHandler ZodError retorna 400 VALIDATION_ERROR", () => {
  const res = mockRes();
  const err = new ZodError([
    {
      code: "custom",
      path: ["email"],
      message: "inválido",
    },
  ]);
  errorHandler(err, req, res, () => {});
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "VALIDATION_ERROR");
});

test("errorHandler DEPENDENCIES_EXIST retorna 409", () => {
  const res = mockRes();
  const err = new Error("Há vínculos");
  err.code = "DEPENDENCIES_EXIST";
  err.dependencies = { gastos: 1 };
  errorHandler(err, req, res, () => {});
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "DEPENDENCIES_EXIST");
});

test("errorHandler statusCode 401/404/400", () => {
  for (const [code, message] of [
    [401, "Não autorizado"],
    [404, "Sumiu"],
    [400, "Ruim"],
  ]) {
    const res = mockRes();
    const err = new Error(message);
    err.statusCode = code;
    errorHandler(err, req, res, () => {});
    assert.equal(res.statusCode, code);
    assert.equal(res.body.error, message);
  }
});

test("errorHandler Caminhão não encontrado → 404", () => {
  const res = mockRes();
  errorHandler(new Error("Caminhão não encontrado"), req, res, () => {});
  assert.equal(res.statusCode, 404);
});

test("errorHandler DUPLICATE_CAMINHAO_FIELDS → 400", () => {
  const res = mockRes();
  const err = new Error("duplicado");
  err.code = "DUPLICATE_CAMINHAO_FIELDS";
  err.conflicts = [{ placa: "ABC1D23" }];
  errorHandler(err, req, res, () => {});
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "DUPLICATE_CAMINHAO_FIELDS");
});

test("errorHandler Prisma P2002/P2025", () => {
  const resDup = mockRes();
  const p2002 = new Prisma.PrismaClientKnownRequestError("Unique", {
    code: "P2002",
    clientVersion: "0",
    meta: { target: ["placa"] },
  });
  errorHandler(p2002, req, resDup, () => {});
  assert.equal(resDup.statusCode, 400);
  assert.match(resDup.body.error, /duplicado|placa/i);

  const res404 = mockRes();
  const p2025 = new Prisma.PrismaClientKnownRequestError("Not found", {
    code: "P2025",
    clientVersion: "0",
  });
  errorHandler(p2025, req, res404, () => {});
  assert.equal(res404.statusCode, 404);
});

test("errorHandler puppeteer → 503", () => {
  const res = mockRes();
  errorHandler(new Error("Failed to launch the browser process"), req, res, () => {});
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, "PDF_GENERATION_FAILED");
});

test("errorHandler genérico → 500", () => {
  const res = mockRes();
  errorHandler(new Error("boom interno"), req, res, () => {});
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.code, "INTERNAL_ERROR");
});

test("notFound retorna 404", () => {
  const res = mockRes();
  notFound({ path: "/x", method: "GET" }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.success, false);
});
