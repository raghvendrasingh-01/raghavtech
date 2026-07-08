import { MarketingNav } from "@/components/marketing/marketing-nav";
import { Hero } from "@/components/marketing/hero";
import { Stats } from "@/components/marketing/stats";
import { Features } from "@/components/marketing/features";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Testimonials } from "@/components/marketing/testimonials";
import { FAQ } from "@/components/marketing/faq";
import { CTA } from "@/components/marketing/cta";
import { Footer } from "@/components/marketing/footer";

import { authMode } from "@/lib/auth";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/** Marketing landing page — the first impression for judges & users. */
export default async function LandingPage() {
  const mode = authMode();
  if (mode === "clerk") {
    const { userId } = await auth();
    if (userId) redirect("/dashboard");
  }

  return (
    <div className="relative">
      <MarketingNav />
      <main>
        <Hero />
        <Stats />
        <Features />
        <HowItWorks />
        <Testimonials />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
