# Neuro Vehicle Bridge

Browser dashboard + local bridges for multi-sensor capture and review (biometrics + vehicle signals) in a single UI. The project aggregates data from Polar H10, Muse S Athena, OBD-II (ELM327), phone sensors via Phyphox, and dual video from DJI Osmo 360. Everything is local-first: no cloud services, no remote backend, data stays in memory with manual export.

> **Warning**: The proprietary Muse SDK (`Muse.framework`) is not included in this repository. Please request access directly from [Muse](https://choosemuse.com/pages/developers?srsltid=AfmBOooa34xRVr4UKVdQlJ7nJAJku5KkewUOE1hYPX_q0yY5y1wlwKBH).

![ui_demo(1)](https://github.com/user-attachments/assets/bd338361-ad9c-4100-a0ac-12906bb1fc10)
*UI demo in action.*

![ui_demo(2)](https://github.com/user-attachments/assets/035871c7-a707-4bd8-a1ac-685176b8bf61)
*UI demo in action.*

## Status and scope
- Internal PoC / research tool for rapid capture, playback, and annotation.
- Focus on visualization and workflow UX, not on real-time inference.
- Each module supports Live and Debug (CSV/ZIP playback).
- No external services required, except CDN-hosted libraries and map tiles.

## Architecture (high level)
1) **Sensors**: BLE (Polar, Muse), Wi-Fi OBD (ELM327), phone sensors (Phyphox), video.
2) **Local bridges**: Swift (Muse) and Node.js (OBD) expose WebSocket endpoints.
3) **Frontend**: HTML/CSS/JS with Chart.js and Leaflet; CSV/ZIP parsing; markers; export.

## Modules and sensors
### Polar H10 (HR/HRV)
- **Live**: Web Bluetooth (GATT Heart Rate + Battery).
- **Processing**: HRV metrics off-main-thread with a Web Worker (RMSSD, SDNN, NN50, pNN50, HRV index, LF/HF via Welch PSD + spline resampling).
- **UI**: sliding chart, markers, key metrics, CSV export (zip bundle).

### Muse S Athena (EEG/PPG)
- **Live**: Swift bridge + Muse.framework on macOS -> WS `ws://localhost:3002`.
- **Signals**: EEG, accelerometer, gyro, PPG/optics, battery, band power.
- **UI**: multi-channel raw, band PSD, FFT view, motion, spectrogram, markers, CSV import/export.

### OBD-II (ELM327)
- **Real bridge**: Node.js `backend/bridges/obd/bridge.js` (TCP -> WS).
- **UI**: telemetry (RPM, speed, temps, load, throttle, etc), charts, markers, CSV import/export.
- **Note**: Live UI currently uses simulated values; WS wiring exists but is not connected yet.

### Phyphox (phone sensors)
- **Debug/Replay**: CSV or ZIP exports from the Phyphox app (accelerometer, gyro, orientation, GPS).
- **UI**: charts + Leaflet map with track and markers.
- **Live**: simulated data for UX preview only.

### DJI Osmo 360 (dual video)
- **UI**: synchronized front/rear player with play/pause/seek.
- **Debug**: drag and drop MP4s (sample files in `frontend/media/`).
- **Live**: no direct camera integration (placeholder).

## Debug/Replay CSV compatibility (third-party apps)
Debug mode is designed to replay data from common third-party exports. Examples:
- **Polar HRV**: ECG Logger CSV (`time,ecg,hr,rr` format) and native exports.
- **Muse**: Mind Monitor CSV (legacy format) plus generic Muse CSV exports.
- **OBD-II**: Auto Doctor-style headers (e.g., `Engine RPM [RPM]`, `Vehicle Speed Sensor [km/h]`, `Engine Coolant Temperature [C]`).
- **Phyphox**: official Phyphox CSV/ZIP sensor exports.

CSV parsing relies on header matching and heuristics. If your export uses different column names, rename headers to the expected labels.

## What's real vs simulated
| Module | Live | Debug/Replay | Current reality |
| --- | --- | --- | --- |
| Polar H10 | Web Bluetooth | CSV | Live is real |
| Muse S Athena | WS from Swift bridge | CSV | Live is real (requires Muse.framework) |
| OBD-II | UI simulated | CSV | Bridge is real, UI not wired |
| Phyphox | Simulated | CSV/ZIP | Real from files only |
| DJI Osmo 360 | Sample video | MP4 local | No live camera link |

## Technology stack
- **Frontend**: HTML/CSS/JS (ES modules), Chart.js, Leaflet, Web Bluetooth, WebSocket, Web Workers, File API, drag and drop, DecompressionStream (ZIP).
- **Backend**: Node.js (`ws`, `net`) for OBD; Swift + Network framework + Muse SDK for Muse.
- **Data**: local CSV/ZIP, manual export, no database or cloud storage.

## Advantages
- Local-first workflow: low latency, privacy, no cloud lock-in.
- Modular design: each sensor is isolated and replaceable.
- Live + Debug in the same UI: real sessions and file replay share the same tooling.
- Fast analysis UX: markers, quick export, sliding windows, HRV metrics included.
- Common CSV export format across sensors to ease later timeline sync.

## Limits and constraints
- No multi-sensor time sync; modules run independently.
- OBD Live in the UI is simulated; WS feed is not connected.
- Phyphox and Osmo 360 do not stream live data.
- Muse bridge supports a single WS client and does not rate-limit high-frequency packets.
- Web Bluetooth requires a compatible browser (Chrome/Edge) and HTTPS/localhost.
- Chart.js/Leaflet and map tiles are loaded from CDNs; fully offline use needs local mirrors.
- In-memory sessions only: page reload clears data.

## Quick start
### Frontend
Serve `frontend` as the web root (avoid `file://` for module loading):
```bash
cd frontend
python3 -m http.server 8000
```
Open `http://localhost:8000/public/`.

### Muse bridge (macOS)
```bash
cd backend/bridges/muse
ln -s ../../../private/vendor/muse/Muse.framework .
swiftc -F . -framework Muse -o bridge main.swift
./bridge
```
UI endpoint: `ws://localhost:3002`.

### OBD bridge (ELM327 Wi-Fi)
```bash
WS_PORT=3001 OBD_HOST=192.168.0.10 OBD_PORT=35000 node backend/bridges/obd/bridge.js
```
Note: the UI does not consume the WS yet (Live is simulated).

### Debug mode
- Polar/Muse/OBD/Phyphox: switch to Debug and load CSV or ZIP.
- Osmo 360: switch to Debug and drop MP4s in the video frames.

## Repo structure
- `frontend/`: static UI (sensor modules, charts, map, video).
- `backend/bridges/obd/`: Node bridge (ELM327 Wi-Fi -> WebSocket).
- `backend/bridges/muse/`: Swift bridge for Muse Athena S.
- `private/vendor/muse/Muse.framework`: proprietary SDK (not included; request access from muse.com).
- `frontend/media/`: Osmo 360 sample videos for demo.

## Future work
- Rename Debug mode to **Replay** mode (more accurate for playback).
- Wire OBD WS live feed into the UI (replace simulation).
- Add cross-sensor time alignment and session sync.
- Add Muse WS broadcast + rate limiting for high-frequency streams.
- Support live Phyphox streaming (if available) and richer metadata.
- Bundle libraries and tiles for offline-first demo packs.
