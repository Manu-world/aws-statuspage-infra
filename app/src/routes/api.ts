import { Router } from "express";
import { IncidentStatus } from "@prisma/client";
import { prisma } from "../db";

export const apiRouter = Router();

apiRouter.get("/api/services", async (_req, res, next) => {
  try {
    const services = await prisma.service.findMany({
      orderBy: { displayOrder: "asc" },
    });
    res.json({ services });
  } catch (err) {
    next(err);
  }
});

apiRouter.get("/api/incidents", async (req, res, next) => {
  try {
    const statusFilter = req.query.status;
    const where =
      statusFilter === "active"
        ? { status: { not: IncidentStatus.resolved } }
        : {};

    const incidents = await prisma.incident.findMany({
      where,
      include: {
        service: true,
        updates: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ incidents });
  } catch (err) {
    next(err);
  }
});
