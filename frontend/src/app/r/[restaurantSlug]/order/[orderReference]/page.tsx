'use client';

import React, { Suspense, use, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  cancelPublicOrder,
  confirmCustomerPayment,
  fetchPublicOrderTracking,
  getApiBaseUrl,
  initiateCustomerPayment,
} from '@/lib/api-client';
import { Order, OrderStatus } from '@/types/order';

interface OrderTrackingPageProps {
  params: Promise<{
    restaurantSlug: string;
    orderReference: string;
  }>;
}

function OrderTrackingContent({ params }: OrderTrackingPageProps) {
  const { restaurantSlug, orderReference } = use(params);
  const searchParams = useSearchParams();

  // Token resolution: check query parameter, then sessionStorage fallback
  const queryToken = searchParams.get('token') || '';
  const storageKey = `ar_dine_trk_${orderReference}`;

  const [trackingToken] = useState<string>(() => {
    if (queryToken) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(storageKey, queryToken);
      }
      return queryToken;
    }
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(storageKey) || '';
    }
    return '';
  });

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(trackingToken));
  const [error, setError] = useState<string | null>(
    trackingToken
      ? null
      : 'A tracking token is required to view this order. Please use the link provided upon placing your order.',
  );
  const [syncStatus, setSyncStatus] = useState<'LIVE' | 'POLLING' | 'CONNECTING'>('CONNECTING');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');

  // Payment Settlement State
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI');
  const [paymentSuccessRef, setPaymentSuccessRef] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch latest order state
  const refreshOrder = useCallback(async () => {
    if (!trackingToken) return;

    try {
      const data = await fetchPublicOrderTracking(restaurantSlug, orderReference, trackingToken);
      setOrder(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load order tracking details');
    } finally {
      setIsLoading(false);
    }
  }, [restaurantSlug, orderReference, trackingToken]);

  // Initial load
  useEffect(() => {
    let active = true;
    if (!trackingToken) return;

    fetchPublicOrderTracking(restaurantSlug, orderReference, trackingToken)
      .then((data) => {
        if (!active) return;
        setOrder(data);
        setError(null);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load order tracking details');
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [restaurantSlug, orderReference, trackingToken]);

  // Real-time synchronization
  useEffect(() => {
    if (!trackingToken || !orderReference) return;

    const sseUrl = `${getApiBaseUrl()}/restaurants/public/${encodeURIComponent(
      restaurantSlug,
    )}/orders/${encodeURIComponent(orderReference)}/events?token=${encodeURIComponent(
      trackingToken,
    )}`;

    const sse = new EventSource(sseUrl, { withCredentials: false });
    eventSourceRef.current = sse;

    sse.onopen = () => {
      setSyncStatus('LIVE');
    };

    sse.addEventListener('ORDER_UPDATED', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data as string);
        if (payload?.order) {
          setOrder(payload.order);
        } else {
          refreshOrder();
        }
      } catch {
        refreshOrder();
      }
    });

    sse.addEventListener('ORDER_CANCELLED', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data as string);
        if (payload?.order) {
          setOrder(payload.order);
        } else {
          refreshOrder();
        }
      } catch {
        refreshOrder();
      }
    });

    sse.onerror = () => {
      setSyncStatus('POLLING');
      sse.close();
    };

    // Polling fallback
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshOrder();
      }
    }, 5000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshOrder();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      sse.close();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [restaurantSlug, orderReference, trackingToken, refreshOrder]);

  // Customer cancellation handler
  const handleCustomerCancel = async () => {
    if (!trackingToken || isCancelling) return;
    setIsCancelling(true);
    try {
      const updated = await cancelPublicOrder(
        restaurantSlug,
        orderReference,
        trackingToken,
        { reason: cancelReason || 'Cancelled by customer' },
      );
      setOrder(updated);
      setShowCancelConfirm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert(`Cancellation failed: ${msg}`);
    } finally {
      setIsCancelling(false);
    }
  };

  // Customer bill settlement handler
  const handleSettlePayment = async () => {
    if (!trackingToken || !order || isPaying) return;
    setIsPaying(true);
    setPaymentError(null);

    try {
      const idempotencyKey = `pay_btn_${orderReference}_${Date.now()}`;
      const initiated = await initiateCustomerPayment(
        restaurantSlug,
        orderReference,
        trackingToken,
        {
          idempotencyKey,
          paymentMethod,
        },
      );

      const confirmed = await confirmCustomerPayment(
        restaurantSlug,
        orderReference,
        trackingToken,
        {
          transactionReference: initiated.transactionReference,
        },
      );

      setPaymentSuccessRef(confirmed.transactionReference);
      setOrder((prev) => (prev ? { ...prev, paymentStatus: 'PAID' } : prev));
      setShowPaymentModal(false);
      refreshOrder();
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : 'Payment settlement failed');
    } finally {
      setIsPaying(false);
    }
  };

  // State machine progress steps
  const steps: { key: OrderStatus; label: string; icon: string; desc: string }[] = [
    { key: 'PLACED', label: 'Order Placed', icon: '📝', desc: 'Sent to restaurant kitchen' },
    { key: 'CONFIRMED', label: 'Accepted', icon: '👨‍🍳', desc: 'Kitchen acknowledged order' },
    { key: 'PREPARING', label: 'Cooking', icon: '🔥', desc: 'Chef is preparing your dishes' },
    { key: 'READY', label: 'Ready', icon: '🔔', desc: 'Plated and ready to be served' },
    { key: 'SERVED', label: 'Served', icon: '🍽️', desc: 'Enjoy your meal!' },
  ];

  const getStepIndex = (status: OrderStatus) => {
    switch (status) {
      case 'PLACED': return 0;
      case 'CONFIRMED': return 1;
      case 'PREPARING': return 2;
      case 'READY': return 3;
      case 'SERVED': return 4;
      default: return -1;
    }
  };

  const currentStepIdx = order ? getStepIndex(order.status) : 0;
  const isCancelled = order?.status === 'CANCELLED';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-zinc-400">Loading Order Tracking...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto text-2xl">
            🔒
          </div>
          <h1 className="text-xl font-bold text-white">Order Tracking Unavailable</h1>
          <p className="text-sm text-zinc-400">{error || 'Order record not found.'}</p>
          <p className="text-xs text-zinc-500">
            For security, guest order tracking requires an authoritative tracking token generated at order placement.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 pb-16">
      {/* Top Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur sticky top-0 z-30 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider">
                {order.tableNumber || 'Table'}
              </span>
              <span className="text-xs text-zinc-500">•</span>
              <span className="text-xs font-mono text-zinc-400 font-bold">
                {order.orderNumber}
              </span>
            </div>
            <h1 className="text-lg font-bold text-white mt-0.5">Order Status & Tracking</h1>
          </div>

          {/* Sync status indicator */}
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
              syncStatus === 'LIVE'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus === 'LIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'
              }`}
            />
            {syncStatus === 'LIVE' ? 'Live Updates' : 'Auto-Refreshing'}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* Status Alert Banner */}
        {isCancelled ? (
          <div className="p-6 bg-red-950/40 border border-red-800/60 rounded-2xl text-center space-y-2">
            <div className="text-3xl">🚫</div>
            <h2 className="text-xl font-bold text-red-200">Order Cancelled</h2>
            <p className="text-sm text-red-300">
              {order.cancellationReason || 'This order was cancelled.'}
            </p>
            {order.cancelledBy && (
              <p className="text-xs text-red-400/80">
                Cancelled by: {order.cancelledBy}
              </p>
            )}
          </div>
        ) : (
          /* Live Progress Timeline */
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  Current Stage
                </span>
                <h2 className="text-xl font-bold text-white mt-0.5 flex items-center gap-2">
                  <span>{steps[currentStepIdx]?.icon || '⏳'}</span>
                  <span>{steps[currentStepIdx]?.label || order.status}</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  {steps[currentStepIdx]?.desc}
                </p>
              </div>

              {/* Payment Status Badge */}
              <div className="text-right">
                <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider block">
                  Payment Status
                </span>
                <span
                  className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold border mt-0.5 ${
                    order.paymentStatus === 'PAID'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  }`}
                >
                  {order.paymentStatus}
                </span>
              </div>
            </div>

            {/* Stepper Progress Bar */}
            <div className="relative flex items-center justify-between mt-8 mb-2">
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-zinc-800 -translate-y-1/2 z-0" />
              <div
                className="absolute top-1/2 left-0 h-1 bg-amber-500 -translate-y-1/2 z-0 transition-all duration-700"
                style={{
                  width: `${(Math.max(0, currentStepIdx) / (steps.length - 1)) * 100}%`,
                }}
              />

              {steps.map((s, idx) => {
                const isPassed = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;

                return (
                  <div key={s.key} className="relative z-10 flex flex-col items-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-md ${
                        isCurrent
                          ? 'bg-amber-500 text-black ring-4 ring-amber-500/20 scale-110'
                          : isPassed
                          ? 'bg-amber-400 text-black'
                          : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                      }`}
                    >
                      {isPassed ? s.icon : idx + 1}
                    </div>
                    <span
                      className={`text-[11px] font-medium mt-2 hidden sm:block ${
                        isCurrent
                          ? 'text-amber-400 font-bold'
                          : isPassed
                          ? 'text-zinc-200'
                          : 'text-zinc-500'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Customer Cancellation Option (Only available while PLACED) */}
            {order.status === 'PLACED' && (
              <div className="mt-8 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs">
                <span className="text-zinc-400">Changed your mind before the kitchen accepts?</span>
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="px-3 py-1.5 rounded-lg bg-red-950/50 hover:bg-red-900/60 border border-red-800/60 text-red-300 font-medium transition"
                >
                  Cancel Order
                </button>
              </div>
            )}
          </div>
        )}

        {/* Receipt & Order Item Summary */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>🧾</span> Order Receipt Breakdown
            </h2>
            <span className="text-xs font-mono text-zinc-400">
              {new Date(order.placedAt || order.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          {/* Item Snapshots */}
          <div className="divide-y divide-zinc-800/60 space-y-3">
            {order.items.map((item, idx) => (
              <div key={idx} className="pt-3 first:pt-0">
                <div className="flex items-start justify-between text-sm">
                  <div className="flex-1 pr-4">
                    <div className="font-semibold text-zinc-200">
                      <span className="text-amber-400 mr-2 font-mono">{item.quantity}x</span>
                      {item.name}
                    </div>
                    {item.specialInstructions && (
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Note: {item.specialInstructions}
                      </div>
                    )}
                  </div>
                  <div className="text-right font-mono text-sm text-zinc-200">
                    ₹{item.subtotal.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pricing Totals */}
          <div className="pt-4 border-t border-zinc-800 space-y-2 text-sm">
            <div className="flex items-center justify-between text-zinc-400">
              <span>Subtotal</span>
              <span className="font-mono text-zinc-300">₹{order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400">
              <span>GST / Taxes (5%)</span>
              <span className="font-mono text-zinc-300">₹{order.taxAmount.toFixed(2)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex items-center justify-between text-emerald-400">
                <span>Discount</span>
                <span className="font-mono">-₹{order.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-base font-bold text-white">
              <span>Total Amount</span>
              <span className="font-mono text-amber-400 text-lg">
                ₹{order.grandTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Bill Settlement Card */}
        {order.paymentStatus === 'PAID' ? (
          <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-2xl p-4 flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <span className="text-base">✅</span>
              <div>
                <p className="font-semibold text-emerald-200">Bill Settled Online</p>
                <p className="text-[11px] text-emerald-400/80">
                  {paymentSuccessRef ? `Ref: ${paymentSuccessRef}` : 'Payment Confirmed by Kitchen'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold font-mono">
              PAID
            </span>
          </div>
        ) : !isCancelled ? (
          <div className="bg-gradient-to-r from-amber-950/40 via-zinc-900 to-amber-950/40 border border-amber-800/40 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
                Bill Payment
              </p>
              <h3 className="text-base font-bold text-white mt-0.5">
                Outstanding: ₹{order.grandTotal.toFixed(2)}
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Settle directly from your table via UPI, Card, or Netbanking.
              </p>
            </div>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-950 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>💳</span> Pay ₹{order.grandTotal.toFixed(2)}
            </button>
          </div>
        ) : null}

        {/* Actions / Refresh */}
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={refreshOrder}
            className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition flex items-center gap-2"
          >
            <span>🔄</span> Refresh Status
          </button>
        </div>
      </main>

      {/* Customer Cancellation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>⚠️</span> Cancel Your Order?
            </h3>
            <p className="text-xs text-zinc-400">
              Your order is currently awaiting kitchen acceptance. If cancelled now, it will not be prepared.
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Ordered wrong item, need to leave..."
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-zinc-200 text-sm focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={isCancelling}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition"
              >
                No, Keep It
              </button>
              <button
                onClick={handleCustomerCancel}
                disabled={isCancelling}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Yes, Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Payment Settlement Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>💳</span> Settle Bill Online
              </h3>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                disabled={isPaying}
                className="text-zinc-500 hover:text-zinc-300 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800/80 space-y-1 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Order Reference:</span>
                <span className="font-mono text-zinc-200">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Total Amount:</span>
                <span className="font-mono text-amber-400 font-bold text-sm">
                  ₹{order.grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-2">
                Select Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['UPI', 'CARD', 'NETBANKING'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 px-1 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      paymentMethod === method
                        ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {paymentError && (
              <p className="text-xs text-red-400 bg-red-950/40 p-2 rounded-lg border border-red-900/40">
                {paymentError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                disabled={isPaying}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSettlePayment}
                disabled={isPaying}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-950 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {isPaying ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Pay ₹{order.grandTotal.toFixed(2)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderTrackingPage(props: OrderTrackingPageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <OrderTrackingContent {...props} />
    </Suspense>
  );
}
