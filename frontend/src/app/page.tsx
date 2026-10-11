import BackendHealthStatus from "@/components/BackendHealthStatus";

export default function Home() {
  const phases = [
    {
      num: "0",
      title: "Toolchain & Repository Baseline",
      status: "COMPLETED",
      details: "Node.js v24 LTS runtime, Git baseline, .gitignore, and docs scaffolded.",
    },
    {
      num: "1",
      title: "Monorepo Scaffolding & Configuration",
      status: "ACTIVE",
      details: "NestJS modular backend + Next.js App Router frontend with typed health probe.",
    },
    {
      num: "2",
      title: "Database Schemas & Multi-Tenant Core",
      status: "PLANNED",
      details: "MongoDB Atlas + Mongoose schemas for Restaurants, Menus, Tables, and Orders.",
    },
    {
      num: "3",
      title: "Authentication & Role-Based Access Control",
      status: "PLANNED",
      details: "JWT with Argon2/Bcrypt password hashing and tenant-scoped authorization guards.",
    },
    {
      num: "4",
      title: "Menu Management & 3D/AR Asset Pipeline",
      status: "PLANNED",
      details: "GLB/GLTF model management with Google <model-viewer> and WebXR fallbacks.",
    },
    {
      num: "5",
      title: "Table QR & Customer Ordering Flow",
      status: "PLANNED",
      details: "Immutable table QR tokens, responsive digital menu, and cart state.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 font-bold text-white shadow-lg shadow-blue-500/20">
              AR
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">AR-DINE</span>
              <span className="ml-2 rounded-full border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-[11px] font-medium text-neutral-400">
                CEUP301 Sem V
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Under Active Development
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-6 py-12">
          {/* Hero Section */}
          <section className="mb-12">
            <div className="max-w-3xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                Phase 1 • Scaffolding & Verification
              </span>
              <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                AR Smart Restaurant Management System
              </h1>
              <p className="mt-4 text-lg text-neutral-400 leading-relaxed">
                A multi-tenant smart dining platform integrating Next.js, NestJS, MongoDB Atlas, and WebXR-based 3D dish visualization. The application core is currently being engineered in verified phases.
              </p>
            </div>
          </section>

          {/* Real-time Health Integration Probe */}
          <section className="mb-14">
            <BackendHealthStatus />
          </section>

          {/* Development Notice */}
          <section className="mb-14 rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-neutral-800 p-2 text-neutral-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-neutral-200">
                  Development State Notice
                </h3>
                <p className="mt-1 text-sm text-neutral-400">
                  Production flows (Customer Ordering, Table QR Scanning, Restaurant Admin Dashboard, and 3D AR Model Viewers) are intentionally not mocked with fake data in this phase. Real capabilities will activate in Phase 2 through Phase 6 upon database schema deployment and authentication configuration.
                </p>
              </div>
            </div>
          </section>

          {/* Architecture Roadmap */}
          <section>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  Phased Engineering Roadmap
                </h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Strictly validated progression according to course instructions.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {phases.map((phase) => (
                <div
                  key={phase.num}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 transition-colors hover:border-neutral-700"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-neutral-500">
                      PHASE {phase.num}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                        phase.status === "COMPLETED"
                          ? "bg-emerald-950/80 text-emerald-400 border border-emerald-900/50"
                          : phase.status === "ACTIVE"
                          ? "bg-blue-950/80 text-blue-400 border border-blue-900/50 animate-pulse"
                          : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {phase.status}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-neutral-200">
                    {phase.title}
                  </h3>
                  <p className="mt-2 text-xs text-neutral-400 leading-normal">
                    {phase.details}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800 bg-neutral-950 py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-xs text-neutral-500 sm:flex-row">
          <div>
            AR-DINE • College Project-I (CEUP301) • Semester V
          </div>
          <div>
            Krish Ardeshana • Next.js & NestJS Full-Stack Architecture
          </div>
        </div>
      </footer>
    </div>
  );
}
