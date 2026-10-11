'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  createTable,
  deleteTable,
  fetchMyRestaurants,
  fetchTableQr,
  fetchTables,
  updateTable,
} from '@/lib/api-client';
import { Restaurant } from '@/types/restaurant';
import {
  CreateTablePayload,
  RestaurantTableItem,
  TableQrResponse,
  TableStatus,
} from '@/types/table';

export default function TablesDashboardPage() {
  const [activeRestaurant, setActiveRestaurant] = useState<Restaurant | null>(null);
  const [tables, setTables] = useState<RestaurantTableItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [editingTable, setEditingTable] = useState<RestaurantTableItem | null>(null);
  const [activeQrModal, setActiveQrModal] = useState<TableQrResponse | null>(null);

  // Form states
  const [tableNumber, setTableNumber] = useState<string>('');
  const [capacity, setCapacity] = useState<number>(4);
  const [status, setStatus] = useState<TableStatus>('AVAILABLE');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Copy URL state
  const [copied, setCopied] = useState<boolean>(false);

  const loadTables = useCallback(async (restaurantId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchTables(restaurantId);
      setTables(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tables');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyRestaurants()
      .then((rests) => {
        if (rests.length > 0) {
          setActiveRestaurant(rests[0]);
          return loadTables(rests[0].id);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch restaurants');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [loadTables]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRestaurant) return;
    if (!tableNumber.trim()) {
      setFormError('Table number or name is required');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const payload: CreateTablePayload = {
        tableNumber: tableNumber.trim(),
        capacity: Number(capacity) || 4,
        operationalStatus: status,
      };
      await createTable(activeRestaurant.id, payload);
      setIsCreateOpen(false);
      setTableNumber('');
      setCapacity(4);
      setStatus('AVAILABLE');
      await loadTables(activeRestaurant.id);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create table');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRestaurant || !editingTable) return;

    setIsSubmitting(true);
    setFormError(null);
    try {
      await updateTable(activeRestaurant.id, editingTable.id, {
        tableNumber: tableNumber.trim(),
        capacity: Number(capacity),
        operationalStatus: status,
      });
      setEditingTable(null);
      await loadTables(activeRestaurant.id);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to update table');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (table: RestaurantTableItem) => {
    if (!activeRestaurant) return;
    const confirm = window.confirm(
      `Are you sure you want to archive "${table.tableNumber}"? Any existing QR code for this table will be taken out of service.`,
    );
    if (!confirm) return;

    try {
      await deleteTable(activeRestaurant.id, table.id);
      await loadTables(activeRestaurant.id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to archive table');
    }
  };

  const handleViewQr = async (table: RestaurantTableItem) => {
    if (!activeRestaurant) return;
    try {
      const qrData = await fetchTableQr(activeRestaurant.id, table.id);
      setActiveQrModal(qrData);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to generate table QR');
    }
  };

  const handleCopyLink = () => {
    if (!activeQrModal) return;
    navigator.clipboard.writeText(activeQrModal.targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openEditModal = (table: RestaurantTableItem) => {
    setEditingTable(table);
    setTableNumber(table.tableNumber);
    setCapacity(table.capacity);
    setStatus(table.operationalStatus);
    setFormError(null);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>🪑</span> Table Management & QR Codes
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Generate immutable physical QR codes that remain stable even when menu prices or dishes change.
          </p>
        </div>

        <button
          onClick={() => {
            setIsCreateOpen(true);
            setTableNumber('');
            setCapacity(4);
            setStatus('AVAILABLE');
            setFormError(null);
          }}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-emerald-950/40"
        >
          <span>➕</span> Add Table
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Tables Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-zinc-400 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Loading restaurant tables...</p>
        </div>
      ) : tables.length === 0 ? (
        <div className="text-center py-20 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-8">
          <div className="text-4xl mb-3">🪑</div>
          <h3 className="text-lg font-semibold text-white mb-1">No Tables Configured</h3>
          <p className="text-sm text-zinc-400 mb-6 max-w-sm mx-auto">
            Add physical dining tables to generate stable QR codes for customer self-ordering.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-xl text-sm transition"
          >
            Create First Table
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tables.map((table) => (
            <div
              key={table.id}
              className="bg-zinc-950/80 border border-zinc-800/90 rounded-2xl p-5 hover:border-zinc-700 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>{table.tableNumber}</span>
                  </h3>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      table.operationalStatus === 'AVAILABLE'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : table.operationalStatus === 'OCCUPIED'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : table.operationalStatus === 'RESERVED'
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}
                  >
                    {table.operationalStatus}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-zinc-400 mb-4">
                  <p className="flex justify-between">
                    <span className="text-zinc-500">Seating Capacity:</span>
                    <span className="text-zinc-300 font-medium">{table.capacity} Guests</span>
                  </p>
                  <p className="flex justify-between font-mono">
                    <span className="text-zinc-500">Immutable Token:</span>
                    <span className="text-zinc-400 text-[10px] truncate max-w-[140px]">
                      {table.tableToken}
                    </span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleViewQr(table)}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border border-zinc-700/80 text-xs font-medium transition flex items-center justify-center gap-1.5"
                >
                  <span>📷</span> View QR
                </button>
                <button
                  onClick={() => openEditModal(table)}
                  className="py-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 text-xs font-medium transition"
                  title="Edit Table"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleArchive(table)}
                  className="py-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-red-950/40 text-red-400 border border-zinc-700/80 text-xs font-medium transition"
                  title="Archive Table"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Table Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-1">Add Dining Table</h2>
            <p className="text-xs text-zinc-400 mb-5">
              Creates a table record with a cryptographically unique, immutable tableToken.
            </p>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Table Number or Label *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Table 1, Terrace-04, Booth B"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Seating Capacity (Guests)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={capacity}
                  onChange={(e) => setCapacity(parseInt(e.target.value, 10))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Initial Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TableStatus)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="OCCUPIED">OCCUPIED</option>
                  <option value="RESERVED">RESERVED</option>
                  <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-xl text-xs transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Table Modal */}
      {editingTable && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-1">Edit Table: {editingTable.tableNumber}</h2>
            <p className="text-xs text-zinc-400 mb-5">
              Table token remains immutable to preserve scannability of printed QR codes.
            </p>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Table Number or Label *
                </label>
                <input
                  type="text"
                  required
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Seating Capacity (Guests)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={capacity}
                  onChange={(e) => setCapacity(parseInt(e.target.value, 10))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Operational Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TableStatus)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="OCCUPIED">OCCUPIED</option>
                  <option value="RESERVED">RESERVED</option>
                  <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-xl text-xs transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Preview & Print Modal */}
      {activeQrModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl relative">
            <button
              onClick={() => setActiveQrModal(null)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white text-xl"
            >
              ✕
            </button>

            {/* Printable Label View */}
            <div
              id="printable-table-label"
              className="bg-white text-slate-900 rounded-2xl p-6 text-center shadow-md mb-6"
            >
              <div className="mb-2">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-700 block">
                  {activeQrModal.restaurantName}
                </span>
                <h3 className="text-2xl font-black text-slate-900">{activeQrModal.tableNumber}</h3>
              </div>

              {/* QR Image */}
              <div className="bg-white p-3 inline-block rounded-xl border border-slate-200 shadow-inner my-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeQrModal.qrDataUrl}
                  alt={`QR Code for ${activeQrModal.tableNumber}`}
                  className="w-56 h-56 mx-auto object-contain"
                />
              </div>

              <p className="text-xs text-slate-600 font-medium mt-1">
                Scan with phone camera to browse interactive 3D menu & order
              </p>
              <p className="text-[9px] font-mono text-slate-400 mt-2 truncate">
                {activeQrModal.targetUrl}
              </p>
            </div>

            {/* Actions for Modal */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={activeQrModal.targetUrl}
                  className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs font-mono text-zinc-300 select-all"
                />
                <button
                  onClick={handleCopyLink}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium px-3 py-2 rounded-xl transition"
                >
                  {copied ? 'Copied! ✓' : 'Copy URL'}
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <a
                  href={activeQrModal.qrDataUrl}
                  download={`${activeQrModal.restaurantSlug}-${activeQrModal.tableNumber}-qr.png`}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs text-center transition flex items-center justify-center gap-1.5"
                >
                  <span>⬇️</span> Download PNG
                </a>

                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs text-center transition flex items-center justify-center gap-1.5"
                >
                  <span>🖨️</span> Print Label
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
