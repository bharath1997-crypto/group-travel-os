import { redirect } from "next/navigation";

/** Canonical phone OTP flow lives at `/phone`. */
export default function AuthPhoneAliasPage() {
  redirect("/phone");
}
