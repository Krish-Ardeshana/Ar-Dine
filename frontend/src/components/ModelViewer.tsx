'use client';

import React, { useEffect, useRef, useState } from 'react';

interface ModelViewerElement extends HTMLElement {
  canActivateAR?: boolean;
  resetTurntable?: () => void;
  activateAR?: () => Promise<void>;
}

interface ModelViewerProps {
  modelUrl?: string;
  posterUrl?: string;
  altText: string;
  dishName: string;
  className?: string;
}

export function ModelViewer({
  modelUrl,
  posterUrl,
  altText,
  dishName,
  className = '',
}: ModelViewerProps) {
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isArSupported, setIsArSupported] = useState<boolean | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const viewerRef = useRef<ModelViewerElement | null>(null);

  useEffect(() => {
    let active = true;

    // Asynchronously import Google's web component on client
    import('@google/model-viewer')
      .then(() => {
        if (active) {
          setIsMounted(true);
        }
      })
      .catch(() => {
        if (active) {
          setHasError(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const handleLoad = () => {
      setIsLoaded(true);
      setHasError(false);

      if ('canActivateAR' in viewer) {
        setIsArSupported(Boolean(viewer.canActivateAR));
      } else {
        setIsArSupported(false);
      }
    };

    const handleError = () => {
      setHasError(true);
      setIsLoaded(false);
    };

    viewer.addEventListener('load', handleLoad);
    viewer.addEventListener('error', handleError);

    return () => {
      viewer.removeEventListener('load', handleLoad);
      viewer.removeEventListener('error', handleError);
    };
  }, [modelUrl, isMounted]);

  const handleResetCamera = () => {
    if (viewerRef.current && typeof viewerRef.current.resetTurntable === 'function') {
      viewerRef.current.resetTurntable();
    }
  };

  const handleActivateAr = () => {
    if (viewerRef.current && typeof viewerRef.current.activateAR === 'function') {
      viewerRef.current.activateAR().catch((err: unknown) => {
        const errorMsg = err instanceof Error ? err.message : 'Device does not support WebXR AR';
        alert(`AR Mode unavailable: ${errorMsg}`);
      });
    }
  };

  // Case 1: No 3D model provided — render photographic fallback
  if (!modelUrl) {
    return (
      <div
        className={`relative flex flex-col items-center justify-center rounded-2xl bg-zinc-900/60 border border-zinc-800 p-6 text-center overflow-hidden ${className}`}
      >
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt={altText || dishName}
            className="w-full h-64 object-cover rounded-xl mb-4 border border-zinc-800"
          />
        ) : (
          <div className="w-full h-64 bg-zinc-800/40 rounded-xl flex items-center justify-center mb-4 text-zinc-600">
            <span className="text-4xl">🍽️</span>
          </div>
        )}
        <div className="flex items-center space-x-2 text-zinc-400 text-sm">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500/80" />
          <span>Standard 2D Presentation (No 3D Model Attached)</span>
        </div>
      </div>
    );
  }

  // Case 2: 3D model failed to render — render fallback
  if (hasError) {
    return (
      <div
        className={`relative flex flex-col items-center justify-center rounded-2xl bg-zinc-900/80 border border-red-900/30 p-6 text-center ${className}`}
      >
        {posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt={altText}
            className="w-full h-56 object-cover rounded-xl mb-3 opacity-60 filter grayscale"
          />
        )}
        <p className="text-red-400 text-sm font-medium mb-1">
          3D Model Unavailable
        </p>
        <p className="text-zinc-500 text-xs max-w-xs">
          The 3D model could not be rendered. Falling back to photographic view.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-2xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border border-zinc-800/80 overflow-hidden shadow-2xl flex flex-col items-center justify-center ${className}`}
    >
      {/* Loading Skeleton */}
      {!isLoaded && isMounted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm z-10">
          <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin mb-3" />
          <p className="text-xs text-zinc-400 tracking-wider uppercase font-mono">
            Loading 3D Mesh...
          </p>
        </div>
      )}

      {/* Model Viewer Web Component */}
      {isMounted && (
        <model-viewer
          ref={viewerRef}
          src={modelUrl}
          poster={posterUrl}
          alt={altText || `3D model of ${dishName}`}
          camera-controls="true"
          auto-rotate="true"
          shadow-intensity="1.2"
          shadow-softness="0.8"
          exposure="1.0"
          ar="true"
          ar-modes="webxr scene-viewer quick-look"
          loading="eager"
          style={{ width: '100%', height: '360px', outline: 'none' }}
        />
      )}

      {/* Controls Overlay */}
      <div className="w-full px-4 py-3 bg-zinc-900/90 border-t border-zinc-800 flex items-center justify-between z-20">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleResetCamera}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
            title="Reset Camera Angle"
          >
            ↺ Reset View
          </button>

          {isArSupported && (
            <button
              type="button"
              onClick={handleActivateAr}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-950 transition cursor-pointer flex items-center space-x-1.5"
            >
              <span>📱</span>
              <span>View in AR</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-1.5 text-[11px] text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Interactive 3D Preview</span>
        </div>
      </div>
    </div>
  );
}
