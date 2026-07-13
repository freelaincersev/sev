import Image from "next/image";

import { cn } from "@/lib/utils";

/** hungry ⇒ the "sad" art; fed ⇒ the "happy" art. */
export type MascotMood = "hungry" | "happy";

/** The C-suite character set living in /public/mascot/{persona}_{sad|happy}.png. */
export const MASCOT_PERSONAS = ["caio", "ceo", "cfo", "cmo", "cto"] as const;
export type MascotPersona = (typeof MASCOT_PERSONAS)[number];

/**
 * Deterministically pick a persona from a stable seed (a folder or project id)
 * so a given folder always shows the same character. Later, an explicit
 * `folders.avatar_preset` can override this default.
 */
export function mascotPersonaFor(seed: string): MascotPersona {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum = (sum + seed.charCodeAt(i)) % 997;
  return MASCOT_PERSONAS[sum % MASCOT_PERSONAS.length];
}

/** Use the folder's chosen preset if valid, else a stable one from the seed. */
export function resolveMascotPersona(
  preset: string | null | undefined,
  seed: string,
): MascotPersona {
  if (preset && (MASCOT_PERSONAS as readonly string[]).includes(preset)) {
    return preset as MascotPersona;
  }
  return mascotPersonaFor(seed);
}

/**
 * The character slot for empty states. Renders the real art from /public/mascot
 * via next/image (which downscales the large source PNGs to the display size).
 */
export function Mascot({
  persona = "ceo",
  mood = "hungry",
  size = 128,
  className,
}: {
  persona?: MascotPersona;
  mood?: MascotMood;
  size?: number;
  className?: string;
}) {
  const variant = mood === "hungry" ? "sad" : "happy";
  return (
    <Image
      src={`/mascot/${persona}_${variant}.png`}
      width={size}
      height={size}
      alt=""
      aria-hidden
      className={cn("select-none object-contain", className)}
    />
  );
}
