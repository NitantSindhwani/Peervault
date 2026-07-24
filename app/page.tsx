import { LandingHero } from '@/components/LandingHero';
import { BentoGrid } from '@/components/BentoGrid';
import { ArchitectureDiagram } from '@/components/ArchitectureDiagram';
import { TelemetryDashboard } from '@/components/TelemetryDashboard';
import { PricingSection } from '@/components/PricingSection';

export default function HomePage() {
  return (
    <div className="space-y-0">
      <LandingHero />
      <BentoGrid />
      <ArchitectureDiagram />
      
      {/* Telemetry Live Showcase Section */}
      <section className="py-20 bg-[var(--bg-main)] border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="space-y-2">
            <span className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider">Live System Metrics</span>
            <h2 className="text-3xl font-bold text-[var(--text-primary)]">Telemetry & Flow Control Inspection</h2>
          </div>
          <TelemetryDashboard mock={true} />
        </div>
      </section>

      <PricingSection />
    </div>
  );
}
