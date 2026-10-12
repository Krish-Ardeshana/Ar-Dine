# AR-DINE — Physical AR Readiness & Device Validation Audit

## 1. Executive Status: NOT VERIFIED ON PHYSICAL HARDWARE (Code & Fallbacks Verified Locally)

| Dimension | Status | Evidence / Notes |
| :--- | :--- | :--- |
| **Physical Mobile Device AR** | **`NOT VERIFIED`** | No physical mobile hardware rig connected to test host. In accordance with Phase 10 rules, physical AR sessions are not claimed without actual device validation. |
| **3D Rendering Component** | **`VERIFIED LOCALLY`** | `<model-viewer>` web component with Orbit controls, auto-rotate, shadow rendering, and reset angle button. |
| **Photographic Fallback (No 3D)** | **`VERIFIED LOCALLY`** | Displays high-resolution 2D dish image or placeholder when GLB model is absent. |
| **Model Failure Fallback** | **`VERIFIED LOCALLY`** | Error boundary renders dimmed poster and clear non-blocking message if mesh fails to load. |
| **Accessibility & Controls** | **`VERIFIED LOCALLY`** | Explicit `aria-label` tags on camera reset and AR launch buttons; responsive mobile touch controls. |

---

## 2. Technical Architecture of the AR Pipeline

The customer tabletop ordering interface integrates Google's `<model-viewer>` component (`@google/model-viewer` v4.4.0):

```tsx
<model-viewer
  ref={viewerRef}
  src={modelUrl}
  poster={posterUrl}
  ios-src={iosSrc}
  alt={altText || `3D model of ${dishName}`}
  camera-controls="true"
  auto-rotate="true"
  shadow-intensity="1.2"
  shadow-softness="0.8"
  exposure="1.0"
  ar="true"
  ar-modes="webxr scene-viewer quick-look"
  ar-scale="auto"
  quick-look-browsers="safari"
  loading="eager"
  style={{ width: '100%', height: '360px', outline: 'none' }}
/>
```

### Platform-Specific Launch Mechanics

1. **Android (Chrome & Chromium Browsers):**
   - **WebXR Device API:** Primary launch mode. Opens immersive augmented reality viewport directly within the browser session.
   - **Google Scene Viewer:** Secondary fallback. Launches Google Play Services for AR (`com.google.ar.core`) via Android Intent (`intent://arvr.google.com/scene-viewer/1.0?...`).
2. **iOS (Safari / WebKit):**
   - **Apple Quick Look:** Uses native iOS Quick Look engine (`ar-modes="quick-look"`).
   - If a USDZ model asset is attached via `iosSrc` (`ios-src`), Safari launches the native iOS AR viewer directly.
   - If only a GLB model is available, `<model-viewer>` provides full interactive 3D rotation and zoom on iOS Safari.

### Critical Production HTTPS Requirement
The WebXR Device API and camera permissions **strictly require a secure context (HTTPS)**. On plain HTTP (except `localhost`), browsers automatically disable `navigator.xr` and block AR session initialization. Production deployment must run behind TLS (as configured in `deploy/nginx/ar-dine.conf`).

---

## 3. Graceful Fallback Strategy

```
           +-----------------------------+
           | User Views Dish Detail View |
           +-----------------------------+
                          |
              Is 3D Model Attached?
             /                     \
           YES                      NO
            |                        |
+----------------------+   +------------------------------+
| Load <model-viewer>  |   | Render 2D Photographic View  |
+----------------------+   | (Standard 2D Presentation)   |
      /         \          +------------------------------+
  SUCCESS      ERROR
     |           |
+----------+ +------------------------------+
| 3D Orbit | | Render Error Fallback Card   |
| Viewport | | (Dimmed Poster + Alert)      |
+----------+ +------------------------------+
     |
  Can Device Launch AR? (`canActivateAR`)
    /                              \
  YES                               NO
   |                                 |
+---------------------------+ +----------------------------+
| Render "📱 View in AR"   | | Show "Interactive 3D"      |
| Button with Pulse Badge   | | Badge (AR Button Hidden)   |
+---------------------------+ +----------------------------+
```

---

## 4. Physical Device Verification Procedure (Manual Checklist)

When deploying to a live HTTPS staging environment, follow this test procedure on physical hardware:

### Android Physical Test (Target: Android 10+, Chrome 110+)
- [ ] **Step 1:** Ensure Google Play Services for AR (ARCore) is installed and up-to-date.
- [ ] **Step 2:** Open the staging restaurant tabletop menu on Chrome: `https://ar-dine.yourdomain.com/r/spice-craft-kitchen/table/tbl_spice_01`.
- [ ] **Step 3:** Tap a dish with a 3D model (e.g., Paneer Tikka or Burger).
- [ ] **Step 4:** Verify the 3D model loads, rotates automatically, and responds to touch orbit and pinch-to-zoom gestures.
- [ ] **Step 5:** Verify the **"📱 View in AR"** button appears.
- [ ] **Step 6:** Tap **"View in AR"**. If prompted, grant camera permissions.
- [ ] **Step 7:** Scan the tabletop or floor. Verify the virtual dish appears at 1:1 realistic scale on the physical surface.
- [ ] **Step 8 (Negative Test):** Deny camera permissions when prompted. Verify application shows a clean error notification rather than crashing.

### iOS Physical Test (Target: iOS 14+, Safari)
- [ ] **Step 1:** Open the staging restaurant tabletop menu in Safari: `https://ar-dine.yourdomain.com/r/spice-craft-kitchen/table/tbl_spice_01`.
- [ ] **Step 2:** Tap a dish with a 3D model.
- [ ] **Step 3:** Confirm 3D interaction (drag to rotate, pinch to zoom).
- [ ] **Step 4:** Tap the Quick Look AR icon or **"View in AR"** button.
- [ ] **Step 5:** Confirm Apple Quick Look launches with camera passthrough and realistic lighting estimation.
- [ ] **Step 6 (Negative Test):** Test with Safari Private Browsing or restricted camera permissions. Confirm fallback to 3D orbit view.
