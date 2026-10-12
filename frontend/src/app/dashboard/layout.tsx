'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { fetchMyRestaurants } from '@/lib/api-client';
import { Restaurant } from '@/types/restaurant';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [isFetchingRestaurants, setIsFetchingRestaurants] = useState<boolean>(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchMyRestaurants()
        .then((data) => {
          setRestaurants(data);
          if (data.length > 0) {
            setSelectedRestaurant(data[0]);
          }
        })
        .catch(() => {
          setRestaurants([]);
        })
        .finally(() => {
          setIsFetchingRestaurants(false);
        });
    }
  }, [user, isLoading, isAuthenticated, router]);

  if (isLoading || isFetchingRestaurants) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-zinc-400">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium">Verifying Staff Authorization...</p>
        </div>
      </div>
    );
  }

  const isStaffOrAdmin =
    (user?.globalRoles || []).some((r) => r === 'SUPER_ADMIN') ||
    Boolean(user?.memberships && user.memberships.length > 0);

  if (!isStaffOrAdmin) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
            🔒
          </div>
          <h1 className="text-xl font-bold mb-2">Staff Authorization Required</h1>
          <p className="text-zinc-400 text-sm mb-6">
            Your account ({user?.email}) is registered with customer permissions. Access to restaurant management requires an authorized staff membership.
          </p>
          <div className="space-y-3">
            <Link
              href="/invitations/accept"
              className="block w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition"
            >
              Accept Staff Invitation
            </Link>
            <Link
              href="/"
              className="block w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-sm transition"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const navLinks = [
    { href: '/dashboard', label: 'Overview & Profile', icon: '🏪' },
    { href: '/dashboard/kitchen', label: 'Kitchen Display (KDS)', icon: '👨‍🍳' },
    { href: '/dashboard/categories', label: 'Categories', icon: '📁' },
    { href: '/dashboard/menu', label: 'Dish Catalog', icon: '🍽️' },
    { href: '/dashboard/menu/new', label: 'Add New Dish', icon: '✨' },
    { href: '/dashboard/tables', label: 'Tables & QR Codes', icon: '🪑' },
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-zinc-950 border-r border-zinc-800/80 p-5 flex flex-col justify-between">
        <div className="space-y-6">
          {/* Restaurant Selector */}
          <div>
            <label className="text-[11px] font-semibold tracking-wider uppercase text-zinc-500 mb-1.5 block">
              Active Restaurant
            </label>
            {restaurants.length > 0 ? (
              <select
                aria-label="Active Restaurant Selection"
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                value={selectedRestaurant?.id || ''}
                onChange={(e) => {
                  const target = restaurants.find((r) => r.id === e.target.value);
                  if (target) setSelectedRestaurant(target);
                }}
              >
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                No provisioned restaurants found.
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  <span className="text-lg">{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer info */}
        <div className="pt-6 border-t border-zinc-800/80 text-xs text-zinc-500">
          <div className="flex items-center space-x-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-mono text-zinc-400">Phase 5 Active</span>
          </div>
          <p className="text-[11px] text-zinc-600">Table QR & Dining Session Engine</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-6xl">
        {selectedRestaurant ? (
          children
        ) : (
          <div className="text-center py-20">
            <h2 className="text-xl font-bold mb-2">No Restaurant Selected</h2>
            <p className="text-zinc-400 text-sm">
              Please contact an administrator to provision your restaurant access.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
