import { Router } from "express";
import { IncidentStatus } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";

export const adminPageRouter = Router();

adminPageRouter.get("/admin", requireAuth, async (req, res, next) => {
  try {
    const services = await prisma.service.findMany({
      orderBy: { displayOrder: "asc" },
    });
    const incidents = await prisma.incident.findMany({
      include: {
        service: true,
        updates: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.render("admin", {
      adminEmail: req.admin?.email,
      services,
      incidents,
      serviceStatuses: [
        "operational",
        "degraded_performance",
        "partial_outage",
        "major_outage",
      ],
      incidentStatuses: ["investigating", "identified", "monitoring", "resolved"],
      severities: ["minor", "major", "critical"],
      IncidentStatus,
    });
  } catch (err) {
    next(err);
  }
});
