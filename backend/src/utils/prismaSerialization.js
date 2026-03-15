import { Prisma } from "@prisma/client";

const normalizeBigInt = (value) => {
  const numberValue = Number(value);
  return Number.isSafeInteger(numberValue) ? numberValue : value.toString();
};

export const serializePrisma = (value) => {
  if (value == null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(serializePrisma);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "bigint") {
    return normalizeBigInt(value);
  }

  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        serializePrisma(entryValue),
      ]),
    );
  }

  return value;
};
