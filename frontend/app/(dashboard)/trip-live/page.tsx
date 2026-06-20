import { redirect } from "next/navigation";

/** Legacy URL — Live Tab moved to /live in L1 rebuild. */
export default function TripLiveRedirectPage() {
  redirect("/live");
}
