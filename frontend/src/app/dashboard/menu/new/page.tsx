'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ModelViewer } from '@/components/ModelViewer';
import {
  createMenuItem,
  fetchCategories,
  fetchMyRestaurants,
  uploadDishImage,
  uploadDishModel,
} from '@/lib/api-client';
import {
  Category,
  ImageMetadata,
  MenuItemPublicationStatus,
  Model3DMetadata,
  SpiceLevel,
} from '@/types/menu';

export default function AddNewDishPage() {
  const router = useRouter();

  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [preparationMinutes, setPreparationMinutes] = useState<number>(15);
  const [description, setDescription] = useState('');

  // Dietary
  const [isVegetarian, setIsVegetarian] = useState(false);
  const [isVegan, setIsVegan] = useState(false);
  const [isGlutenFree, setIsGlutenFree] = useState(false);
  const [spiceLevel, setSpiceLevel] = useState<SpiceLevel>(SpiceLevel.NONE);

  // Media
  const [imageMeta, setImageMeta] = useState<ImageMetadata | undefined>(undefined);
  const [modelMeta, setModelMeta] = useState<Model3DMetadata | undefined>(undefined);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingModel, setIsUploadingModel] = useState(false);

  useEffect(() => {
    fetchMyRestaurants()
      .then(async (restaurants) => {
        if (restaurants.length > 0) {
          const rId = restaurants[0].id;
          setRestaurantId(rId);
          const cats = await fetchCategories(rId, true);
          setCategories(cats);
          if (cats.length > 0) {
            setCategoryId(cats[0].id);
          }
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to initialize dish creator';
        setErrorMessage(msg);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !restaurantId) return;

    setIsUploadingImage(true);
    setErrorMessage(null);

    try {
      const res = await uploadDishImage(restaurantId, file, name);
      setImageMeta(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Image upload failed';
      setErrorMessage(msg);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleModelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !restaurantId) return;

    if (!file.name.toLowerCase().endsWith('.glb')) {
      setErrorMessage('Only self-contained binary 3D models (.glb) are supported');
      return;
    }

    setIsUploadingModel(true);
    setErrorMessage(null);

    try {
      const res = await uploadDishModel(restaurantId, file);
      setModelMeta(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '3D Model upload failed';
      setErrorMessage(msg);
    } finally {
      setIsUploadingModel(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !categoryId || price === '') return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await createMenuItem(restaurantId, {
        name: name.trim(),
        categoryId,
        price: Number(price),
        preparationTimeMinutes: Number(preparationMinutes),
        description: description.trim() || undefined,
        publicationStatus: MenuItemPublicationStatus.PUBLISHED,
        image: imageMeta,
        model3d: modelMeta,
        dietary: {
          isVegetarian,
          isVegan,
          isGlutenFree,
          spiceLevel,
          allergens: [],
        },
      });

      router.push('/dashboard/menu');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create menu item';
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center text-zinc-500">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add New Dish</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Publish an item with validated nutritional info, photography, and 3D preview.
          </p>
        </div>
        <Link
          href="/dashboard/menu"
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-800 text-zinc-300 hover:text-white"
        >
          ← Back to Catalog
        </Link>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Details */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold">1. Dish Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-medium">Dish Name *</label>
              <input
                type="text"
                placeholder="e.g. Signature Truffle Pizza"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-medium">Category *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                aria-label="Category"
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-medium">Price (INR ₹) *</label>
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="299"
                value={price}
                onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                required
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-medium">Prep Time (Minutes)</label>
              <input
                type="number"
                min="0"
                value={preparationMinutes}
                onChange={(e) => setPreparationMinutes(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1 font-medium">Description</label>
            <textarea
              rows={3}
              placeholder="Crispy sourdough crust topped with seasonal black truffles and buffalo mozzarella..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Dietary & Allergens */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold">2. Dietary Specifications</h2>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center space-x-2 text-sm text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isVegetarian}
                onChange={(e) => setIsVegetarian(e.target.checked)}
                className="rounded accent-emerald-500"
              />
              <span>Vegetarian</span>
            </label>
            <label className="flex items-center space-x-2 text-sm text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isVegan}
                onChange={(e) => setIsVegan(e.target.checked)}
                className="rounded accent-emerald-500"
              />
              <span>Vegan</span>
            </label>
            <label className="flex items-center space-x-2 text-sm text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isGlutenFree}
                onChange={(e) => setIsGlutenFree(e.target.checked)}
                className="rounded accent-emerald-500"
              />
              <span>Gluten-Free</span>
            </label>
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1 font-medium">Spice Level</label>
            <select
              value={spiceLevel}
              onChange={(e) => setSpiceLevel(e.target.value as SpiceLevel)}
              aria-label="Spice Level"
              className="w-full sm:w-64 bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
            >
              <option value={SpiceLevel.NONE}>None</option>
              <option value={SpiceLevel.MILD}>Mild 🌶️</option>
              <option value={SpiceLevel.MEDIUM}>Medium 🌶️🌶️</option>
              <option value={SpiceLevel.HOT}>Hot 🌶️🌶️🌶️</option>
            </select>
          </div>
        </div>

        {/* Media & 3D Assets */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <h2 className="text-base font-semibold">3. Photography & 3D AR Assets</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image upload */}
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 block font-medium">Dish Photography (JPEG, PNG, WebP &lt; 5MB)</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageFileChange}
                disabled={isUploadingImage}
                className="w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
              />
              {isUploadingImage && <p className="text-xs text-amber-400">Uploading photo...</p>}
              {imageMeta && (
                <p className="text-xs text-emerald-400 font-mono">✓ Photo stored: {imageMeta.storageKey}</p>
              )}
            </div>

            {/* 3D GLB upload */}
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 block font-medium">Interactive 3D Model (Self-contained .glb &lt; 25MB)</label>
              <input
                type="file"
                accept=".glb"
                onChange={handleModelFileChange}
                disabled={isUploadingModel}
                className="w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
              />
              {isUploadingModel && <p className="text-xs text-amber-400">Uploading 3D mesh...</p>}
              {modelMeta && (
                <p className="text-xs text-emerald-400 font-mono">✓ 3D Model ready ({Math.round((modelMeta.fileSizeBytes || 0) / 1024)} KB)</p>
              )}
            </div>
          </div>

          {/* Interactive Live Preview */}
          <div className="pt-4 border-t border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Live Visual Preview</h3>
            <ModelViewer
              modelUrl={modelMeta?.glbUrl}
              posterUrl={imageMeta?.url}
              iosSrc={modelMeta?.usdzUrl}
              altText={name || 'Dish Preview'}
              dishName={name || 'New Dish'}
            />
          </div>
        </div>

        {/* Submit button */}
        <div className="flex justify-end space-x-4">
          <Link
            href="/dashboard/menu"
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || isUploadingImage || isUploadingModel}
            className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition cursor-pointer shadow-lg shadow-emerald-950"
          >
            {isSubmitting ? 'Publishing Dish...' : 'Publish Dish'}
          </button>
        </div>
      </form>
    </div>
  );
}
