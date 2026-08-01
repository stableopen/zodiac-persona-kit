import { ZodiacApp } from "./components/ZodiacApp";
import { parseDuelShareParams } from "../src/lib/duel";

type HomeSearchParams = Record<string, string | string[] | undefined>;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  const params = await searchParams;
  const persona = typeof params.persona === "string" ? params.persona : undefined;
  return (
    <ZodiacApp
      initialView="home"
      sharedPersonaId={persona}
      sharedDuel={parseDuelShareParams(params) ?? undefined}
    />
  );
}
