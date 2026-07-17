import { apiErrorResponse, ApiError, readJsonObject } from "../../../../../lib/api";
import { authenticateRequest } from "../../../../../lib/auth";
import {
  type AlertCriteria,
  type AlertFrequency,
  type AlertKind,
  type AlertStatus,
  getUserOperationsService,
  UserOperationsError,
} from "../../../../../lib/user-operations";

function operationError(error: UserOperationsError) {
  const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 400;
  return new ApiError(status, error.code, error.message);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ alertId: string }> },
) {
  try {
    const user = await authenticateRequest(request);
    if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
    const { alertId } = await context.params;
    const body = await readJsonObject(request);
    const allowedKeys = new Set(["name", "kind", "frequency", "criteria", "status"]);
    if (
      Object.keys(body).length === 0 ||
      Object.keys(body).some((key) => !allowedKeys.has(key)) ||
      ("name" in body && typeof body.name !== "string") ||
      ("kind" in body && typeof body.kind !== "string") ||
      ("frequency" in body && typeof body.frequency !== "string") ||
      ("status" in body && typeof body.status !== "string") ||
      ("criteria" in body &&
        (!body.criteria || typeof body.criteria !== "object" || Array.isArray(body.criteria)))
    ) {
      throw new ApiError(400, "INVALID_ALERT", "Alert patch is invalid.");
    }
    const data = await getUserOperationsService().updateAlert(user.userId, alertId, {
      name: typeof body.name === "string" ? body.name : undefined,
      kind: typeof body.kind === "string" ? (body.kind as AlertKind) : undefined,
      frequency:
        typeof body.frequency === "string" ? (body.frequency as AlertFrequency) : undefined,
      criteria:
        body.criteria && typeof body.criteria === "object" && !Array.isArray(body.criteria)
          ? (body.criteria as AlertCriteria)
          : undefined,
      status: typeof body.status === "string" ? (body.status as AlertStatus) : undefined,
    });
    return Response.json({ data });
  } catch (error) {
    if (error instanceof UserOperationsError) return apiErrorResponse(operationError(error));
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ alertId: string }> },
) {
  try {
    const user = await authenticateRequest(request);
    if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
    const { alertId } = await context.params;
    await getUserOperationsService().deleteAlert(user.userId, alertId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof UserOperationsError) return apiErrorResponse(operationError(error));
    return apiErrorResponse(error);
  }
}
