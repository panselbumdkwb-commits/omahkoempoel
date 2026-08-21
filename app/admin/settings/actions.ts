"use server";

import {
  getShowDateTimeClock,
  setShowDateTimeClock,
  getCafeOperatingHours,
  setCafeOperatingHours,
  getEmployeeWorkHours,
  setEmployeeWorkHours,
  getKedaiProfile,
  setKedaiProfile,
  type KedaiProfile,
  getBusinessLocation,
  setBusinessLocation,
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

export async function getKedaiProfileAction() {
  return getKedaiProfile();
}

export async function setKedaiProfileAction(value: KedaiProfile) {
  await setKedaiProfile(value);
}

export async function getBusinessLocationAction() {
  return getBusinessLocation();
}

export async function setBusinessLocationAction(latitude: number | null, longitude: number | null) {
  await setBusinessLocation(latitude, longitude);
}
