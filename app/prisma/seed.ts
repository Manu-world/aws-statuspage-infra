import bcrypt from "bcrypt";
import { PrismaClient, IncidentStatus, IncidentSeverity, ServiceStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  await prisma.incidentUpdate.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.service.deleteMany();

  const api = await prisma.service.create({
    data: {
      name: "Public API",
      description: "Customer-facing REST API",
      status: ServiceStatus.operational,
      displayOrder: 1,
    },
  });

  const web = await prisma.service.create({
    data: {
      name: "Web Dashboard",
      description: "Browser application for customers",
      status: ServiceStatus.degraded_performance,
      displayOrder: 2,
    },
  });

  await prisma.service.create({
    data: {
      name: "Authentication",
      description: "Login and SSO",
      status: ServiceStatus.operational,
      displayOrder: 3,
    },
  });

  await prisma.service.create({
    data: {
      name: "Notifications",
      description: "Email and webhook delivery",
      status: ServiceStatus.operational,
      displayOrder: 4,
    },
  });

  const resolved = await prisma.incident.create({
    data: {
      serviceId: api.id,
      title: "Elevated API latency",
      status: IncidentStatus.resolved,
      severity: IncidentSeverity.minor,
      resolvedAt: new Date(Date.UTC(2026, 0, 10, 18, 0, 0)),
      createdAt: new Date(Date.UTC(2026, 0, 10, 14, 0, 0)),
    },
  });

  await prisma.incidentUpdate.createMany({
    data: [
      {
        incidentId: resolved.id,
        message: "Investigating elevated p99 latency on the Public API.",
        statusAtUpdate: "investigating",
        createdAt: new Date(Date.UTC(2026, 0, 10, 14, 5, 0)),
      },
      {
        incidentId: resolved.id,
        message: "Root cause identified; rolled forward a config fix.",
        statusAtUpdate: "identified",
        createdAt: new Date(Date.UTC(2026, 0, 10, 15, 30, 0)),
      },
      {
        incidentId: resolved.id,
        message: "Latency returned to baseline. Incident resolved.",
        statusAtUpdate: "resolved",
        createdAt: new Date(Date.UTC(2026, 0, 10, 18, 0, 0)),
      },
    ],
  });

  const active = await prisma.incident.create({
    data: {
      serviceId: web.id,
      title: "Intermittent dashboard load failures",
      status: IncidentStatus.investigating,
      severity: IncidentSeverity.major,
    },
  });

  await prisma.incidentUpdate.createMany({
    data: [
      {
        incidentId: active.id,
        message: "Users report intermittent 5xx on the Web Dashboard.",
        statusAtUpdate: "investigating",
      },
      {
        incidentId: active.id,
        message: "Traffic shifted away from a degraded AZ while we investigate.",
        statusAtUpdate: "investigating",
      },
      {
        incidentId: active.id,
        message: "Monitoring error rates; next update in 30 minutes.",
        statusAtUpdate: "monitoring",
      },
    ],
  });

  // Keep active incident status in sync with latest update narrative
  await prisma.incident.update({
    where: { id: active.id },
    data: { status: IncidentStatus.monitoring },
  });

  console.log(JSON.stringify({ event: "seed_complete", adminEmail: email }));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
