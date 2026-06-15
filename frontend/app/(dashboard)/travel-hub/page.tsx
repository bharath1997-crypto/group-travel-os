import { redirect } from "next/navigation";

/** Legacy route — full-page lounge removed; popup dock is the only lounge UI. */
export default function TravelHubPage() {
  redirect("/explore");
}
