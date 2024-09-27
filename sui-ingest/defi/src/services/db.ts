import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

prisma.$use(async (params, next) => {
  // Check incoming query type
  if (
    process.env.TEST &&
    (params.action == "create" || params.action === "createMany")
  ) {
    console.log(`Test ENV is ON. Create query with`);
    console.log(params.args);
    return true;
  }
  return next(params);
});
