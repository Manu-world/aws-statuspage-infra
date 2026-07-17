import { Router } from "express";
import { IncidentStatus } from "@prisma/client";
import { prisma } from "../db";
import { statusLabel, worstStatus } from "../status";

export const publicRouter = Router();

publicRouter.get("/", async (_req, res, next) => {
  try {
    const services = await prisma.service.findMany({
      orderBy: { displayOrder: "asc" },
    });

    const activeIncidents = await prisma.incident.findMany({
      where: { status: { not: IncidentStatus.resolved } },
      include: {
        service: true,
        updates: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    const overall = worstStatus(services.map((s) => s.status));

    res.render("status", {
      overall,
      overallLabel: statusLabel(overall),
      services,
      activeIncidents,
    });
  } catch (err) {
    next(err);
  }
});
