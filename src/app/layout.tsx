import type { Metadata } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";

const face = Atkinson_Hyperlegible({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-atkinson",
});

export const metadata: Metadata = {
  title: "NawiMark",
  description: "OIML R-76 type-evaluation reports for model approval — SIH26035",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${face.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/*
          THESIS: A type-approval bench sheet, not a SaaS dashboard. Numbers and the 11 g fail lead; cards do not.
          OWN-WORLD: Cool fluorescent lab paper, ink navy, steel rules, vermillion refuse stamp. Atkinson Hyperlegible.
          STORY: Tester enters observations; pack marks type-eval; reviewer sees why Grant is blocked.
          FIRST VIEWPORT: Sign-in on a stamped desk. Mocked accounts named as mocked. No hero metrics.
          FORM: Type-approval desk / operate. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
        */}
        {children}
      </body>
    </html>
  );
}
