'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelStaffOrder,
  fetchKitchenQueue,
  fetchMyRestaurants,
  getApiBaseUrl,
  updateOrderStatus,
} from '@/lib/api-client';
import { Order, OrderStatus } from '@/types/order';
import { Restaurant } from '@/types/restaurant';

export default function KitchenDashboardPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'LIVE' | 'POLLING' | 'CONNECTING'>('CONNECTING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  // Cancellation modal state
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load restaurants
  useEffect(() => {
    let active = true;
    fetchMyRestaurants()
      .then((data) => {
        if (!active) return;
        setRestaurants(data);
        if (data.length > 0) {
          setSelectedRestaurant(data[0]);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load restaurants');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Fetch kitchen orders for selected restaurant
  const refreshQueue = useCallback(async () => {
    if (!selectedRestaurant) return;
    try {
      const queue = await fetchKitchenQueue(selectedRestaurant.id);
      setOrders(queue);
      setErrorMessage(null);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to refresh kitchen orders');
    }
  }, [selectedRestaurant]);

  // Initial load when selected restaurant changes
  useEffect(() => {
    let active = true;
    if (!selectedRestaurant) return;

    fetchKitchenQueue(selectedRestaurant.id)
      .then((queue) => {
        if (!active) return;
        setOrders(queue);
        setErrorMessage(null);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setErrorMessage(err instanceof Error ? err.message : 'Failed to refresh kitchen orders');
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedRestaurant]);

  // Real-time synchronization: SSE stream with polling fallback
  useEffect(() => {
    if (!selectedRestaurant) return;

    const restaurantId = selectedRestaurant.id;
    const sseUrl = `${getApiBaseUrl()}/restaurants/${restaurantId}/orders/events`;

    const sse = new EventSource(sseUrl, { withCredentials: false });
    eventSourceRef.current = sse;

    sse.onopen = () => {
      setSyncStatus('LIVE');
    };

    sse.addEventListener('ORDER_PLACED', () => {
      refreshQueue();
    });

    sse.addEventListener('ORDER_UPDATED', () => {
      refreshQueue();
    });

    sse.addEventListener('ORDER_CANCELLED', () => {
      refreshQueue();
    });

    sse.onerror = () => {
      setSyncStatus('POLLING');
      sse.close();
    };

    // Intelligent Polling Fallback (every 5 seconds, visibility aware)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshQueue();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshQueue();
      }
    }, 5000);
    pollingTimerRef.current = interval;

    return () => {
      sse.close();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedRestaurant, refreshQueue]);

  // State machine transition handler
  const handleTransition = async (order: Order, targetStatus: OrderStatus) => {
    if (!selectedRestaurant || isUpdating) return;
    setIsUpdating(order.id);
    try {
      await updateOrderStatus(selectedRestaurant.id, order.id, targetStatus);
      await refreshQueue();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert(`Status transition failed: ${msg}`);
    } finally {
      setIsUpdating(null);
    }
  };

  // Cancellation submission handler
  const handleConfirmCancel = async () => {
    if (!selectedRestaurant || !cancelModalOrder || isUpdating) return;
    setIsUpdating(cancelModalOrder.id);
    try {
      await cancelStaffOrder(
        selectedRestaurant.id,
        cancelModalOrder.id,
        cancelReason || 'Cancelled by kitchen staff',
      );
      setCancelModalOrder(null);
      setCancelReason('');
      await refreshQueue();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert(`Cancellation failed: ${msg}`);
    } finally {
      setIsUpdating(null);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Helper to format elapsed minutes
  const getElapsedMinutes = (dateString?: string) => {
    if (!dateString) return 0;
    const diffMs = now - new Date(dateString).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    if (filterStatus === 'ALL') return true;
    return o.status === filterStatus;
  });

  const countByStatus = {
    PLACED: orders.filter((o) => o.status === 'PLACED').length,
    CONFIRMED: orders.filter((o) => o.status === 'CONFIRMED').length,
    PREPARING: orders.filter((o) => o.status === 'PREPARING').length,
    READY: orders.filter((o) => o.status === 'READY').length,
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span>👨‍🍳</span> Kitchen Display System (KDS)
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time FIFO ticket queue and kitchen fulfillment state machine
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Restaurant Selector */}
          {restaurants.length > 1 && (
            <select
              value={selectedRestaurant?.id || ''}
              onChange={(e) => {
                const found = restaurants.find((r) => r.id === e.target.value);
                if (found) setSelectedRestaurant(found);
              }}
              className="px-3 py-2 bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm rounded-xl focus:outline-none focus:border-amber-500"
            >
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}

          {/* Sync Status Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              syncStatus === 'LIVE'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : syncStatus === 'POLLING'
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus === 'LIVE'
                  ? 'bg-emerald-400 animate-pulse'
                  : syncStatus === 'POLLING'
                  ? 'bg-cyan-400'
                  : 'bg-amber-400 animate-ping'
              }`}
            />
            {syncStatus === 'LIVE'
              ? 'Real-Time SSE'
              : syncStatus === 'POLLING'
              ? 'Live Polling (5s)'
              : 'Connecting...'}
          </div>

          {/* Manual Refresh */}
          <button
            onClick={refreshQueue}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition text-sm flex items-center justify-center"
            title="Refresh Orders"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilterStatus('ALL')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
            filterStatus === 'ALL'
              ? 'bg-amber-500 text-black font-semibold'
              : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
          }`}
        >
          All Active ({orders.length})
        </button>
        <button
          onClick={() => setFilterStatus('PLACED')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
            filterStatus === 'PLACED'
              ? 'bg-blue-600 text-white font-semibold'
              : 'bg-zinc-900 text-blue-400 hover:bg-zinc-800'
          }`}
        >
          <span>Incoming</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20">
            {countByStatus.PLACED}
          </span>
        </button>
        <button
          onClick={() => setFilterStatus('CONFIRMED')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
            filterStatus === 'CONFIRMED'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'bg-zinc-900 text-indigo-400 hover:bg-zinc-800'
          }`}
        >
          <span>Accepted</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-500/20">
            {countByStatus.CONFIRMED}
          </span>
        </button>
        <button
          onClick={() => setFilterStatus('PREPARING')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
            filterStatus === 'PREPARING'
              ? 'bg-amber-500 text-black font-semibold'
              : 'bg-zinc-900 text-amber-400 hover:bg-zinc-800'
          }`}
        >
          <span>Cooking</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20">
            {countByStatus.PREPARING}
          </span>
        </button>
        <button
          onClick={() => setFilterStatus('READY')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
            filterStatus === 'READY'
              ? 'bg-emerald-500 text-black font-semibold'
              : 'bg-zinc-900 text-emerald-400 hover:bg-zinc-800'
          }`}
        >
          <span>Ready to Serve</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20">
            {countByStatus.READY}
          </span>
        </button>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-sm flex items-center justify-between">
          <span>⚠️ {errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center text-zinc-500 space-y-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Loading kitchen order queue...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        /* Empty state */
        <div className="py-24 border border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center p-6">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 text-zinc-400 text-3xl flex items-center justify-center mb-3">
            ✨
          </div>
          <h2 className="text-lg font-semibold text-white">Kitchen queue is clear</h2>
          <p className="text-sm text-zinc-400 max-w-sm mt-1">
            No active orders in this queue. When guests submit orders from table QR codes, tickets will appear here instantly.
          </p>
        </div>
      ) : (
        /* Order Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredOrders.map((order) => {
            const elapsedMins = getElapsedMinutes(order.placedAt || order.createdAt);
            const isUrgent = elapsedMins >= 15;
            const isBusy = isUpdating === order.id;

            return (
              <div
                key={order.id}
                className={`bg-zinc-900/90 border rounded-2xl flex flex-col justify-between overflow-hidden transition-all shadow-lg ${
                  order.status === 'READY'
                    ? 'border-emerald-500/40 shadow-emerald-950/20'
                    : order.status === 'PREPARING'
                    ? 'border-amber-500/40 shadow-amber-950/20'
                    : order.status === 'CONFIRMED'
                    ? 'border-indigo-500/30 shadow-indigo-950/20'
                    : 'border-blue-500/30 shadow-blue-950/20'
                }`}
              >
                {/* Ticket Header */}
                <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-white">
                        {order.orderNumber}
                      </span>
                    </div>
                    <div className="text-xs text-amber-400 font-semibold mt-0.5">
                      📍 {order.tableNumber || 'Table'}
                    </div>
                  </div>

                  {/* Elapsed Time Badge */}
                  <div
                    className={`px-2 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1 ${
                      isUrgent
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    <span>⏱️</span>
                    <span>{elapsedMins}m</span>
                  </div>
                </div>

                {/* Items List */}
                <div className="p-4 flex-1 space-y-3 divide-y divide-zinc-800/60">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="pt-2 first:pt-0">
                      <div className="flex items-start justify-between text-sm">
                        <span className="font-semibold text-zinc-100 flex-1">
                          <span className="text-amber-400 mr-2 font-mono font-bold">
                            {item.quantity}x
                          </span>
                          {item.name}
                        </span>
                        <span className="text-xs font-mono text-zinc-400 ml-2">
                          ₹{item.subtotal.toFixed(2)}
                        </span>
                      </div>
                      {item.specialInstructions && (
                        <div className="mt-1 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                          📝 {item.specialInstructions}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Ticket Footer / Action Buttons */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                    <span>
                      Total: <strong className="text-zinc-200">₹{order.grandTotal.toFixed(2)}</strong>
                    </span>
                    <span className="uppercase text-[10px] tracking-wider font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      {order.status}
                    </span>
                  </div>

                  {/* State Machine Transition Actions */}
                  <div className="grid grid-cols-1 gap-2">
                    {order.status === 'PLACED' && (
                      <button
                        onClick={() => handleTransition(order, 'CONFIRMED')}
                        disabled={isBusy}
                        className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isBusy ? 'Processing...' : '✓ Accept & Confirm'}
                      </button>
                    )}

                    {order.status === 'CONFIRMED' && (
                      <button
                        onClick={() => handleTransition(order, 'PREPARING')}
                        disabled={isBusy}
                        className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-black text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isBusy ? 'Processing...' : '🔥 Start Cooking (Prep)'}
                      </button>
                    )}

                    {order.status === 'PREPARING' && (
                      <button
                        onClick={() => handleTransition(order, 'READY')}
                        disabled={isBusy}
                        className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isBusy ? 'Processing...' : '🔔 Mark Order Ready'}
                      </button>
                    )}

                    {order.status === 'READY' && (
                      <button
                        onClick={() => handleTransition(order, 'SERVED')}
                        disabled={isBusy}
                        className="w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-[0.98] text-white text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isBusy ? 'Processing...' : '🍽️ Confirm Served'}
                      </button>
                    )}

                    {/* Staff Cancellation Button (Available for PLACED, CONFIRMED, PREPARING) */}
                    {['PLACED', 'CONFIRMED', 'PREPARING'].includes(order.status) && (
                      <button
                        onClick={() => setCancelModalOrder(order)}
                        disabled={isBusy}
                        className="w-full py-1.5 px-3 rounded-lg bg-zinc-800/80 hover:bg-red-950/60 hover:text-red-300 text-zinc-400 text-xs font-medium transition disabled:opacity-50"
                      >
                        Cancel Ticket
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Staff Cancellation Reason Modal */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>⚠️</span> Cancel Kitchen Ticket
            </h3>
            <p className="text-xs text-zinc-400">
              Order: <span className="font-mono text-zinc-200">{cancelModalOrder.orderNumber}</span> ({cancelModalOrder.tableNumber})
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Reason for cancellation
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Customer requested change, ingredient unavailable..."
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-zinc-200 text-sm focus:outline-none focus:border-red-500 h-24"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setCancelModalOrder(null);
                  setCancelReason('');
                }}
                disabled={isUpdating !== null}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition"
              >
                Keep Order
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isUpdating !== null}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isUpdating ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
