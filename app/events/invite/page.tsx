import type { Metadata } from "next";
import InviteResponse from "./InviteResponse";
export const metadata: Metadata = { title:"Event invitation | Helios", robots:{index:false,follow:false},referrer:"no-referrer" };
export default function InvitePage() { return <InviteResponse />; }
