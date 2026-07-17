import { apiErrorResponse, ApiError } from "../../../../../lib/api";
import { authenticateRequest } from "../../../../../lib/auth";
import { getUserOperationsService, UserOperationsError } from "../../../../../lib/user-operations";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ companyId: string }> },
) {
  try {
    const user = await authenticateRequest(request);
    if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
    const { companyId } = await context.params;
    const removed = await getUserOperationsService().removeSavedCompany(user.userId, companyId);
    return Response.json({ data: { companyId, saved: false }, meta: { removed } });
  } catch (error) {
    if (error instanceof UserOperationsError) {
      return apiErrorResponse(new ApiError(400, error.code, error.message));
    }
    return apiErrorResponse(error);
  }
}
