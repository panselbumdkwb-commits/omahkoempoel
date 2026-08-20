import { requireAdminOrOwner } from "@/lib/auth";
import { getShowDateTimeClock, getCafeOperatingHours, getEmployeeWorkHours } from "@/services/settingsService";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const role = await requireAdminOrOwner();
  const [showDateTimeClock, cafeOperatingHours, employeeWorkHours] = await Promise.all([
    getShowDateTimeClock(),
    getCafeOperatingHours(),
    getEmployeeWorkHours(),
  ]);

  return (
    <SettingsClient
      role={role}
      initialShowDateTimeClock={showDateTimeClock}
      initialCafeOperatingHours={cafeOperatingHours}
      initialEmployeeWorkHours={employeeWorkHours}
    />
  );
}
