import { AdminLoadingTable } from "@/components/admin/admin-states";
import { AdminPageHeader } from "@/components/admin/admin-shell";

export default function AdminLoading() {
  return (
    <>
      <AdminPageHeader eyebrow="Operations" title="Loading workspace" description="Retrieving the latest fixture-backed operational state." />
      <AdminLoadingTable />
    </>
  );
}

