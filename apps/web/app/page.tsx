import { redirect } from "next/navigation";

/** §11.2 The dashboard is home; the root URL is not a screen of its own. */
export default function RootPage() {
  redirect("/dashboard");
}
