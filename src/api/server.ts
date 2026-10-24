import express, { Request, Response, NextFunction } from "express";
import { apiRouter } from "./routes.js";
import { getAppConfig } from "../config/env.js";
import { AppError } from "../core/errors.js";

export function createServer() {
  const app = express();

  app.use(express.json());

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (_req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use("/api/v1", apiRouter);
  app.use("/", apiRouter);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("API error:", err);
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: err.name,
        message: err.message,
        code: err.code,
        details: err.details,
      });
      return;
    }
    res.status(500).json({
      error: "InternalServerError",
      message: err.message || "An unexpected error occurred",
    });
  });

  return app;
}

if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  const config = getAppConfig();
  const app = createServer();
  app.listen(config.PORT, () => {
    console.log(`Research Agent microservice listening on http://localhost:${config.PORT}`);
    console.log(`Active Provider: ${config.MODEL_PROVIDER}`);
  });
}
