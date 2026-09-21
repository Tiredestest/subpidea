import { adminSnapshot } from "@/lib/admin/server";
import { ContentManager } from "@/components/admin/content-manager";
export default async function ContentAdmin() {
  return <ContentManager data={await adminSnapshot()} />;
}
