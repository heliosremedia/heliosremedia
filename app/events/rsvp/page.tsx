import type { Metadata } from "next";
import RsvpResponse from "./RsvpResponse";

export const metadata: Metadata = {
  title: "Your event invitation | Helios",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function RsvpPage() {
  return <RsvpResponse />;
}
