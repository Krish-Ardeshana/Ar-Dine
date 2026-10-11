'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { acceptInvitation } from '@/lib/api-client';

function AcceptInvitationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshUser } = useAuth();

  const [token, setToken] = useState<string>(() => searchParams.get('token') || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await acceptInvitation(token.trim());
      setSuccessMessage(res.message);
      await refreshUser();
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to accept invitation';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto text-2xl">
            ✉️
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Invitation Acceptance</h1>
          <p className="text-zinc-400 text-sm">
            Enter your secure single-use invitation token to join your restaurant team.
          </p>
        </div>

        {user && (
          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-400 flex items-center justify-between">
            <span>Accepting as:</span>
            <span className="font-semibold text-zinc-200">{user.email}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-center">
            {successMessage}
            <p className="text-xs text-emerald-500 mt-1">Redirecting to Dashboard...</p>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 block mb-1 font-medium">
              Invitation Token (64-character Hex)
            </label>
            <input
              type="text"
              placeholder="Paste invitation token here..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !token.trim()}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition cursor-pointer shadow-lg shadow-emerald-950"
          >
            {isSubmitting ? 'Verifying Token...' : 'Accept Invitation & Join'}
          </button>
        </form>

        <div className="text-center pt-2">
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-400">
            ← Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">
          Loading invitation...
        </div>
      }
    >
      <AcceptInvitationForm />
    </Suspense>
  );
}
