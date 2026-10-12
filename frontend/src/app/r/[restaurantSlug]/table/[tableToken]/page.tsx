'use client';

import React, { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ModelViewer } from '@/components/ModelViewer';
import {
  createOrder,
  fetchPublicCategories,
  fetchPublicDishes,
  getOrCreatePublicSession,
  resolvePublicTable,
  validateCartOrder,
} from '@/lib/api-client';
import { Category, MenuItem } from '@/types/menu';
import {
  CartItem,
  DiningSessionResponse,
  ValidateCartOrderResult,
} from '@/types/session';
import { PublicTableResolution } from '@/types/table';

interface PageProps {
  params: Promise<{
    restaurantSlug: string;
    tableToken: string;
  }>;
}

function CustomerTableMenuContent({ params }: PageProps) {
  const { restaurantSlug, tableToken } = use(params);

  // Resolution & Session State
  const [resolution, setResolution] = useState<PublicTableResolution | null>(null);
  const [session, setSession] = useState<DiningSessionResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtering & Search
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 3D Model Modal State
  const [active3dDish, setActive3dDish] = useState<MenuItem | null>(null);

  // Cart State (sessionStorage scoped to restaurantSlug + tableToken)
  const cartStorageKey = `ar_dine_cart_${restaurantSlug}_${tableToken}`;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<ValidateCartOrderResult | null>(null);
  const router = useRouter();
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    let active = true;

    async function loadTableAndMenu() {
      try {
        setIsLoading(true);
        setError(null);

        // 1. Resolve table & restaurant
        const resolved = await resolvePublicTable(restaurantSlug, tableToken);
        if (!active) return;
        setResolution(resolved);

        // 2. Initialize or join table dining session
        const sess = await getOrCreatePublicSession(restaurantSlug, tableToken);
        if (!active) return;
        setSession(sess);

        // 3. Load categories and dishes
        const [cats, items] = await Promise.all([
          fetchPublicCategories(resolved.restaurant.id),
          fetchPublicDishes(resolved.restaurant.id),
        ]);
        if (!active) return;
        setCategories(cats);
        setDishes(items);

        // 4. Restore cart from scoped sessionStorage
        try {
          const savedCart = sessionStorage.getItem(cartStorageKey);
          if (savedCart) {
            setCart(JSON.parse(savedCart));
          }
        } catch {
          // Ignore storage parse errors
        }
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load table session');
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadTableAndMenu();

    return () => {
      active = false;
    };
  }, [restaurantSlug, tableToken, cartStorageKey]);

  // Sync cart to sessionStorage
  const updateCart = (newCart: CartItem[]) => {
    setCart(newCart);
    setValidationResult(null); // Invalidate previous server check
    try {
      sessionStorage.setItem(cartStorageKey, JSON.stringify(newCart));
    } catch {
      // Storage unavailable
    }
  };

  const handleAddToCart = (dish: MenuItem) => {
    const existing = cart.find((item) => item.dishId === dish.id);
    if (existing) {
      updateCart(
        cart.map((item) =>
          item.dishId === dish.id ? { ...item, quantity: item.quantity + 1 } : item,
        ),
      );
    } else {
      updateCart([
        ...cart,
        {
          dishId: dish.id,
          name: dish.name,
          unitPrice: dish.price,
          quantity: 1,
          imageUrl: dish.image?.url,
          modelUrl: dish.model3d?.glbUrl,
        },
      ]);
    }
  };

  const handleDecrement = (dishId: string) => {
    const existing = cart.find((item) => item.dishId === dishId);
    if (!existing) return;

    if (existing.quantity <= 1) {
      updateCart(cart.filter((item) => item.dishId !== dishId));
    } else {
      updateCart(
        cart.map((item) =>
          item.dishId === dishId ? { ...item, quantity: item.quantity - 1 } : item,
        ),
      );
    }
  };

  const handleRemove = (dishId: string) => {
    updateCart(cart.filter((item) => item.dishId !== dishId));
  };

  const handleUpdateNotes = (dishId: string, notes: string) => {
    updateCart(
      cart.map((item) =>
        item.dishId === dishId ? { ...item, specialInstructions: notes } : item,
      ),
    );
  };

  const handleValidateOrder = async () => {
    if (!session || cart.length === 0) return;
    setIsValidating(true);
    setValidationError(null);
    try {
      const payload = {
        sessionToken: session.sessionToken,
        items: cart.map((i) => ({
          menuItemId: i.dishId,
          quantity: i.quantity,
          specialInstructions: i.specialInstructions,
        })),
      };
      const result = await validateCartOrder(restaurantSlug, tableToken, payload);
      setValidationResult(result);
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : 'Cart validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmitOrder = async () => {
    if (!session || cart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setValidationError(null);
    try {
      const idempotencyKey = `idemp_${session.sessionToken}_${Date.now()}`;
      const payload = {
        sessionToken: session.sessionToken,
        items: cart.map((i) => ({
          menuItemId: i.dishId,
          quantity: i.quantity,
          specialInstructions: i.specialInstructions,
        })),
        idempotencyKey,
      };

      const order = await createOrder(restaurantSlug, tableToken, payload);

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(cartStorageKey);
        if (order.trackingToken) {
          sessionStorage.setItem(`ar_dine_trk_${order.orderNumber}`, order.trackingToken);
        }
      }
      setCart([]);
      setIsCartOpen(false);

      router.push(
        `/r/${encodeURIComponent(restaurantSlug)}/order/${encodeURIComponent(
          order.orderNumber,
        )}?token=${encodeURIComponent(order.trackingToken || '')}`,
      );
    } catch (err: unknown) {
      setValidationError(
        err instanceof Error ? err.message : 'Order placement failed',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculations
  const totalItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const provisionalSubtotal = cart.reduce(
    (acc, item) => acc + item.unitPrice * item.quantity,
    0,
  );

  // Filtered Dishes
  const filteredDishes = dishes.filter((dish) => {
    const matchesCategory =
      selectedCategory === 'all' || dish.categoryId === selectedCategory;
    const matchesSearch =
      dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dish.description && dish.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-zinc-300 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Connecting to Table Session...</p>
        <p className="text-xs text-zinc-500 mt-1 font-mono">Token: {tableToken}</p>
      </div>
    );
  }

  if (error || !resolution) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
            ⚠️
          </div>
          <h1 className="text-xl font-bold mb-2">Unavailable Table QR</h1>
          <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
            {error || 'This dining table could not be resolved or is currently out of service.'}
          </p>
          <div className="space-y-3">
            <Link
              href="/"
              className="block w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition"
            >
              Return to AR-DINE Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { restaurant, table } = resolution;

  return (
    <div className="min-h-screen bg-black text-zinc-100 pb-32">
      {/* Top Banner / Restaurant Info */}
      <header className="bg-zinc-950/90 border-b border-zinc-800/80 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex justify-between items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight truncate max-w-[200px] sm:max-w-md">
                {restaurant.name}
              </h1>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
              <span className="font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {table.tableNumber}
              </span>
              <span>•</span>
              <span>Cap: {table.capacity} Seats</span>
              {session && (
                <>
                  <span>•</span>
                  <span className="text-zinc-500 text-[11px] font-mono">
                    Session: Active
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quick Cart Button in Header */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-white px-3.5 py-2 rounded-xl text-xs font-medium transition flex items-center gap-2"
          >
            <span>🛒</span>
            <span className="hidden sm:inline">Cart</span>
            {totalItemCount > 0 && (
              <span className="bg-emerald-600 text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full min-w-[20px] text-center">
                {totalItemCount}
              </span>
            )}
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="max-w-5xl mx-auto px-4 py-2 overflow-x-auto flex gap-2 no-scrollbar border-t border-zinc-900">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
              selectedCategory === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            All Items ({dishes.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                selectedCategory === cat.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>

      {/* Main Menu Body */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Search Input */}
        <div className="mb-6">
          <div className="relative">
            <span className="absolute inset-y-0 left-3.5 flex items-center text-zinc-500 text-sm">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search dishes by name or ingredient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
        </div>

        {/* Dish Catalog Grid */}
        {filteredDishes.length === 0 ? (
          <div className="text-center py-20 bg-zinc-950/60 border border-zinc-800/80 rounded-3xl p-8">
            <div className="text-4xl mb-3">🍽️</div>
            <h3 className="text-base font-bold text-white mb-1">No Dishes Found</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              {searchQuery
                ? `No menu items match "${searchQuery}". Try a different keyword.`
                : 'No published dishes in this category.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDishes.map((dish) => {
              const inCart = cart.find((i) => i.dishId === dish.id);
              const isAvailable = dish.availabilityStatus === 'AVAILABLE';
              const has3D = Boolean(dish.model3d?.glbUrl);

              return (
                <div
                  key={dish.id}
                  className={`bg-zinc-950/80 border border-zinc-800/90 rounded-3xl overflow-hidden flex flex-col justify-between transition hover:border-zinc-700 ${
                    !isAvailable ? 'opacity-60' : ''
                  }`}
                >
                  {/* Dish Visual Header */}
                  <div className="relative h-44 bg-zinc-900 overflow-hidden">
                    {dish.image?.url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={dish.image.url}
                        alt={dish.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600">
                        <span className="text-3xl mb-1">🍽️</span>
                        <span className="text-[11px]">Photo Coming Soon</span>
                      </div>
                    )}

                    {/* 3D AR Availability Badge */}
                    {has3D && (
                      <button
                        onClick={() => setActive3dDish(dish)}
                        className="absolute top-3 right-3 bg-black/80 hover:bg-emerald-600 text-white backdrop-blur-md border border-emerald-500/40 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-lg transition flex items-center gap-1.5"
                      >
                        <span className="text-emerald-400 animate-pulse">●</span>
                        <span>3D Preview</span>
                      </button>
                    )}

                    {/* Out of Stock Overlay */}
                    {!isAvailable && (
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="bg-red-500/90 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                          Sold Out
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Dish Info */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <h3 className="font-bold text-white text-base leading-snug">
                          {dish.name}
                        </h3>
                        <span className="font-bold text-emerald-400 text-sm whitespace-nowrap">
                          {restaurant.currency} {dish.price.toFixed(2)}
                        </span>
                      </div>

                      {dish.description && (
                        <p className="text-xs text-zinc-400 line-clamp-2 mb-3 leading-relaxed">
                          {dish.description}
                        </p>
                      )}

                      {/* Dietary Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {dish.dietary?.isVegetarian && (
                          <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full font-medium">
                            🌱 Veg
                          </span>
                        )}
                        {dish.dietary?.isVegan && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                            🌿 Vegan
                          </span>
                        )}
                        {dish.dietary?.isGlutenFree && (
                          <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                            🌾 Gluten-Free
                          </span>
                        )}
                        {dish.preparationTimeMinutes && (
                          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                            ⏱️ ~{dish.preparationTimeMinutes}m
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Add / Stepper Controls */}
                    <div className="pt-3 border-t border-zinc-900 flex items-center gap-2">
                      {has3D && (
                        <button
                          onClick={() => setActive3dDish(dish)}
                          className="py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition flex items-center gap-1"
                          title="Interactive 3D view"
                        >
                          <span>🕶️</span> 3D
                        </button>
                      )}

                      {!isAvailable ? (
                        <button
                          disabled
                          className="flex-1 py-2 px-4 rounded-xl bg-zinc-900 text-zinc-600 text-xs font-medium cursor-not-allowed"
                        >
                          Unavailable
                        </button>
                      ) : inCart ? (
                        <div className="flex-1 flex items-center justify-between bg-emerald-950/30 border border-emerald-500/30 rounded-xl px-2 py-1">
                          <button
                            onClick={() => handleDecrement(dish.id)}
                            className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-sm flex items-center justify-center transition"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold text-emerald-400">
                            {inCart.quantity} in cart
                          </span>
                          <button
                            onClick={() => handleAddToCart(dish)}
                            className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center transition"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddToCart(dish)}
                          className="flex-1 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-md shadow-emerald-950/40 flex items-center justify-center gap-1.5"
                        >
                          <span>➕</span> Add to Order
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      {totalItemCount > 0 && !isCartOpen && (
        <div className="fixed bottom-4 inset-x-4 max-w-lg mx-auto z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between transition-transform transform active:scale-95 border border-emerald-400/30"
          >
            <div className="flex items-center gap-3">
              <span className="bg-black/30 px-2.5 py-1 rounded-xl text-xs font-bold">
                {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
              </span>
              <span className="text-sm font-semibold">Review Table Order</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-black tracking-tight">
                {restaurant.currency} {provisionalSubtotal.toFixed(2)}
              </span>
              <span className="text-[10px] text-emerald-200 block">Tap to view</span>
            </div>
          </button>
        </div>
      )}

      {/* 3D Model Modal */}
      {active3dDish && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative flex flex-col">
            <button
              onClick={() => setActive3dDish(null)}
              className="absolute top-4 right-4 z-10 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            >
              ✕
            </button>

            <div className="mb-3">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">
                AR-DINE Interactive 3D Food Preview
              </span>
              <h2 className="text-xl font-bold text-white">{active3dDish.name}</h2>
              <p className="text-sm font-semibold text-emerald-400">
                {restaurant.currency} {active3dDish.price.toFixed(2)}
              </p>
            </div>

            {/* 3D Model Viewer Component */}
            <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 mb-4 h-72">
              <ModelViewer
                modelUrl={active3dDish.model3d?.glbUrl}
                posterUrl={active3dDish.image?.url}
                altText={`3D Model for ${active3dDish.name}`}
                dishName={active3dDish.name}
                className="w-full h-full"
              />
            </div>

            <p className="text-xs text-zinc-400 mb-4">
              {active3dDish.description ||
                'Rotate with finger or mouse to inspect realistic portion size and visual presentation.'}
            </p>

            <button
              onClick={() => {
                handleAddToCart(active3dDish);
                setActive3dDish(null);
              }}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition"
            >
              Add {active3dDish.name} to Cart
            </button>
          </div>
        </div>
      )}

      {/* Customer Cart Drawer / Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="bg-zinc-900 border-l border-zinc-800 w-full max-w-md h-full flex flex-col justify-between p-6 shadow-2xl overflow-y-auto">
            <div>
              {/* Drawer Header */}
              <div className="flex justify-between items-center pb-4 border-b border-zinc-800 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>🛒</span> Table Cart
                  </h2>
                  <p className="text-xs text-zinc-400">
                    {restaurant.name} • {table.tableNumber}
                  </p>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="text-zinc-400 hover:text-white text-xl p-1"
                >
                  ✕
                </button>
              </div>

              {/* Items List */}
              {cart.length === 0 ? (
                <div className="text-center py-20 text-zinc-500">
                  <div className="text-4xl mb-2">🛒</div>
                  <p className="text-sm font-medium">Your table cart is empty</p>
                  <p className="text-xs mt-1">Add dishes to inspect and place order.</p>
                </div>
              ) : (
                <div className="space-y-4 mb-6">
                  {cart.map((item) => (
                    <div
                      key={item.dishId}
                      className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-3.5"
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <h4 className="text-sm font-semibold text-white">{item.name}</h4>
                          <span className="text-xs text-emerald-400 font-medium">
                            {restaurant.currency} {item.unitPrice.toFixed(2)} each
                          </span>
                        </div>
                        <span className="text-xs font-bold text-zinc-300">
                          {restaurant.currency} {(item.unitPrice * item.quantity).toFixed(2)}
                        </span>
                      </div>

                      {/* Special instructions */}
                      <input
                        type="text"
                        placeholder="Special instructions (e.g. less salt)..."
                        value={item.specialInstructions || ''}
                        onChange={(e) => handleUpdateNotes(item.dishId, e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-[11px] text-zinc-300 mb-2 focus:outline-none focus:border-emerald-500"
                      />

                      <div className="flex items-center justify-between text-xs">
                        <button
                          onClick={() => handleRemove(item.dishId)}
                          className="text-red-400 text-[11px] hover:underline"
                        >
                          Remove
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDecrement(item.dishId)}
                            className="w-6 h-6 rounded-md bg-zinc-800 text-white font-bold flex items-center justify-center hover:bg-zinc-700"
                          >
                            -
                          </button>
                          <span className="font-bold text-zinc-200">{item.quantity}</span>
                          <button
                            onClick={() => {
                              const dish = dishes.find((d) => d.id === item.dishId);
                              if (dish) handleAddToCart(dish);
                            }}
                            className="w-6 h-6 rounded-md bg-zinc-800 text-white font-bold flex items-center justify-center hover:bg-zinc-700"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Footer & Authoritative Server Revalidation */}
            {cart.length > 0 && (
              <div className="pt-4 border-t border-zinc-800 space-y-4">
                {validationError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    {validationError}
                  </div>
                )}

                {validationResult ? (
                  <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 space-y-2 text-xs">
                    <div className="flex justify-between text-zinc-300">
                      <span>Server Subtotal:</span>
                      <span className="font-semibold">
                        {restaurant.currency} {validationResult.subtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Taxes & Fees (5%):</span>
                      <span>
                        {restaurant.currency} {validationResult.taxAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-emerald-400 pt-1 border-t border-emerald-500/20">
                      <span>Authoritative Total:</span>
                      <span>
                        {restaurant.currency} {validationResult.grandTotal.toFixed(2)}
                      </span>
                    </div>

                    <div className="mt-3 p-2.5 rounded-xl bg-zinc-900 border border-zinc-700/80 text-[11px] text-zinc-300 leading-relaxed">
                      <span className="font-bold text-emerald-400 block mb-0.5">
                        Cart Authenticated:
                      </span>
                      {validationResult.message}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-sm font-bold text-zinc-200">
                    <span>Provisional Subtotal:</span>
                    <span className="text-emerald-400 text-base">
                      {restaurant.currency} {provisionalSubtotal.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  {/* Primary: Phase 6 Real Order Placement */}
                  <button
                    onClick={handleSubmitOrder}
                    disabled={isSubmitting || isValidating}
                    className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-black font-extrabold text-xs uppercase tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        <span>Sending Order to Kitchen...</span>
                      </>
                    ) : (
                      <>
                        <span>🚀</span>
                        <span>
                          Submit Order to Kitchen (
                          {restaurant.currency}{' '}
                          {(validationResult
                            ? validationResult.grandTotal
                            : provisionalSubtotal * 1.05
                          ).toFixed(2)}
                          )
                        </span>
                      </>
                    )}
                  </button>

                  {/* Secondary: Cart Revalidation */}
                  <button
                    onClick={handleValidateOrder}
                    disabled={isValidating || isSubmitting}
                    className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs uppercase tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isValidating ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                        <span>Verifying Availability...</span>
                      </>
                    ) : (
                      <>
                        <span>🛡️</span>
                        <span>{validationResult ? 'Re-Validate Cart' : 'Check Prices & Stock'}</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="w-full py-2 rounded-xl bg-transparent hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 font-medium text-xs transition"
                  >
                    Continue Browsing Menu
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomerTableMenuPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-zinc-400 flex flex-col items-center justify-center p-4">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium">Connecting to Table Session...</p>
        </div>
      }
    >
      <CustomerTableMenuContent params={params} />
    </Suspense>
  );
}
