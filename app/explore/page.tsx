import type { Metadata } from "next";
import { ZodiacApp } from "../components/ZodiacApp";

export const metadata: Metadata = {
  title: "探索12星座人格",
  description: "浏览、试听并导出12套开放AI星座沟通人格。",
};

export default function ExplorePage() {
  return <ZodiacApp initialView="explore" />;
}
