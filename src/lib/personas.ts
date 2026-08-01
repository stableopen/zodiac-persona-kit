import ariesJson from "../../personas/aries.json";
import aquariusJson from "../../personas/aquarius.json";
import cancerJson from "../../personas/cancer.json";
import capricornJson from "../../personas/capricorn.json";
import geminiJson from "../../personas/gemini.json";
import leoJson from "../../personas/leo.json";
import libraJson from "../../personas/libra.json";
import piscesJson from "../../personas/pisces.json";
import sagittariusJson from "../../personas/sagittarius.json";
import scorpioJson from "../../personas/scorpio.json";
import taurusJson from "../../personas/taurus.json";
import virgoJson from "../../personas/virgo.json";
import { validatePersona, type ZodiacId, type ZodiacPersona } from "./zodiac";

const sourcePersonas: unknown[] = [
  ariesJson,
  taurusJson,
  geminiJson,
  cancerJson,
  leoJson,
  virgoJson,
  libraJson,
  scorpioJson,
  sagittariusJson,
  capricornJson,
  aquariusJson,
  piscesJson,
];

export const PERSONAS: ZodiacPersona[] = sourcePersonas.map(validatePersona);

export const PERSONAS_BY_ID = Object.fromEntries(
  PERSONAS.map((persona) => [persona.id, persona]),
) as Partial<Record<ZodiacId, ZodiacPersona>>;

export function getPersona(id: string): ZodiacPersona | undefined {
  return PERSONAS_BY_ID[id as ZodiacId];
}
