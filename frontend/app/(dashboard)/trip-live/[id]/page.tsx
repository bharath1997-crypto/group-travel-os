import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/** Legacy trip-live URL — forwards to /live (trip mode is L6). */
export default async function TripLiveTripRedirectPage({ params }: Props) {
  const { id } = await params;
  redirect(`/live?trip_id=${encodeURIComponent(id)}`);
}
