import { ServiceStatus } from "@prisma/client";

const RANK: Record<ServiceStatus, number> = {
  operational: 0,
  degraded_performance: 1,
  partial_outage: 2,
  major_outage: 3,
};

export function worstStatus(statuses: ServiceStatus[]): ServiceStatus {
  if (statuses.length === 0) {
    return ServiceStatus.operational;
  }
  return statuses.reduce((worst, current) =>
    RANK[current] > RANK[worst] ? current : worst
  );
}

export function statusLabel(status: ServiceStatus): string {
  switch (status) {
    case ServiceStatus.operational:
      return "All Systems Operational";
    case ServiceStatus.degraded_performance:
      return "Degraded Performance";
    case ServiceStatus.partial_outage:
      return "Partial Outage";
    case ServiceStatus.major_outage:
      return "Major Outage";
    default:
      return status;
  }
}
