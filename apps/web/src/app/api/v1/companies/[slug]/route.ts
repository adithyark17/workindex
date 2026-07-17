import { getCompany } from "@/lib/data/companies";
import { listCompanyEvidence } from "@/lib/data/public-records";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const company = await getCompany((await params).slug);
  if (!company) return Response.json({ error: { code: "COMPANY_NOT_FOUND", message: "Company not found" } }, { status: 404 });
  const evidence = await listCompanyEvidence(company.slug);
  return Response.json({ data: { ...company, evidence }, meta: { demo: company.isDemo } }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
