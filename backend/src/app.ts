import express from "express";

import { apiV1Router } from "./routes.js";

function corsAllowOrigin(req: express.Request): string | undefined {
  if (process.env.NODE_ENV !== "production") {
    return "*";
  }
  const single = process.env.CORS_ORIGIN?.trim();
  if (single) return single;
  const list = process.env.CORS_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean);
  if (!list?.length) return undefined;
  const origin = req.headers.origin as string | undefined;
  if (origin && list.includes(origin)) return origin;
  return list[0];
}

export function buildApp() {
  const app = express();

  // CORS: allowlist in production (CORS_ORIGIN or CORS_ORIGINS); permissive in development
  app.use((req, res, next) => {
    const allow = corsAllowOrigin(req);
    if (allow) {
      res.header("Access-Control-Allow-Origin", allow);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Hotel-Id");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Middleware for JSON parsing.
  app.use(express.json());

  // Group routes under /api.
  app.use("/api", apiV1Router);

  // Global error handler (must be last)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Error Handler]', err);
    
    // Send generic error response (don't leak stack traces in production)
    res.status(err.status || 500).json({
      error: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message || 'Internal server error',
    });
  });

  return app;
}
