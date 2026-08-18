"use server";

import {
  getShowDateTimeClock,
  setShowDateTimeClock,
  getCafeOperatingHours,
  setCafeOperatingHours,
  getEmployeeWorkHours,
  setEmployeeWorkHours,
} from "@/services/settingsService";

export async function getShowDateTimeClockAction() {
  return getShowDateTimeClock();
}

export async function setShowDateTimeClockAction(value: boolean) {
  await setShowDateTimeClock(value);
}

export async function getCafeOperatingHoursAction() {
  return getCafeOperatingHours();
}

export async function setCafeOperatingHoursAction(value: string) {
  await setCafeOperatingHours(value);
}

export async function getEmployeeWorkHoursAction() {
  return getEmployeeWorkHours();
}

export async function setEmployeeWorkHoursAction(value: string) {
  await setEmployeeWorkHours(value);
}
