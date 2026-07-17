import { apiErrorResponse, ApiError, readJsonObject } from "../../../../lib/api";
import { authenticateRequest } from "../../../../lib/auth";
import { getUserOperationsService, UserOperationsError } from "../../../../lib/user-operations";

export async function POST(request: Request) {
  try {
    const user = await authenticateRequest(request);
    if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
    const body = await readJsonObject(request);
    if (typeof body.companyId !== "string") {
      throw new ApiError(400, "INVALID_COMPANY_ID", "companyId is required.");
    }
    const created = await getUserOperationsService().saveCompany(user.userId, body.companyId);
    return Response.json(
      { data: { companyId: body.companyId, saved: true }, meta: { created } },
      { status: created ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof UserOperationsError) {
      return apiErrorResponse(new ApiError(400, error.code, error.message));
    }
    return apiErrorResponse(error);
  }
}
