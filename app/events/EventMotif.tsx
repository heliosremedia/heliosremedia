import type { EventTemplateKey } from "@/lib/events/themes";

/** Decorative only: holiday identity must never replace the event's readable details. */
export default function EventMotif({ templateKey, className = "h-16 w-24" }: { templateKey: EventTemplateKey; className?: string }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 120 80" fill="none" className={className}>
    {templateKey === "CHRISTMAS" ? <>
      <path d="M37 18 22 39h9L17 57h40L43 39h9L37 18Z" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M37 57v9M78 24v23M67 35.5h22M70 27.5l16 16M86 27.5l-16 16" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="84" cy="60" r="2" fill="currentColor" /><circle cx="17" cy="16" r="1.5" fill="currentColor" /><circle cx="102" cy="17" r="1.5" fill="currentColor" />
    </> : templateKey === "HALLOWEEN" ? <>
      <path d="M59 26c-21-17-43 8-28 31 6 9 17 11 29 5 12 6 23 4 29-5 15-23-7-48-28-31Z" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="1.3" />
      <path d="M60 24c-2-7 1-11 7-13M51 27c-9 11-9 25 0 37m17-37c9 11 9 25 0 37" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="m96 12 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" stroke="currentColor" /><circle cx="19" cy="21" r="2" fill="currentColor" />
    </> : templateKey === "EASTER" ? <>
      <path d="M49 17c-14 0-25 27-20 39 6 16 33 16 39 0 5-12-6-39-19-39Z" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="1.3" />
      <path d="m29 45 10-5 10 5 10-5 10 5M31 55h35M84 60V33m0 12c-10 1-13-3-14-8 8-1 12 1 14 8m0 6c10 1 13-3 14-8-8-1-12 1-14 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="84" cy="25" r="7" stroke="currentColor" /><circle cx="15" cy="22" r="2" fill="currentColor" />
    </> : templateKey === "THANKSGIVING" ? <>
      <path d="M60 64c-22-7-35-23-32-44 19-2 40 12 42 31M60 64c-2-22 10-39 31-42 3 21-9 37-31 42Z" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="1.3" />
      <path d="m40 32 20 32m0 0 19-29m-19 29-2 8M36 48l17 5m18-7 11-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </> : templateKey === "SUMMER" || templateKey === "CLASSIC" ? <>
      <circle cx="60" cy="40" r="17" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="1.3" />
      <path d="M60 9v8m0 46v8M29 40h8m46 0h8M38 18l6 6m32 32 6 6M38 62l6-6m32-32 6-6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      {templateKey === "SUMMER" && <path d="M10 69c8-5 12 5 20 0s12 5 20 0m28 0c8-5 12 5 20 0s12 5 20 0" stroke="currentColor" strokeOpacity=".6" />}
    </> : <>
      <path d="m60 15 6 19 19 6-19 6-6 19-6-19-19-6 19-6 6-19Z" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="m24 19 2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7Zm71 29 2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7Z" stroke="currentColor" />
      <path d="m91 16-3 7M25 57l-4 6M103 33h6M45 67l2 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="77" cy="13" r="1.5" fill="currentColor" />
    </>}
  </svg>;
}
