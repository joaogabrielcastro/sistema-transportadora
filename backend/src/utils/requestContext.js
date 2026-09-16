import { AsyncLocalStorage } from "node:async_hooks";

const als = new AsyncLocalStorage();

export function runWithRequestContext(store, fn) {
  return als.run(store || {}, fn);
}

export function getRequestContext() {
  return als.getStore() || {};
}

export function getRequestId() {
  return getRequestContext().requestId || null;
}

export function getTenantIdFromContext() {
  return getRequestContext().tenantId ?? null;
}

export function patchRequestContext(partial) {
  const current = als.getStore();
  if (current && partial && typeof partial === "object") {
    Object.assign(current, partial);
  }
}
