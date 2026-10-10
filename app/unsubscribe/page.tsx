import { connection } from "next/server";
import UnsubscribeForm from "./UnsubscribeForm";

export default async function UnsubscribePage() {
  // Preserve request-time form rendering without resolving tenant content.
  await connection();
  return <UnsubscribeForm />;
}
