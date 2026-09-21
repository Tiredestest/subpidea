import { adminSnapshot } from "@/lib/admin/server";
import { SettingsManager } from "@/components/admin/settings-manager";
export default async function SettingsAdmin() {
  const data = await adminSnapshot();
  return <SettingsManager rows={data.site_settings} />;
}
