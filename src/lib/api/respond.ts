export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function errorResponse(error: unknown) {
  const maybeStatus = error && typeof error === "object" && "status" in error ? (error as { status?: unknown }).status : undefined;
  const status = typeof maybeStatus === "number" ? maybeStatus : 500;
  return json({ error: { message: error instanceof Error ? error.message : "Unexpected error" } }, status);
}
