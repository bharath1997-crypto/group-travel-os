export function readApiErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: number }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

export function isSeatsAuthError(error: unknown): boolean {
  const status = readApiErrorStatus(error);
  return status === 401 || status === 403;
}
