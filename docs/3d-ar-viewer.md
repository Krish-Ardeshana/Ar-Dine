# AR-DINE — Interactive 3D Food Preview & WebXR AR Pipeline

> **Frontend Module:** `<ModelViewer>` Component  
> **Package:** `@google/model-viewer` v4  
> **Phase:** Implemented & Verified in Phase 4

---

## 1. Google `<model-viewer>` Integration

AR-DINE integrates Google's official `<model-viewer>` custom web component for progressive 3D rendering in modern browsers:

- **SSR Safety:** Dynamic asynchronous import occurs only after client-side mounting (`useEffect`), eliminating Next.js SSR hydration mismatches.
- **Controls & Interaction:**
  - `camera-controls`: Mouse orbit, touch pan, and pinch-to-zoom.
  - `auto-rotate`: Turntable motion showcasing culinary presentation.
  - `shadow-intensity="1.2"`: High-fidelity ambient contact shadows on tabletop surface.
  - `exposure="1.0"`: Standard color rendering.

---

## 2. WebXR Augmented Reality (AR) Entry Point

- **Capability Detection:** The component inspects `modelViewer.canActivateAR` at runtime.
- **Device Support:**
  - **Android (Chrome):** WebXR Device API and Scene Viewer.
  - **iOS (Safari):** Quick Look via USDZ / SceneViewer.
- **Explicit AR Separation:** AR mode is not launched automatically upon page load. Users first interact with the 3D turntable, and can tap the dedicated **"View in AR"** button if their hardware supports WebXR.
- **Desktop / Unsupported Fallback:** If AR hardware is absent, the "View in AR" button is hidden, maintaining an intuitive desktop 3D inspection experience without broken alerts.

---

## 3. Fallback Hierarchy

1. **No 3D Model Attached:** Displays high-resolution dish photography with an indicator (`Standard 2D Presentation`).
2. **Network / Corrupt 3D Model:** If model loading fails, automatically falls back to photographic view with an alert banner (`3D Model Unavailable`).
3. **Loading State:** Displays an animated emerald mesh skeleton while model geometry is streamed.
