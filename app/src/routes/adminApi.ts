import { Router } from "express";
import {
  IncidentSeverity,
  IncidentStatus,
  ServiceStatus,
} from "@prisma/client";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";

export const adminApiRouter = Router();

const SERVICE_STATUSES = new Set(Object.values(ServiceStatus));
const INCIDENT_STATUSES = new Set(Object.values(IncidentStatus));
const INCIDENT_SEVERITIES = new Set(Object.values(IncidentSeverity));

adminApiRouter.post("/api/services", requireAuth, async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name || name.length > 100) {
      res.status(400).json({ error: "invalid_name" });
      return;
    }

    const description =
      req.body?.description === undefined || req.body?.description === null
        ? null
        : String(req.body.description);
    const statusRaw = req.body?.status ?? ServiceStatus.operational;
    if (!SERVICE_STATUSES.has(statusRaw)) {
      res.status(400).json({ error: "invalid_status" });
      return;
    }
    const displayOrder = Number(req.body?.display_order ?? req.body?.displayOrder ?? 0);

    const service = await prisma.service.create({
      data: {
        name,
        description,
        status: statusRaw as ServiceStatus,
        displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0,
      },
    });
    res.status(201).json({ service });
  } catch (err) {
    next(err);
  }
});

adminApiRouter.delete("/api/services/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    await prisma.service.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

adminApiRouter.patch("/api/services/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const data: {
      name?: string;
      description?: string | null;
      status?: ServiceStatus;
      displayOrder?: number;
    } = {};

    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name || name.length > 100) {
        res.status(400).json({ error: "invalid_name" });
        return;
      }
      data.name = name;
    }
    if (req.body?.description !== undefined) {
      data.description =
        req.body.description === null ? null : String(req.body.description);
    }
    if (req.body?.status !== undefined) {
      if (!SERVICE_STATUSES.has(req.body.status)) {
        res.status(400).json({ error: "invalid_status" });
        return;
      }
      data.status = req.body.status as ServiceStatus;
    }
    if (req.body?.display_order !== undefined || req.body?.displayOrder !== undefined) {
      const displayOrder = Number(req.body.display_order ?? req.body.displayOrder);
      if (!Number.isFinite(displayOrder)) {
        res.status(400).json({ error: "invalid_display_order" });
        return;
      }
      data.displayOrder = displayOrder;
    }

    const service = await prisma.service.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ service });
  } catch (err) {
    next(err);
  }
});

adminApiRouter.post("/api/incidents", requireAuth, async (req, res, next) => {
  try {
    const serviceId = String(req.body?.service_id || req.body?.serviceId || "");
    const title = String(req.body?.title || "").trim();
    const severity = req.body?.severity;
    const status = (req.body?.status as IncidentStatus) || IncidentStatus.investigating;

    if (!serviceId || !title || title.length > 200) {
      res.status(400).json({ error: "invalid_incident" });
      return;
    }
    if (!INCIDENT_SEVERITIES.has(severity)) {
      res.status(400).json({ error: "invalid_severity" });
      return;
    }
    if (!INCIDENT_STATUSES.has(status)) {
      res.status(400).json({ error: "invalid_status" });
      return;
    }

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      res.status(400).json({ error: "unknown_service" });
      return;
    }

    const incident = await prisma.incident.create({
      data: {
        serviceId,
        title,
        severity: severity as IncidentSeverity,
        status,
        resolvedAt: status === IncidentStatus.resolved ? new Date() : null,
      },
      include: { service: true, updates: true },
    });
    res.status(201).json({ incident });
  } catch (err) {
    next(err);
  }
});

adminApiRouter.patch("/api/incidents/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.incident.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const data: {
      title?: string;
      status?: IncidentStatus;
      severity?: IncidentSeverity;
      serviceId?: string;
      resolvedAt?: Date | null;
    } = {};

    if (req.body?.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title || title.length > 200) {
        res.status(400).json({ error: "invalid_title" });
        return;
      }
      data.title = title;
    }
    if (req.body?.severity !== undefined) {
      if (!INCIDENT_SEVERITIES.has(req.body.severity)) {
        res.status(400).json({ error: "invalid_severity" });
        return;
      }
      data.severity = req.body.severity as IncidentSeverity;
    }
    if (req.body?.service_id !== undefined || req.body?.serviceId !== undefined) {
      const serviceId = String(req.body.service_id ?? req.body.serviceId);
      const service = await prisma.service.findUnique({ where: { id: serviceId } });
      if (!service) {
        res.status(400).json({ error: "unknown_service" });
        return;
      }
      data.serviceId = serviceId;
    }
    if (req.body?.status !== undefined) {
      if (!INCIDENT_STATUSES.has(req.body.status)) {
        res.status(400).json({ error: "invalid_status" });
        return;
      }
      data.status = req.body.status as IncidentStatus;
      if (data.status === IncidentStatus.resolved) {
        data.resolvedAt = existing.resolvedAt ?? new Date();
      } else {
        data.resolvedAt = null;
      }
    }

    const incident = await prisma.incident.update({
      where: { id: req.params.id },
      data,
      include: {
        service: true,
        updates: { orderBy: { createdAt: "desc" } },
      },
    });
    res.json({ incident });
  } catch (err) {
    next(err);
  }
});

adminApiRouter.delete("/api/incidents/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.incident.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    await prisma.incident.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

adminApiRouter.post("/api/incidents/:id/updates", requireAuth, async (req, res, next) => {
  try {
    const incident = await prisma.incident.findUnique({ where: { id: req.params.id } });
    if (!incident) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const message = String(req.body?.message || "").trim();
    const statusAtUpdate = String(
      req.body?.status_at_update || req.body?.statusAtUpdate || ""
    ).trim();

    if (!message || !statusAtUpdate) {
      res.status(400).json({ error: "message_and_status_required" });
      return;
    }

    const update = await prisma.incidentUpdate.create({
      data: {
        incidentId: incident.id,
        message,
        statusAtUpdate,
      },
    });

    if (INCIDENT_STATUSES.has(statusAtUpdate as IncidentStatus)) {
      const nextStatus = statusAtUpdate as IncidentStatus;
      await prisma.incident.update({
        where: { id: incident.id },
        data: {
          status: nextStatus,
          resolvedAt:
            nextStatus === IncidentStatus.resolved
              ? incident.resolvedAt ?? new Date()
              : null,
        },
      });
    }

    res.status(201).json({ update });
  } catch (err) {
    next(err);
  }
});
