import prisma from "../../../../lib/prisma.js";

/**
 * Resolve dispositivo ativo pelo IMEI.
 * IMEI duplicado em mais de um device ativo → rejeita (ambíguo).
 * @param {string} imei
 */
export async function findActiveDeviceByImei(imei) {
  const value = String(imei || "").trim();
  if (!/^\d{10,16}$/.test(value)) return null;

  const devices = await prisma.telemetry_devices.findMany({
    where: {
      imei: value,
      ativo: true,
      revogado_em: null,
    },
    take: 2,
  });

  if (devices.length !== 1) return null;
  return devices[0];
}
