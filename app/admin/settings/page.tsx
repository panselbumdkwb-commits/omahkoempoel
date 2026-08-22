import { requireAdminOrOwner } from "@/lib/auth";
import {
  getShowDateTimeClock,
  getCafeOperatingHours,
  getEmployeeWorkHours,
  getKedaiProfile,
  getBusinessLocation,
  getPettyCashDefaultAmount,
} from "@/services/settingsService";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const role = await requireAdminOrOwner();
  const [showDateTimeClock, cafeOperatingHours, employeeWorkHours, kedaiProfile, businessLocation, pettyCashDefaultAmount] =
    await Promise.all([
      getShowDateTimeClock(),
      getCafeOperatingHours(),
      getEmployeeWorkHours(),
      getKedaiProfile(),
      getBusinessLocation(),
      getPettyCashDefaultAmount(),
    ]);

  return (
    <SettingsClient
      role={role}
      initialShowDateTimeClock={showDateTimeClock}
      initialCafeOperatingHours={cafeOperatingHours}
      initialEmployeeWorkHours={employeeWorkHours}
      initialKedaiProfile={kedaiProfile}
      initialBusinessLocation={businessLocation}
      initialPettyCashDefaultAmount={pettyCashDefaultAmount}
    />
  );
}
