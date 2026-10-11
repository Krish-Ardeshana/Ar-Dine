'use client';

import React, { useEffect, useState } from 'react';
import { fetchMyRestaurants, updateRestaurant } from '@/lib/api-client';
import { OperationalStatus, PublicationStatus, Restaurant } from '@/types/restaurant';

export default function DashboardOverviewPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [publicationStatus, setPublicationStatus] = useState<PublicationStatus>(PublicationStatus.DRAFT);
  const [operationalStatus, setOperationalStatus] = useState<OperationalStatus>(OperationalStatus.OPEN);

  useEffect(() => {
    fetchMyRestaurants()
      .then((list) => {
        if (list.length > 0) {
          const r = list[0];
          setRestaurant(r);
          setName(r.name);
          setDescription(r.description || '');
          setPhone(r.contact?.phone || '');
          setEmail(r.contact?.email || '');
          setStreet(r.address?.street || '');
          setCity(r.address?.city || '');
          setPublicationStatus(r.publicationStatus);
          setOperationalStatus(r.operationalStatus);
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load restaurant profile';
        setErrorMessage(msg);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;

    setIsSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const updated = await updateRestaurant(restaurant.id, {
        name,
        description,
        contact: { ...restaurant.contact, email, phone },
        address: { ...restaurant.address, street, city },
        publicationStatus,
        operationalStatus,
      });

      setRestaurant(updated);
      setStatusMessage('Restaurant profile updated successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save changes';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center text-zinc-400">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="text-zinc-400 text-center py-10">
        No restaurant available.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Restaurant Settings</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Configure identity, public catalog status, and dining operational hours.
        </p>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Status controls card */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold">Catalog & Operational Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-medium">
                Public Publication Status
              </label>
              <select
                value={publicationStatus}
                onChange={(e) => setPublicationStatus(e.target.value as PublicationStatus)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              >
                <option value={PublicationStatus.DRAFT}>DRAFT (Hidden from Public)</option>
                <option value={PublicationStatus.PUBLISHED}>PUBLISHED (Visible to Diners)</option>
                <option value={PublicationStatus.ARCHIVED}>ARCHIVED (Offline)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-medium">
                Operational Status
              </label>
              <select
                value={operationalStatus}
                onChange={(e) => setOperationalStatus(e.target.value as OperationalStatus)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              >
                <option value={OperationalStatus.OPEN}>OPEN (Accepting Orders)</option>
                <option value={OperationalStatus.PAUSED}>PAUSED (Kitchen Busy)</option>
                <option value={OperationalStatus.CLOSED}>CLOSED</option>
              </select>
            </div>
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold">General Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-medium">
                Restaurant Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-medium">
                Slug (Read-Only)
              </label>
              <input
                type="text"
                value={restaurant.slug}
                disabled
                className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-500 cursor-not-allowed font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1 font-medium">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-medium">
                Contact Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-medium">
                Contact Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-medium">
                Street Address
              </label>
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-medium">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Submit button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition cursor-pointer shadow-lg shadow-emerald-950"
          >
            {isSaving ? 'Saving Changes...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
