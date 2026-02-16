/**
 * Prisma configuration for Prisma 7
 * 
 * Note: In Prisma 7, database URL is passed directly to PrismaClient
 * This file is for reference and can be used if needed for advanced configuration
 */

const prismaConfig = {
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
};

export default prismaConfig;
