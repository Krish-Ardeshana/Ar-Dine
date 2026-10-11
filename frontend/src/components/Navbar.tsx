'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const { user, isAuthenticated, logout, isLoading } = useAuth();

  return (
    <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 font-bold text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            AR
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white group-hover:text-blue-400 transition-colors">
              AR-DINE
            </span>
            <span className="ml-2 rounded-full border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-[11px] font-medium text-neutral-400">
              CEUP301 Sem V
            </span>
          </div>
        </Link>

        {/* Auth Nav State */}
        <nav className="flex items-center gap-4">
          {isLoading ? (
            <div className="h-8 w-24 animate-pulse rounded-lg bg-neutral-900" />
          ) : isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-semibold text-neutral-200">
                  {user.name}
                </span>
                <span className="text-[11px] font-mono text-neutral-400">
                  {user.globalRoles.join(', ')}
                </span>
              </div>

              <span className="h-6 w-[1px] bg-neutral-800 hidden sm:block" />

              <Link
                href="/dashboard"
                className="rounded-lg bg-emerald-600/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-600 hover:text-white transition"
              >
                Dashboard
              </Link>

              <button
                onClick={() => logout()}
                className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:border-red-900/60 hover:bg-red-950/30 hover:text-red-400"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-neutral-300 transition-colors hover:text-white"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 shadow-sm shadow-blue-600/30"
              >
                Create Account
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
