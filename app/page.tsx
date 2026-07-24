import { LandingHero } from '@/components/LandingHero';
import { TechnicalMarquee } from '@/components/TechnicalMarquee';
import { BentoGrid } from '@/components/BentoGrid';
import { ArchitectureDiagram } from '@/components/ArchitectureDiagram';
import { PricingSection } from '@/components/PricingSection';

export default function HomePage() {
  return (
    <div className="space-y-0">
      <LandingHero />
      <TechnicalMarquee />
      <BentoGrid />
      <ArchitectureDiagram />
      <PricingSection />
    </div>
  );
}
