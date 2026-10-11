"use client";

import { useEffect, useState, useTransition } from "react";
import { fetchBackendHealth, getApiBaseUrl } from "@/lib/api-client";
import { BackendHealthResponse } from "@/types/api";

export default function BackendHealthStatus() {
  const [health, setHealth] = useState<BackendHealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let ignore = false;

    async function probeBackend() {
      try {
        const data = await fetchBackendHealth();
        if (!ignore) {
          setHealth(data);
          setError(null);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setHealth(null);
          setError(
            err instanceof Error ? err.message : "Unable to connect to backend server"
          );
          setIsLoading(false);
        }
      }
    }

    probeBackend();

    return () => {
      ignore = true;
    };
  }, []);

  const handleRetry = () => {
    startTransition(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchBackendHealth();
        setHealth(data);
        setError(null);
      } catch (err: unknown) {
        setHealth(null);
        setError(
          err instanceof Error ? err.message : "Unable to connect to backend server"
        );
      } finally {
        setIsLoading(false);
      }
    });
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-xl backdrop-blur-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-neutral-400">
              API Integration Status
            </span>
            <span className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-[11px] text-neutral-300">
              {getApiBaseUrl()}/health
            </span>
          </div>
          <h3 className="mt-1 text-lg font-semibold text-neutral-100">
            NestJS Backend Health Probe
          </h3>
        </div>

        <button
          onClick={handleRetry}
          disabled={isLoading || isPending}
          className="inline-flex items-center justify-center rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-700 disabled:opacity-50"
        >
          {isLoading || isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
              Probing...
            </span>
          ) : (
            "Probe Endpoint"
          )}
        </button>
      </div>

      <div className="mt-5">
        {isLoading ? (
          <div className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950/50 p-4 text-sm text-neutral-400">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500" />
            </span>
            <span>Connecting to backend at <code className="font-mono text-neutral-300">{getApiBaseUrl()}/health</code>...</span>
          </div>
        ) : health ? (
          <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-4 text-sm">
            <div className="flex items-center gap-2 text-emerald-400">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="font-medium">Backend Operational & Reachable</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-xs text-neutral-300 sm:grid-cols-4">
              <div className="rounded bg-neutral-900/80 p-2">
                <span className="text-neutral-500">Service:</span> {health.service}
              </div>
              <div className="rounded bg-neutral-900/80 p-2">
                <span className="text-neutral-500">API Status:</span> {health.status}
              </div>
              <div className="rounded bg-neutral-900/80 p-2">
                <span className="text-neutral-500">Env:</span> {health.environment}
              </div>
              <div className="rounded bg-neutral-900/80 p-2">
                <span className="text-neutral-500">DB State:</span>{" "}
                <span
                  className={
                    health.database?.ready
                      ? "text-emerald-400 font-semibold"
                      : "text-amber-400 font-semibold"
                  }
                >
                  {health.database?.status ?? "unconfigured"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4 text-sm">
            <div className="flex items-center gap-2 text-amber-400">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="font-medium">Backend Offline / Unreachable</span>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              {error || "Failed to reach NestJS service."}
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              To start the backend in development: run <code className="rounded bg-neutral-900 px-1 py-0.5 text-neutral-300">cd backend; npm run start:dev</code> in a separate terminal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
