import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

export default async function AppIndex() {
  redirect({ href: "/app/dashboard", locale: await getLocale() });
}
