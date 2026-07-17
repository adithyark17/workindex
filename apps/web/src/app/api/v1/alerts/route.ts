import { apiErrorResponse, ApiError, readJsonObject } from "../../../../lib/api";
import { authenticateRequest } from "../../../../lib/auth";
import {
  alertFrequencies,
  alertKinds,
  getUserOperationsService,
  type AlertCriteria,
  UserOperationsError,
} from "../../../../lib/user-operations";

export async function GET(request: Request) {
  try {
    const user = await authenticateRequest(request);
    if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
    const data = await getUserOperationsService().listAlerts(user.userId);
    return Response.json({ data, meta: { count: data.length } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await authenticateRequest(request);
    if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
    const body = await readJsonObject(request);
    if (
      typeof body.name !== "string" ||
      typeof body.kind !== "string" ||
      !alertKinds.includes(body.kind as (typeof alertKinds)[number]) ||
      typeof body.frequency !== "string" ||
      !alertFrequencies.includes(body.frequency as (typeof alertFrequencies)[number]) ||
      !body.criteria ||
      typeof body.criteria !== "object" ||
      Array.isArray(body.criteria)
    ) {
      throw new ApiError(400, "INVALID_ALERT", "Alert payload is invalid.");
    }
    const data = await getUserOperationsService().createAlert(user.userId, {
      name: body.name,
      kind: body.kind as (typeof alertKinds)[number],
      frequency: body.frequency as (typeof alertFrequencies)[number],
      criteria: body.criteria as AlertCriteria,
    });
    return Response.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof UserOperationsError) {
      return apiErrorResponse(new ApiError(400, error.code, error.message));
    }
    return apiErrorResponse(error);
  }
}
