import { ImportManager } from "@/components/admin/import-manager";
import mapping from "../../../../config/import/blue-archive.json";
export default function ImportAdmin() {
  return <ImportManager game={mapping.game} />;
}
