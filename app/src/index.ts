import express from "express";
import path from "path";
import { pinoHttp } from "pino-http";
import { randomUUID } from "crypto";
import { logger } from "./logger";
import { healthRouter } from "./routes/health";
import { publicRouter } from "./routes/public";
import { apiRouter } from "./routes/api";

const app = express();
const port = Number(process.env.PORT || 3000);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const existing = req.headers["x-request-id"];
      if (typeof existing === "string" && existing.length > 0) {
        res.setHeader("x-request-id", existing);
        return existing;
      }
      const id = randomUUID();
      res.setHeader("x-request-id", id);
      return id;
    },
    customProps: (req, res) => ({
      request_id: req.id,
      method: req.method,
      path: req.url,
      status: res.statusCode,
    }),
    customSuccessMessage: (req, res, responseTime) =>
      JSON.stringify({
        request_id: req.id,
        method: req.method,
        path: req.url,
        status: res.statusCode,
        duration_ms: responseTime,
      }),
    customErrorMessage: (req, res, err) =>
      JSON.stringify({
        request_id: req.id,
        method: req.method,
        path: req.url,
        status: res.statusCode,
        duration_ms: undefined,
        error: err.message,
      }),
  })
);

app.use(healthRouter);
app.use(publicRouter);
app.use(apiRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});

app.listen(port, () => {
  logger.info({ event: "server_started", port }, "StatusPage listening");
});
