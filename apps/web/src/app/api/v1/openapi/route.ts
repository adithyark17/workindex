const document = {
  openapi: "3.1.0",
  info: { title: "WorkIndex API", version: "0.2.0", description: "Review-gated GCC and hiring intelligence." },
  servers: [{ url: "/api/v1" }],
  paths: {
    "/health": { get: { summary: "Service health", responses: { "200": { description: "Healthy" } } } },
    "/companies": { get: { summary: "List published companies", parameters: ["query", "city", "capability", "momentum", "limit"].map((name) => ({ name, in: "query", schema: { type: name === "limit" ? "integer" : "string" } })), responses: { "200": { description: "Company page" } } } },
    "/companies/{slug}": { get: { summary: "Get a published company", parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Company" }, "404": { description: "Not found" } } } },
    "/jobs": { get: { summary: "List current or closed jobs", responses: { "200": { description: "Job page" } } } },
    "/events": { get: { summary: "List reviewed events", responses: { "200": { description: "Event page" } } } },
    "/saves": { post: { summary: "Save a company", security: [{ clerkSession: [] }], responses: { "201": { description: "Saved" }, "401": { description: "Unauthenticated" } } } },
    "/saves/{companyId}": { delete: { summary: "Remove a saved company", security: [{ clerkSession: [] }], responses: { "204": { description: "Removed" } } } },
    "/alerts": {
      get: { summary: "List current-user alerts", security: [{ clerkSession: [] }], responses: { "200": { description: "Alerts" } } },
      post: { summary: "Create an alert", security: [{ clerkSession: [] }], responses: { "201": { description: "Created" } } },
    },
    "/alerts/{alertId}": {
      patch: { summary: "Update an alert", security: [{ clerkSession: [] }], responses: { "200": { description: "Updated" } } },
      delete: { summary: "Delete an alert", security: [{ clerkSession: [] }], responses: { "204": { description: "Deleted" } } },
    },
    "/admin/review-decisions": { post: { summary: "Record a review decision without publishing", security: [{ moderatorSession: [] }], responses: { "200": { description: "Recorded" }, "409": { description: "Optimistic concurrency conflict" } } } },
    "/admin/publications": { post: { summary: "Publish an approved ingestion candidate", security: [{ moderatorSession: [] }], responses: { "201": { description: "Published" }, "409": { description: "Candidate not approved" } } } },
  },
  components: { securitySchemes: {
    clerkSession: { type: "apiKey", in: "cookie", name: "__session" },
    moderatorSession: { type: "apiKey", in: "cookie", name: "__session", description: "Clerk session mapped to an active moderator/admin role." },
  } },
};

export function GET() {
  return Response.json(document, { headers: { "Cache-Control": "public, max-age=3600" } });
}
