import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  try {
    redisClient = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    redisClient.connect().catch(() => {
      redisClient = null;
    });
    return redisClient;
  } catch {
    return null;
  }
}
