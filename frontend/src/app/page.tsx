'use client';

import Link from 'next/link';
import BackendHealthStatus from '@/components/BackendHealthStatus';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { user, isAuthenticated } = useAuth();

  const phases = [
    {
      num: '0',
      title: 'Toolchain & Repository Baseline',
      status: 'COMPLETED',
      details: 'Node.js v24 LTS runtime, Git baseline, .gitignore, and docs scaffolded.',
    },
    {
      num: '1',
      title: 'Monorepo Scaffolding & Configuration',
      status: 'COMPLETED',
      details: 'NestJS modular backend + Next.js App Router frontend with typed health probe.',
    },
    {
      num: '2',
      title: 'Database Schemas & Multi-Tenant Core',
      status: 'COMPLETED',
      details: 'MongoDB Atlas + Mongoose schemas for Restaurants, Menus, Tables, and Orders.',
    },
    {
      num: '3',
      title: 'Authentication & Role-Based Access Control',
      status: 'COMPLETED',
      details: 'JWT access & refresh tokens, password hashing, and tenant-scoped authorization guards.',
    },
    {
      num: '4',
      title: 'Menu Management & 3D/AR Asset Pipeline',
      status: 'COMPLETED',
      details: 'Restaurant onboarding, category CRUD, dish management, and Google <model-viewer> 3D food preview.',
    },
    {
      num: '5',
      title: 'Table QR & Customer Ordering Flow',
      status: 'PLANNED',
      details: 'Immutable table QR tokens, responsive digital menu, and cart state.',
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      {/* Subheader / Banner */}
      <div className="border-b border-neutral-900 bg-neutral-950/60 px-6 py-2.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-xs">
          <span className="text-neutral-400">
            College Project-I • Course CEUP301
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Phase 4 Verified • Menu Management & 3D AR Pipeline
          </span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-6 py-12">
          {/* Active Session Card if logged in */}
          {isAuthenticated && user && (
            <section className="mb-10 rounded-xl border border-blue-900/40 bg-blue-950/20 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                    Active Session Verified
                  </span>
                  <h2 className="text-xl font-bold text-white mt-1">
                    Welcome back, {user.name}
                  </h2>
                  <p className="text-sm text-neutral-400 mt-0.5">
                    Logged in as <span className="font-mono text-neutral-200">{user.email}</span> • Global Role:{' '}
                    <span className="font-semibold text-blue-300">{user.globalRoles.join(', ')}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-blue-900/40 px-3 py-1.5 text-xs font-medium text-blue-300 border border-blue-800/50">
                    Account Status: {user.accountStatus}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Hero Section */}
          <section className="mb-12">
            <div className="max-w-3xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                Phase 3 • Identity & Authorization
              </span>
              <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                AR Smart Restaurant Management System
              </h1>
              <p className="mt-4 text-lg text-neutral-400 leading-relaxed">
                A multi-tenant smart dining platform integrating Next.js, NestJS, MongoDB Atlas, and WebXR-based 3D dish visualization. Phase 3 provides role-based access control, tenant boundary guards, and customer identity.
              </p>

              {isAuthenticated ? (
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/dashboard"
                    className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-500 transition-colors flex items-center space-x-2"
                  >
                    <span>🏪 Go to Staff Dashboard</span>
                  </Link>
                </div>
              ) : (
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/register"
                    className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 transition-colors"
                  >
                    Register as Customer
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-neutral-200 hover:bg-neutral-800 transition-colors"
                  >
                    Sign In
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* Real-time Health Integration Probe */}
          <section className="mb-14">
            <BackendHealthStatus />
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
                        phase.status === 'COMPLETED'
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-900/50'
                          : phase.status === 'ACTIVE'
                          ? 'bg-blue-950/80 text-blue-400 border border-blue-900/50 animate-pulse'
                          : 'bg-neutral-800 text-neutral-400'
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
