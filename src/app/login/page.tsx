import { getShowDateTimeClock } from "@/services/settingsService";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const showDateTimeClock = await getShowDateTimeClock();
  return <LoginForm showDateTimeClock={showDateTimeClock} />;
}
