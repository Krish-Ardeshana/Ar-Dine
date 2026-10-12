'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ModelViewer } from '@/components/ModelViewer';
import {
  deleteMenuItem,
  fetchCategories,
  fetchMenuItems,
  fetchMyRestaurants,
  updateItemAvailability,
} from '@/lib/api-client';
import { AvailabilityStatus, Category, MenuItem } from '@/types/menu';

export default function MenuCatalogPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [previewDish, setPreviewDish] = useState<MenuItem | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async (catId?: string, query?: string) => {
    if (!restaurantId) return;
    try {
      setIsLoading(true);
      const [cats, menuData] = await Promise.all([
        fetchCategories(restaurantId, true),
        fetchMenuItems(restaurantId, {
          categoryId: catId || undefined,
          search: query || undefined,
        }),
      ]);

      setCategories(cats);
      setItems(menuData.items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load menu dishes';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const restaurants = await fetchMyRestaurants();
        if (active && restaurants.length > 0) {
          const rId = restaurants[0].id;
          setRestaurantId(rId);

          const [cats, menuData] = await Promise.all([
            fetchCategories(rId, true),
            fetchMenuItems(rId, {
              categoryId: selectedCategory || undefined,
            }),
          ]);

          if (active) {
            setCategories(cats);
            setItems(menuData.items);
          }
        }
      } catch (err: unknown) {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Failed to load menu dishes';
          setErrorMessage(msg);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void loadData(selectedCategory, searchQuery);
  };

  const handleToggleAvailability = async (dish: MenuItem) => {
    if (!restaurantId) return;

    const nextStatus =
      dish.availabilityStatus === AvailabilityStatus.AVAILABLE
        ? AvailabilityStatus.OUT_OF_STOCK
        : AvailabilityStatus.AVAILABLE;

    try {
      await updateItemAvailability(restaurantId, dish.id, nextStatus);
      setItems((prev) =>
        prev.map((i) => (i.id === dish.id ? { ...i, availabilityStatus: nextStatus } : i)),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update dish availability';
      setErrorMessage(msg);
    }
  };

  const handleDeleteDish = async (dish: MenuItem) => {
    if (!restaurantId) return;
    if (!confirm(`Are you sure you want to delete '${dish.name}'?`)) return;

    try {
      const res = await deleteMenuItem(restaurantId, dish.id);
      setStatusMessage(res.message);
      await loadData(selectedCategory, searchQuery);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete dish';
      setErrorMessage(msg);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dish Catalog & 3D Assets</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Manage culinary items, pricing, instant availability, and WebXR 3D models.
          </p>
        </div>
        <Link
          href="/dashboard/menu/new"
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-xl transition self-start sm:self-auto flex items-center space-x-2 shadow-lg shadow-emerald-950"
        >
          <span>+ Add New Dish</span>
        </Link>
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

      {/* Filter and Search Bar */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder="Search dish by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-medium transition cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="w-full sm:w-56">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by Category"
            className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dishes Grid */}
      {isLoading ? (
        <div className="py-20 flex justify-center text-zinc-500">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl py-16 text-center text-zinc-500 space-y-3">
          <p className="text-3xl">🍽️</p>
          <p className="text-base font-medium text-zinc-300">No Dishes Found</p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            No dishes match your selected filter. Click &quot;+ Add New Dish&quot; to publish culinary items.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((dish) => {
            const hasModel = Boolean(dish.model3d?.glbUrl);
            const isAvailable = dish.availabilityStatus === AvailabilityStatus.AVAILABLE;

            return (
              <div
                key={dish.id}
                className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-zinc-700 transition shadow-lg"
              >
                <div>
                  {/* Image Header with Badges */}
                  <div className="relative h-44 bg-zinc-950 overflow-hidden">
                    {dish.image?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={dish.image.url}
                        alt={dish.image.altText || dish.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700 text-3xl">
                        🍛
                      </div>
                    )}

                    <div className="absolute top-3 right-3 flex flex-col space-y-1.5 items-end">
                      {hasModel && (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500 text-black shadow-md flex items-center space-x-1">
                          <span>📦</span>
                          <span>3D AR Ready</span>
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${
                          dish.publicationStatus === 'PUBLISHED'
                            ? 'bg-zinc-900/80 text-zinc-300 border border-zinc-700'
                            : 'bg-amber-900/80 text-amber-300 border border-amber-700'
                        }`}
                      >
                        {dish.publicationStatus}
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-3">
                      <span className="px-2.5 py-1 rounded-lg text-sm font-bold bg-black/80 text-white backdrop-blur-md border border-zinc-700/50">
                        ₹{dish.price}
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-2">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-base text-zinc-100">{dish.name}</h3>
                      {dish.dietary?.isVegetarian && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" title="Vegetarian" />
                      )}
                    </div>
                    {dish.description && (
                      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        {dish.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-4 bg-zinc-950/60 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleAvailability(dish)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      isAvailable
                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                        : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
                    }`}
                  >
                    {isAvailable ? '✓ Available' : '✕ Out of Stock'}
                  </button>

                  <div className="flex items-center space-x-2">
                    {hasModel && (
                      <button
                        type="button"
                        onClick={() => setPreviewDish(dish)}
                        className="px-2.5 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition cursor-pointer"
                        title="Preview 3D Model"
                      >
                        👁️ 3D
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteDish(dish)}
                      className="px-2.5 py-1.5 rounded-lg text-xs bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/40 transition cursor-pointer"
                      title="Delete / Archive"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3D Model Preview Modal */}
      {previewDish && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">{previewDish.name}</h3>
                <p className="text-xs text-zinc-400">Interactive 3D WebXR Model Preview</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDish(null)}
                className="w-8 h-8 rounded-full bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <ModelViewer
              modelUrl={previewDish.model3d?.glbUrl}
              posterUrl={previewDish.image?.url}
              iosSrc={previewDish.model3d?.usdzUrl}
              altText={previewDish.name}
              dishName={previewDish.name}
            />

            <div className="text-right">
              <button
                type="button"
                onClick={() => setPreviewDish(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
