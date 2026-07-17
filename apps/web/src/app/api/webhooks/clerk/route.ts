import { apiErrorResponse, ApiError } from "../../../../lib/api";
import { getUserOperationsService, UserOperationsError } from "../../../../lib/user-operations";
import { webhookVerifier } from "../../../../lib/webhook-verification";

export async function POST(request: Request) {
  try {
    const event = await webhookVerifier("clerk").verify(request);
    const result = await getUserOperationsService().handleClerkWebhook(event.eventId, event.payload);
    return Response.json({ received: true, ...result });
  } catch (error) {
    if (error instanceof UserOperationsError) {
      return apiErrorResponse(new ApiError(400, error.code, error.message));
    }
    return apiErrorResponse(new ApiError(401, "INVALID_WEBHOOK", "Webhook verification failed."));
  }
}
