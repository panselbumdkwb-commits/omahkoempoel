import { requireAdminOrOwner } from "@/lib/auth";
import {
  getShowDateTimeClock,
  getCafeOperatingHours,
  getEmployeeWorkHours,
  getKedaiProfile,
  getBusinessLocation,
} from "@/services/settingsService";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const role = await requireAdminOrOwner();
  const [showDateTimeClock, cafeOperatingHours, employeeWorkHours, kedaiProfile, businessLocation] = await Promise.all([
    getShowDateTimeClock(),
    getCafeOperatingHours(),
    getEmployeeWorkHours(),
    getKedaiProfile(),
    getBusinessLocation(),
  ]);

  return (
    <SettingsClient
      role={role}
      initialShowDateTimeClock={showDateTimeClock}
      initialCafeOperatingHours={cafeOperatingHours}
      initialEmployeeWorkHours={employeeWorkHours}
      initialKedaiProfile={kedaiProfile}
      initialBusinessLocation={businessLocation}
    />
  );
}
