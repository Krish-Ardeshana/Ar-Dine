'use client';

import React, { useEffect, useState } from 'react';
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  fetchMyRestaurants,
  updateCategory,
} from '@/lib/api-client';
import { Category, CategoryStatus } from '@/types/menu';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New Category form state
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newOrder, setNewOrder] = useState(0);

  // Edit Category state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editOrder, setEditOrder] = useState(0);

  const loadData = async (activeRestaurantId?: string) => {
    const targetId = activeRestaurantId || restaurantId;
    if (!targetId) return;
    try {
      setIsLoading(true);
      const cats = await fetchCategories(targetId, true);
      setCategories(cats);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load categories';
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
          const cats = await fetchCategories(rId, true);
          if (active) {
            setCategories(cats);
          }
        }
      } catch (err: unknown) {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Failed to load categories';
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
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !newName.trim()) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await createCategory(restaurantId, {
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        displayOrder: Number(newOrder),
      });

      setSuccessMessage(`Category '${newName}' created successfully!`);
      setNewName('');
      setNewDescription('');
      setNewOrder(0);
      setIsCreating(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create category';
      setErrorMessage(msg);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !editingCategory || !editName.trim()) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateCategory(restaurantId, editingCategory.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        displayOrder: Number(editOrder),
      });

      setSuccessMessage(`Category updated successfully!`);
      setEditingCategory(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update category';
      setErrorMessage(msg);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (!restaurantId) return;
    if (!confirm(`Are you sure you want to delete category '${cat.name}'?`)) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await deleteCategory(restaurantId, cat.id);
      setSuccessMessage(res.message);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete category';
      setErrorMessage(msg);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Category Management</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Organize dishes into ordered sections for tabletop dining menus.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreating(!isCreating)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-xl transition cursor-pointer self-start sm:self-auto flex items-center space-x-2"
        >
          <span>{isCreating ? '✕ Cancel' : '+ Add Category'}</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Inline Create Form */}
      {isCreating && (
        <form onSubmit={handleCreate} className="bg-zinc-900/80 border border-zinc-700/80 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold">New Category</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-400 block mb-1 font-medium">Category Name *</label>
              <input
                type="text"
                placeholder="e.g. Starters & Appetizers"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-medium">Display Order</label>
              <input
                type="number"
                min="0"
                value={newOrder}
                onChange={(e) => setNewOrder(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1 font-medium">Description (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Crispy veg and non-veg bite-sized delights"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-xl cursor-pointer"
            >
              Create Category
            </button>
          </div>
        </form>
      )}

      {/* Edit Modal / Form */}
      {editingCategory && (
        <form onSubmit={handleUpdate} className="bg-zinc-900/90 border border-emerald-500/40 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold">Edit Category: {editingCategory.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-400 block mb-1 font-medium">Category Name *</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-medium">Display Order</label>
              <input
                type="number"
                min="0"
                value={editOrder}
                onChange={(e) => setEditOrder(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1 font-medium">Description</label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setEditingCategory(null)}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-xl cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      )}

      {/* Category List Table */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="py-12 flex justify-center text-zinc-500">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : categories.length === 0 ? (
          <div className="py-12 text-center text-zinc-500">
            <p className="text-lg mb-1">📁 No Categories Found</p>
            <p className="text-sm">Click &quot;+ Add Category&quot; to begin building your menu catalog.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {categories.map((cat) => (
              <div key={cat.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-zinc-800/30 transition">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2.5">
                    <span className="font-semibold text-zinc-100">{cat.name}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        cat.status === CategoryStatus.ACTIVE
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {cat.status}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">Order: #{cat.displayOrder}</span>
                  </div>
                  {cat.description && (
                    <p className="text-xs text-zinc-400 max-w-lg">{cat.description}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategory(cat);
                      setEditName(cat.name);
                      setEditDescription(cat.description || '');
                      setEditOrder(cat.displayOrder);
                    }}
                    className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(cat)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/40 transition cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
