import fs from "node:fs/promises";
import path from "node:path";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

let s3Client = null;

async function getS3() {
  if (!config.storage.s3Enabled) return null;
  if (s3Client) return s3Client;
  const { S3Client } = await import("@aws-sdk/client-s3");
  s3Client = new S3Client({
    region: config.storage.region,
    endpoint: config.storage.endpoint || undefined,
    forcePathStyle: Boolean(config.storage.endpoint),
    credentials: {
      accessKeyId: config.storage.accessKeyId,
      secretAccessKey: config.storage.secretAccessKey,
    },
  });
  return s3Client;
}

/**
 * Abstração de storage: disco local ou S3-compatível (AWS/R2/MinIO).
 */
export class ObjectStorage {
  static isS3Enabled() {
    return Boolean(config.storage.s3Enabled);
  }

  /**
   * @param {{ key: string, localPath: string, contentType?: string }} opts
   * @returns {Promise<string>} chave/caminho relativo armazenado
   */
  static async putFile({ key, localPath, contentType }) {
    if (!this.isS3Enabled()) {
      return key;
    }

    const client = await getS3();
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const body = await fs.readFile(localPath);
    await client.send(
      new PutObjectCommand({
        Bucket: config.storage.bucket,
        Key: key.replace(/\\/g, "/"),
        Body: body,
        ContentType: contentType || "application/octet-stream",
      }),
    );
    // Remove cópia local após upload bem-sucedido
    await fs.unlink(localPath).catch(() => {});
    return `s3://${key.replace(/\\/g, "/")}`;
  }

  /**
   * Resolve caminho relativo (disco) ou s3://key para buffer/stream local temp.
   */
  static async openReadable(storedPath) {
    const normalized = String(storedPath || "").replace(/\\/g, "/");
    if (normalized.startsWith("s3://")) {
      const key = normalized.slice(5);
      const client = await getS3();
      if (!client) {
        throw new Error("Arquivo no S3 mas storage não configurado");
      }
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const out = await client.send(
        new GetObjectCommand({
          Bucket: config.storage.bucket,
          Key: key,
        }),
      );
      return out.Body;
    }
    return createReadStream(normalized);
  }

  static async exists(storedPath, absoluteFromRel) {
    const normalized = String(storedPath || "").replace(/\\/g, "/");
    if (normalized.startsWith("s3://")) {
      try {
        const client = await getS3();
        if (!client) return false;
        const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
        await client.send(
          new HeadObjectCommand({
            Bucket: config.storage.bucket,
            Key: normalized.slice(5),
          }),
        );
        return true;
      } catch {
        return false;
      }
    }
    try {
      await fs.access(absoluteFromRel(normalized));
      return true;
    } catch {
      return false;
    }
  }

  static async delete(storedPath, absoluteFromRel) {
    const normalized = String(storedPath || "").replace(/\\/g, "/");
    if (normalized.startsWith("s3://")) {
      try {
        const client = await getS3();
        if (!client) return;
        const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
        await client.send(
          new DeleteObjectCommand({
            Bucket: config.storage.bucket,
            Key: normalized.slice(5),
          }),
        );
      } catch (err) {
        logger.warn("Falha ao apagar objeto S3", { err: err?.message });
      }
      return;
    }
    await fs.unlink(absoluteFromRel(normalized)).catch(() => {});
  }

  /** Copia stream S3 para arquivo temporário (PDF download). */
  static async materializeToTemp(storedPath, absoluteFromRel, tmpPath) {
    const normalized = String(storedPath || "").replace(/\\/g, "/");
    if (!normalized.startsWith("s3://")) {
      return absoluteFromRel(normalized);
    }
    const body = await this.openReadable(normalized);
    await pipeline(body, createWriteStream(tmpPath));
    return tmpPath;
  }
}
