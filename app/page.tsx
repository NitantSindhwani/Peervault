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
      
      {/* Live Speed & Transfer Showcase Section */}
      <section className="py-20 bg-[var(--bg-main)] border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="space-y-2">
            <span className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider">Live Speed Monitor</span>
            <h2 className="text-3xl font-bold text-[var(--text-primary)] font-display">Real-Time Transfer Speed & Health</h2>
            <p className="text-sm text-[var(--text-secondary)] font-mono">
              Live visual feedback showing transfer speed, connection ping, memory safety, and file completion.
            </p>
          </div>
          <TelemetryDashboard mock={true} />
        </div>
      </section>

      <PricingSection />
    </div>
  );
}
