import { pad2, formatLocalTimestamp, formatFileTimestamp, parseTimestampString } from '../../lib/time.js';
import { createZipBlob } from '../../lib/zip.js';

const obdConnectButton = document.getElementById('obdConnectButton');
const obdLoadCsvButton = document.getElementById('obdLoadCsvButton');
const obdCsvInput = document.getElementById('obdCsvInput');
const obdDownloadButton = document.getElementById('obdDownloadButton');
const obdMarkerButton = document.getElementById('obdMarkerButton');
const obdStatusEl = document.getElementById('obdStatus');
const obdStatusLed = document.getElementById('obdStatusLed');
const obdMetricSelect = document.getElementById('obdMetricSelect');
const obdChartContainer = document.getElementById('obdChartContainer');
const obdChartDropZone = document.getElementById('obdChartDropZone');
const obdChartScroll = document.getElementById('obdChartScroll');
const obdChartScrollInput = document.getElementById('obdChartScrollInput');
const obdMarkerOverlay = document.getElementById('obdMarkerOverlay');
const obdElapsedTimeEl = document.getElementById('obdElapsedTime');
const obdElapsedLabelEl = document.getElementById('obdElapsedLabel');
const obdConnectionTimeEl = document.getElementById('obdConnectionTime');
const obdRpmCardEl = document.getElementById('obdRpmCard');
const obdSpeedCardEl = document.getElementById('obdSpeedCard');
const obdSpeedMaxEl = document.getElementById('obdSpeedMax');
const obdSpeedMaxTimeEl = document.getElementById('obdSpeedMaxTime');
const obdCoolantCardEl = document.getElementById('obdCoolantCard');
const obdModeButtons = document.querySelectorAll('.mode-btn-obd');
const obdTelemetryEls = {
    coolant: document.getElementById('obdTelemetryCoolant'),
    intakeTemp: document.getElementById('obdTelemetryIntakeTemp'),
    engineLoad: document.getElementById('obdTelemetryEngineLoad'),
    throttle: document.getElementById('obdTelemetryThrottle'),
    manifoldPressure: document.getElementById('obdTelemetryManifoldPressure'),
    fuelConsumption: document.getElementById('obdTelemetryFuelConsumption'),
    fuelLevel: document.getElementById('obdTelemetryFuelLevel'),
    batteryVoltage: document.getElementById('obdTelemetryBatteryVoltage'),
    engineTorque: document.getElementById('obdTelemetryEngineTorque'),
    enginePower: document.getElementById('obdTelemetryEnginePower'),
    boostPressure: document.getElementById('obdTelemetryBoostPressure'),
    ambientTemp: document.getElementById('obdTelemetryAmbientTemp')
};

const OBD_WINDOW_POINTS = 120;
const OBD_SAMPLE_MS = 1000;
const OBD_REDRAW_MS = 500;
const OBD_MARKER_COOLDOWN_MS = 15000;
const OBD_MAX_RECORDS = 20000;
const OBD_AXIS_FONT = { family: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' };
const OBD_MARKER_LINE_HEIGHT = 168;
const OBD_POINT_COLOR = (ctx) => ctx?.dataset?.borderColor || '#0a84ff';

const obdMetricConfig = {
    rpm: {
        label: 'RPM',
        unit: 'RPM',
        min: 0,
        max: 7000,
        color: '#0a84ff',
        background: 'rgba(10, 132, 255, 0.16)',
        decimals: 0,
        headers: ['Engine RPM [RPM]', 'RPM']
    },
    speed: {
        label: 'Velocità (km/h)',
        unit: 'km/h',
        min: 0,
        max: 220,
        color: '#ff3b30',
        background: 'rgba(255, 59, 48, 0.16)',
        decimals: 0,
        headers: ['Vehicle Speed Sensor [km/h]', 'GPS speed [km/h]']
    },
    coolant: {
        label: 'Temp. liquido (°C)',
        unit: '°C',
        min: 0,
        max: 130,
        color: '#34c759',
        background: 'rgba(52, 199, 89, 0.16)',
        decimals: 0,
        headers: ['Engine Coolant Temperature [°C]']
    },
    intakeTemp: {
        label: 'Temp. aria (°C)',
        unit: '°C',
        min: -10,
        max: 80,
        color: '#ff9f0a',
        background: 'rgba(255, 159, 10, 0.16)',
        decimals: 0,
        headers: ['Intake Air Temperature [°C]']
    },
    engineLoad: {
        label: 'Carico ICE (%)',
        unit: '%',
        min: 0,
        max: 100,
        color: '#5856d6',
        background: 'rgba(88, 86, 214, 0.16)',
        decimals: 1,
        headers: ['Calculated engine load [%]']
    },
    throttle: {
        label: 'Acceleratore (%)',
        unit: '%',
        min: 0,
        max: 100,
        color: '#af52de',
        background: 'rgba(175, 82, 222, 0.16)',
        decimals: 1,
        headers: ['Absolute Throttle Position [%]']
    },
    manifoldPressure: {
        label: 'Pressione collettore (kPa)',
        unit: 'kPa',
        min: 0,
        max: 220,
        color: '#007aff',
        background: 'rgba(0, 122, 255, 0.16)',
        decimals: 1,
        headers: ['Intake Manifold Absolute Pressure [kPa]']
    },
    fuelConsumption: {
        label: 'Consumo carburante (l/100km)',
        unit: 'l/100km',
        min: 0,
        max: 30,
        color: '#8e44ad',
        background: 'rgba(142, 68, 173, 0.18)',
        decimals: 1,
        headers: ['Fuel consumption [l/100km]']
    },
    fuelLevel: {
        label: 'Livello carburante (%)',
        unit: '%',
        min: 0,
        max: 100,
        color: '#4cd964',
        background: 'rgba(76, 217, 100, 0.16)',
        decimals: 1,
        headers: ['Fuel Level Input [%]']
    },
    batteryVoltage: {
        label: 'Batteria (V)',
        unit: 'V',
        min: 10,
        max: 15.5,
        color: '#ffcc00',
        background: 'rgba(255, 204, 0, 0.18)',
        decimals: 2,
        headers: ['Battery voltage [V]', 'Control module voltage [V]']
    },
    engineTorque: {
        label: 'Coppia (Nm)',
        unit: 'Nm',
        min: 0,
        max: 350,
        color: '#ff2d55',
        background: 'rgba(255, 45, 85, 0.16)',
        decimals: 0,
        headers: ['Engine torque [Nm]']
    },
    enginePower: {
        label: 'Potenza ICE (kW)',
        unit: 'kW',
        min: 0,
        max: 140,
        color: '#ff9500',
        background: 'rgba(255, 149, 0, 0.16)',
        decimals: 0,
        headers: ['Engine power [kW]']
    },
    boostPressure: {
        label: 'Boost (kPa)',
        unit: 'kPa',
        min: -100,
        max: 200,
        color: '#32ade6',
        background: 'rgba(50, 173, 230, 0.16)',
        decimals: 1,
        headers: ['Boost pressure [kPa]']
    },
    ambientTemp: {
        label: 'Temp. ambiente (°C)',
        unit: '°C',
        min: -10,
        max: 50,
        color: '#ffd60a',
        background: 'rgba(255, 214, 10, 0.16)',
        decimals: 0,
        headers: ['Ambient Air Temperature [°C]']
    }
};

const obdMetricOrder = Object.keys(obdMetricConfig);

let obdChart = null;
let obdMode = 'live';
let obdRecordedData = [];
let obdConnectionStartTime = null;
let obdConnectionTimerId = null;
let obdSimTimer = null;
let obdSimState = null;
let obdChartControlsEnabled = false;
let obdDebugWindowStart = 0;
let obdMarkers = [];
let obdMarkerCounter = 1;
let obdMarkerCooldownTimer = null;
let obdMarkerActive = true;
let obdMarkerPoints = [];
let obdSessionCounter = 1;
let obdLastRedrawTs = 0;
const obdData = {
    metric: 'rpm',
    speedMax: null,
    speedMaxTimeLabel: null
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function jitter(value, amount) {
    return value + (Math.random() * 2 - 1) * amount;
}

function normalizeHeaderName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function parseCsvNumber(value) {
    if (value == null) return null;
    let str = String(value).trim();
    if (!str) return null;
    if (str.includes(',') && !str.includes('.')) {
        str = str.replace(',', '.');
    }
    const num = Number(str);
    if (!Number.isFinite(num)) return null;
    return num;
}

function splitCsvLine(line, delimiter = ',') {
    const out = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (ch === delimiter && !inQuotes) {
            out.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    out.push(current);
    return out;
}

function detectCsvDelimiter(line) {
    const commaCount = (line.match(/,/g) || []).length;
    const semiCount = (line.match(/;/g) || []).length;
    return semiCount > commaCount ? ';' : ',';
}

function parseObdTimeString(value) {
    if (!value) return null;
    const match = String(value).trim().match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
    if (!match) return null;
    const now = new Date();
    const [, h, m, s, ms] = match;
    const millis = ms ? Number(ms.padEnd(3, '0')) : 0;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(h), Number(m), Number(s), millis).getTime();
}

function formatObdFullTimestamp(rawTs, tsNum) {
    const parsed = parseTimestampString(rawTs);
    if (parsed) return formatLocalTimestamp(parsed);
    return formatLocalTimestamp(new Date(tsNum));
}

function normalizeObdTimestamp(rawTs) {
    if (rawTs == null) return Date.now();
    if (rawTs instanceof Date) return rawTs.getTime();
    if (typeof rawTs === 'string') {
        const parsed = parseTimestampString(rawTs);
        if (parsed) return parsed.getTime();
        const parsedTime = parseObdTimeString(rawTs);
        if (parsedTime != null) return parsedTime;
    }
    const num = Number(rawTs);
    if (!Number.isFinite(num)) return Date.now();
    if (num > 1e13) return Math.floor(num / 1000);
    if (num < 1e11) return Math.floor(num * 1000);
    return num;
}

function formatObdDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function formatObdTimeLabel(rawTs, tsNum) {
    if (typeof rawTs === 'string') {
        const match = rawTs.match(/^(\d{1,2}:\d{2}:\d{2})/);
        if (match) return match[1];
    }
    const d = new Date(tsNum);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function slugifyLabel(label) {
    return String(label || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function getNextObdSessionId() {
    return pad2(obdSessionCounter++);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function setObdStatus(connected) {
    if (obdMode === 'debug') {
        if (obdStatusLed) obdStatusLed.classList.remove('connected');
        if (obdStatusEl) obdStatusEl.textContent = 'Modalità debug';
        if (obdConnectButton) {
            obdConnectButton.textContent = 'Connetti';
            obdConnectButton.classList.remove('disconnect');
        }
        return;
    }
    if (obdStatusLed) obdStatusLed.classList.toggle('connected', connected);
    if (obdStatusEl) obdStatusEl.textContent = connected ? 'Connesso' : 'Non connesso';
    if (obdConnectButton) {
        obdConnectButton.textContent = connected ? 'Disconnetti' : 'Connetti';
        obdConnectButton.classList.toggle('disconnect', connected);
    }
}

function updateObdElapsedTime() {
    if (!obdConnectionStartTime || !obdElapsedTimeEl) return;
    const now = new Date();
    const diffMs = now - obdConnectionStartTime;
    obdElapsedTimeEl.textContent = formatObdDuration(diffMs);
}

function resetObdTelemetry() {
    Object.values(obdTelemetryEls).forEach((el) => {
        if (el) el.textContent = '--';
    });
}

function updateObdTelemetry(values = {}) {
    Object.keys(obdTelemetryEls).forEach((key) => {
        const el = obdTelemetryEls[key];
        if (!el) return;
        const val = values?.[key];
        if (val == null || Number.isNaN(val)) {
            el.textContent = '--';
            return;
        }
        const decimals = obdMetricConfig[key]?.decimals ?? 2;
        el.textContent = val.toFixed(decimals);
    });
}

function applyObdMarkerState() {
    if (!obdMarkerButton) return;
    const enabled = obdChartControlsEnabled && obdMarkerActive;
    obdMarkerButton.disabled = !enabled;
    obdMarkerButton.classList.toggle('disabled', !enabled);
    obdMarkerButton.setAttribute('aria-disabled', (!enabled).toString());
}

function setObdChartControlsEnabled(enabled) {
    obdChartControlsEnabled = enabled;
    const iconButtons = [obdDownloadButton, obdMarkerButton];
    iconButtons.forEach((btn) => {
        if (!btn) return;
        btn.disabled = !enabled;
        btn.classList.toggle('disabled', !enabled);
        btn.setAttribute('aria-disabled', (!enabled).toString());
    });
    if (obdMetricSelect) {
        obdMetricSelect.disabled = !enabled;
        obdMetricSelect.classList.toggle('disabled', !enabled);
        obdMetricSelect.setAttribute('aria-disabled', (!enabled).toString());
    }
    if (obdChartScrollInput) {
        obdChartScrollInput.disabled = !enabled;
    }
    if (!enabled) {
        if (obdMarkerCooldownTimer) clearTimeout(obdMarkerCooldownTimer);
        obdMarkerCooldownTimer = null;
        obdMarkerActive = true;
    }
    applyObdMarkerState();
}

function startObdMarkerCooldown() {
    obdMarkerActive = false;
    if (obdMarkerCooldownTimer) clearTimeout(obdMarkerCooldownTimer);
    obdMarkerCooldownTimer = setTimeout(() => {
        obdMarkerCooldownTimer = null;
        obdMarkerActive = true;
        applyObdMarkerState();
    }, OBD_MARKER_COOLDOWN_MS);
    applyObdMarkerState();
}

function ensureObdDebugMode() {
    if (obdMode === 'debug') return true;
    setObdMode('debug');
    return obdMode === 'debug';
}

function resetObdValues() {
    if (obdRpmCardEl) obdRpmCardEl.textContent = '--';
    if (obdSpeedCardEl) obdSpeedCardEl.textContent = '--';
    if (obdCoolantCardEl) obdCoolantCardEl.textContent = '--';
    if (obdSpeedMaxEl) obdSpeedMaxEl.textContent = '--';
    if (obdSpeedMaxTimeEl) obdSpeedMaxTimeEl.textContent = '--';
    resetObdTelemetry();
}

function clearObdData() {
    obdRecordedData = [];
    obdMarkers = [];
    obdMarkerCounter = 1;
    obdMarkerPoints = [];
    obdDebugWindowStart = 0;
    obdData.speedMax = null;
    obdData.speedMaxTimeLabel = null;
    resetObdValues();
    if (obdChart) {
        obdChart.data.labels = [];
        obdChart.data.datasets[0].data = [];
        obdChart.update('none');
    }
}

function initObdChart() {
    const ctxObd = document.getElementById('obdChart').getContext('2d');
    const cfg = obdMetricConfig[obdData.metric];
    obdChart = new Chart(ctxObd, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: cfg?.label || 'RPM',
                data: [],
                borderColor: cfg?.color || '#0a84ff',
                pointBorderColor: OBD_POINT_COLOR,
                pointBackgroundColor: OBD_POINT_COLOR,
                pointHoverBorderColor: OBD_POINT_COLOR,
                pointHoverBackgroundColor: OBD_POINT_COLOR,
                backgroundColor: cfg?.background || 'rgba(10, 132, 255, 0.16)',
                borderWidth: 2,
                tension: 0.1,
                pointRadius: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 16,
                    right: 8,
                    left: 8,
                    bottom: 8
                }
            },
            scales: {
                x: {
                    display: true,
                    position: 'bottom',
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: {
                        color: 'rgba(60,60,67,0.7)',
                        font: OBD_AXIS_FONT,
                        autoSkip: true,
                        maxTicksLimit: 6
                    },
                    title: { display: true, text: 'Tempo (HH:MM:SS)', color: 'rgba(60,60,67,0.7)' }
                },
                y: {
                    display: true,
                    position: 'left',
                    min: cfg?.min ?? 0,
                    max: cfg?.max ?? 100,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: {
                        color: 'rgba(60,60,67,0.7)',
                        font: OBD_AXIS_FONT
                    },
                    title: { display: true, text: cfg?.label || 'RPM', color: 'rgba(60,60,67,0.7)' }
                }
            },
            elements: {
                point: {
                    backgroundColor: OBD_POINT_COLOR,
                    borderColor: OBD_POINT_COLOR
                }
            },
            plugins: { legend: { display: false } },
            animation: false
        }
    });
}

function updateObdChartStyle(metricKey) {
    if (!obdChart) return;
    const cfg = obdMetricConfig[metricKey];
    if (!cfg) return;
    obdChart.data.datasets[0].borderColor = cfg.color;
    obdChart.data.datasets[0].pointBorderColor = OBD_POINT_COLOR;
    obdChart.data.datasets[0].pointBackgroundColor = OBD_POINT_COLOR;
    obdChart.data.datasets[0].pointHoverBorderColor = OBD_POINT_COLOR;
    obdChart.data.datasets[0].pointHoverBackgroundColor = OBD_POINT_COLOR;
    obdChart.data.datasets[0].backgroundColor = cfg.background;
    obdChart.data.datasets[0].label = cfg.label;
    if (obdChart.options?.scales?.y?.title) {
        const yLabel = cfg.unit ? `${cfg.label}` : cfg.label;
        obdChart.options.scales.y.title.text = yLabel;
    }
    obdChart.options.scales.y.min = cfg.min;
    obdChart.options.scales.y.max = cfg.max;
    if (!obdChart.options.elements) obdChart.options.elements = {};
    obdChart.options.elements.point = {
        ...(obdChart.options.elements.point || {}),
        backgroundColor: OBD_POINT_COLOR,
        borderColor: OBD_POINT_COLOR
    };
}

function getObdWindowMeta() {
    const windowSize = OBD_WINDOW_POINTS;
    const maxStart = Math.max(0, obdRecordedData.length - windowSize);
    const startIndex = (obdMode === 'debug')
        ? Math.min(obdDebugWindowStart, maxStart)
        : Math.max(0, maxStart);
    return {
        rows: obdRecordedData.slice(startIndex, startIndex + windowSize),
        startIndex
    };
}

function updateObdChartScrollState() {
    if (!obdChartScroll || !obdChartScrollInput) return;
    if (obdMode !== 'debug') {
        obdChartScroll.hidden = true;
        obdDebugWindowStart = 0;
        return;
    }
    const maxStart = Math.max(0, obdRecordedData.length - OBD_WINDOW_POINTS);
    const shouldShow = maxStart > 0;
    obdChartScroll.hidden = !shouldShow;
    if (!shouldShow) {
        obdDebugWindowStart = 0;
        return;
    }
    if (obdDebugWindowStart > maxStart) obdDebugWindowStart = maxStart;
    obdChartScrollInput.min = '0';
    obdChartScrollInput.max = `${maxStart}`;
    obdChartScrollInput.step = '1';
    obdChartScrollInput.value = `${obdDebugWindowStart}`;
}

function recordObdSample(values, timestamp) {
    const tsNum = normalizeObdTimestamp(timestamp);
    const tsLabel = formatObdTimeLabel(timestamp, tsNum);
    const tsFull = formatLocalTimestamp(new Date(tsNum));
    const row = {
        timestamp: tsNum,
        timestampLabel: tsLabel,
        timestampFull: tsFull,
        values: { ...values }
    };
    obdRecordedData.push(row);
    if (obdMode !== 'debug' && obdRecordedData.length > OBD_MAX_RECORDS) {
        obdRecordedData.shift();
    }

    if (values.rpm != null && obdRpmCardEl) obdRpmCardEl.textContent = values.rpm.toFixed(0);
    if (values.speed != null && obdSpeedCardEl) obdSpeedCardEl.textContent = values.speed.toFixed(0);
    if (values.coolant != null && obdCoolantCardEl) obdCoolantCardEl.textContent = values.coolant.toFixed(0);

    if (values.speed != null && !Number.isNaN(values.speed)) {
        if (obdData.speedMax == null || values.speed > obdData.speedMax) {
            obdData.speedMax = values.speed;
            if (obdSpeedMaxEl) obdSpeedMaxEl.textContent = values.speed.toFixed(0);
            if (obdSpeedMaxTimeEl) obdSpeedMaxTimeEl.textContent = tsFull || '--';
            obdData.speedMaxTimeLabel = tsFull || null;
        }
    }
    updateObdTelemetry(values);

    const nowTs = Date.now();
    if (nowTs - obdLastRedrawTs >= OBD_REDRAW_MS) {
        obdLastRedrawTs = nowTs;
        redrawObdChart();
    }
}

function redrawObdChart() {
    if (!obdChart) return;
    const { rows } = getObdWindowMeta();
    const labels = [];
    const values = [];
    rows.forEach((row) => {
        const v = row.values?.[obdData.metric];
        labels.push(row.timestampLabel || formatObdTimeLabel(row.timestamp, row.timestamp));
        values.push(v != null && !Number.isNaN(v) ? v : null);
    });
    obdChart.data.labels = labels;
    obdChart.data.datasets[0].data = values;
    updateObdChartStyle(obdData.metric);
    const cfg = obdMetricConfig[obdData.metric];
    if (cfg) {
        const pointColors = values.map(() => cfg.color);
        obdChart.data.datasets[0].pointBackgroundColor = pointColors;
        obdChart.data.datasets[0].pointBorderColor = pointColors;
        obdChart.data.datasets[0].pointHoverBackgroundColor = pointColors;
        obdChart.data.datasets[0].pointHoverBorderColor = pointColors;
    }
    obdChart.update('none');
    updateObdChartScrollState();
    rebuildObdMarkersDataset();
}

function rebuildObdMarkersDataset() {
    if (!obdChart || !obdMarkerOverlay) return;
    obdMarkerPoints = [];
    const { rows } = getObdWindowMeta();
    const rowMarkerLabels = new Set();
    rows.forEach((row, idx) => {
        if (row && row.marker != null && row.marker !== '') {
            obdMarkerPoints.push({ xIndex: idx, marker: row.marker });
            rowMarkerLabels.add(String(row.marker));
        }
    });
    const extraMarkers = obdMarkers.filter(marker => !rowMarkerLabels.has(String(marker?.label)));
    if (extraMarkers.length) {
        let minTs = Infinity;
        let maxTs = -Infinity;
        rows.forEach((row) => {
            const ts = Number(row?.timestamp);
            if (!Number.isFinite(ts)) return;
            if (ts < minTs) minTs = ts;
            if (ts > maxTs) maxTs = ts;
        });
        extraMarkers.forEach((marker) => {
            const ts = Number(marker?.timestamp);
            if (!Number.isFinite(ts)) return;
            if (ts < minTs || ts > maxTs) return;
            let bestIdx = -1;
            let bestDiff = Infinity;
            for (let i = 0; i < rows.length; i++) {
                const rowTs = Number(rows[i]?.timestamp);
                if (!Number.isFinite(rowTs)) continue;
                const diff = Math.abs(rowTs - ts);
                if (diff < bestDiff || (diff === bestDiff && i > bestIdx)) {
                    bestDiff = diff;
                    bestIdx = i;
                }
            }
            if (bestIdx >= 0) {
                obdMarkerPoints.push({ xIndex: bestIdx, marker: marker.label });
            }
        });
    }
    requestAnimationFrame(drawObdMarkerOverlay);
}

function drawObdMarkerOverlay() {
    if (!obdMarkerOverlay || !obdChart || !obdChart.scales?.x || !obdChart.scales?.y) return;
    const xScale = obdChart.scales.x;
    const yScale = obdChart.scales.y;
    const chartArea = obdChart.chartArea;
    const rect = obdChart.canvas.getBoundingClientRect();
    const containerRect = obdChartContainer?.getBoundingClientRect();
    const offsetX = containerRect ? rect.left - containerRect.left : 0;
    const offsetY = containerRect ? rect.top - containerRect.top : 0;
    const dpr = window.devicePixelRatio || 1;
    const canvasScale = rect.width ? (obdChart.canvas.width / rect.width) : dpr;
    const chartMaxRight = chartArea?.right ?? xScale.right ?? 0;
    const needsScale = rect.width > 0 && chartMaxRight > rect.width + 1;
    const toCss = (v) => (needsScale ? (v / canvasScale) : v);
    obdMarkerOverlay.width = rect.width * dpr;
    obdMarkerOverlay.height = rect.height * dpr;
    obdMarkerOverlay.style.width = `${rect.width}px`;
    obdMarkerOverlay.style.height = `${rect.height}px`;
    obdMarkerOverlay.style.left = `${offsetX}px`;
    obdMarkerOverlay.style.top = `${offsetY}px`;
    const ctx = obdMarkerOverlay.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (!obdMarkerPoints.length) {
        ctx.restore();
        return;
    }
    const left = toCss(Number.isFinite(xScale.left) ? xScale.left : (chartArea?.left ?? 0));
    const right = toCss(Number.isFinite(xScale.right) ? xScale.right : (chartArea?.right ?? rect.width));
    const yTop = toCss(Number.isFinite(yScale.top) ? yScale.top : (chartArea?.top ?? 0));
    const yBottom = Math.min(yTop + OBD_MARKER_LINE_HEIGHT, rect.height);
    if (right > left && yBottom > yTop) {
        ctx.beginPath();
        ctx.rect(left, yTop, right - left, yBottom - yTop);
        ctx.clip();
    }
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = '#ff9f0a';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#ff9f0a';
    obdMarkerPoints.forEach((pt) => {
        if (!pt || pt.xIndex == null) return;
        const x = toCss(xScale.getPixelForValue(pt.xIndex));
        ctx.beginPath();
        ctx.moveTo(x, yTop);
        ctx.lineTo(x, yBottom);
        ctx.stroke();
        const triH = 10;
        const triW = 12;
        ctx.beginPath();
        ctx.moveTo(x, yTop + triH);
        ctx.lineTo(x - triW / 2, yTop);
        ctx.lineTo(x + triW / 2, yTop);
        ctx.closePath();
        ctx.fill();
    });
    ctx.restore();
}

function addObdMarker() {
    if (!obdChart || !obdRecordedData.length) {
        alert('Nessun dato disponibile per inserire un marker.');
        return;
    }
    const { rows, startIndex } = getObdWindowMeta();
    if (!rows.length) {
        alert('Nessun dato disponibile per inserire un marker.');
        return;
    }
    let targetIndex = -1;
    for (let i = rows.length - 1; i >= 0; i--) {
        const val = rows[i]?.values?.[obdData.metric];
        if (val != null && !Number.isNaN(val)) {
            targetIndex = i;
            break;
        }
    }
    if (targetIndex === -1) targetIndex = rows.length - 1;
    const globalIdx = startIndex + targetIndex;
    const row = obdRecordedData[globalIdx];
    if (!row) {
        alert('Nessun dato disponibile per inserire un marker.');
        return;
    }
    const label = obdMarkerCounter++;
    row.marker = label;
    obdMarkers.push({ timestamp: row.timestamp, label });
    rebuildObdMarkersDataset();
}

function showAllObdMetricOptions() {
    if (!obdMetricSelect) return;
    Array.from(obdMetricSelect.options).forEach(opt => {
        opt.hidden = false;
        opt.disabled = false;
    });
}

function setObdMetricOptionsVisibilityForDebug(options = {}) {
    const { preferred = null, forceFirst = false } = options;
    if (!obdMetricSelect) return;
    if (obdMode !== 'debug' || !obdRecordedData.length) {
        showAllObdMetricOptions();
        return;
    }
    const availability = {};
    obdMetricOrder.forEach((key) => {
        availability[key] = false;
    });
    obdRecordedData.forEach((row) => {
        if (!row?.values) return;
        Object.keys(row.values).forEach((key) => {
            if (row.values[key] != null && !Number.isNaN(row.values[key])) {
                availability[key] = true;
            }
        });
    });

    let firstAvailable = null;
    Array.from(obdMetricSelect.options).forEach((opt) => {
        const available = availability[opt.value] !== false;
        opt.hidden = !available;
        opt.disabled = !available;
        if (available && !firstAvailable) firstAvailable = opt.value;
    });

    const selectedOption = Array.from(obdMetricSelect.options).find(opt => opt.value === obdMetricSelect.value);
    const selectedAvailable = selectedOption ? !selectedOption.disabled : false;
    let target = null;
    if (preferred && availability[preferred] !== false) {
        target = preferred;
    } else if (forceFirst || !selectedAvailable) {
        target = firstAvailable;
    }
    if (target && target !== obdData.metric) {
        obdData.metric = target;
        if (obdMetricSelect) obdMetricSelect.value = target;
        redrawObdChart();
    }
}

function startObdSimulation() {
    if (obdSimTimer) clearInterval(obdSimTimer);
    obdSimState = {
        speed: 0,
        targetSpeed: 0,
        rpm: 800,
        coolant: 70,
        throttle: 5,
        engineLoad: 20,
        intakeTemp: 30,
        ambientTemp: 18,
        manifoldPressure: 35,
        fuelConsumption: 1.2,
        fuelLevel: 60,
        batteryVoltage: 13.2,
        baroPressure: 101,
        boostPressure: -60,
        engineTorque: 60,
        enginePower: 5
    };
    obdSimTimer = setInterval(() => {
        if (!obdSimState) return;
        if (Math.random() < 0.04) {
            obdSimState.targetSpeed = Math.random() < 0.25
                ? 0
                : clamp(Math.random() * 120 + 10, 0, 130);
        }
        const speedDelta = (obdSimState.targetSpeed - obdSimState.speed) * 0.12 + jitter(0, 2.2);
        obdSimState.speed = clamp(obdSimState.speed + speedDelta, 0, 140);

        const throttleTarget = clamp(4 + obdSimState.speed / 3 + jitter(0, 6), 0, 100);
        obdSimState.throttle = clamp(obdSimState.throttle + (throttleTarget - obdSimState.throttle) * 0.2, 0, 100);
        obdSimState.engineLoad = clamp(obdSimState.throttle * 0.75 + jitter(0, 6), 0, 100);
        obdSimState.rpm = clamp(700 + obdSimState.speed * 28 + obdSimState.throttle * 18 + jitter(0, 120), 700, 4500);

        const coolantTarget = 92;
        obdSimState.coolant = clamp(obdSimState.coolant + (coolantTarget - obdSimState.coolant) * 0.02 + jitter(0, 0.4), 60, 110);
        obdSimState.intakeTemp = clamp(obdSimState.ambientTemp + obdSimState.engineLoad * 0.08 + jitter(0, 1.2), 10, 70);
        obdSimState.manifoldPressure = clamp(30 + obdSimState.engineLoad * 1.2 + jitter(0, 6), 20, 210);
        obdSimState.boostPressure = clamp(obdSimState.manifoldPressure - obdSimState.baroPressure, -100, 150);

        obdSimState.fuelConsumption = obdSimState.speed < 1
            ? 0.6
            : clamp(4 + obdSimState.engineLoad * 0.08 + Math.abs(jitter(0, 1.5)), 2, 25);
        obdSimState.fuelLevel = clamp(obdSimState.fuelLevel - Math.max(0, obdSimState.speed) * 0.0002 + jitter(0, 0.01), 5, 100);
        obdSimState.batteryVoltage = clamp(12.6 + (obdSimState.speed > 0 ? 0.6 : 0.2) + jitter(0, 0.08), 12, 14.8);
        obdSimState.engineTorque = clamp(50 + obdSimState.engineLoad * 2.2 + jitter(0, 8), 40, 280);
        obdSimState.enginePower = clamp((obdSimState.engineTorque * obdSimState.rpm) / 9549, 0, 140);

        const values = {
            rpm: obdSimState.rpm,
            speed: obdSimState.speed,
            coolant: obdSimState.coolant,
            intakeTemp: obdSimState.intakeTemp,
            engineLoad: obdSimState.engineLoad,
            throttle: obdSimState.throttle,
            manifoldPressure: obdSimState.manifoldPressure,
            fuelConsumption: obdSimState.fuelConsumption,
            fuelLevel: obdSimState.fuelLevel,
            batteryVoltage: obdSimState.batteryVoltage,
            engineTorque: obdSimState.engineTorque,
            enginePower: obdSimState.enginePower,
            boostPressure: obdSimState.boostPressure,
            ambientTemp: obdSimState.ambientTemp
        };
        recordObdSample(values, new Date());
    }, OBD_SAMPLE_MS);
}

function stopObdSimulation() {
    if (obdSimTimer) {
        clearInterval(obdSimTimer);
        obdSimTimer = null;
    }
    obdSimState = null;
}

function connectObd() {
    if (obdMode !== 'live') return;
    if (obdSimTimer) {
        const confirmed = window.confirm('Disconnettendo il sensore i dati rimarranno visibili ma non saranno più in tempo reale');
        if (!confirmed) return;
        disconnectObd();
        return;
    }
    setObdStatus(true);
    setObdChartControlsEnabled(true);
    startObdMarkerCooldown();
    obdConnectionStartTime = new Date();
    if (obdConnectionTimeEl) {
        obdConnectionTimeEl.textContent = `Dal: ${formatLocalTimestamp(obdConnectionStartTime)}`;
    }
    if (obdConnectionTimerId) clearInterval(obdConnectionTimerId);
    obdConnectionTimerId = setInterval(updateObdElapsedTime, 1000);
    updateObdElapsedTime();
    clearObdData();
    startObdSimulation();
}

function disconnectObd() {
    stopObdSimulation();
    setObdStatus(false);
    setObdChartControlsEnabled(false);
    if (obdConnectionTimerId) clearInterval(obdConnectionTimerId);
    obdConnectionTimerId = null;
    obdConnectionStartTime = null;
    if (obdElapsedTimeEl) obdElapsedTimeEl.textContent = '00:00:00';
    if (obdConnectionTimeEl) obdConnectionTimeEl.textContent = '';
}

function loadObdCsvDataFromText(text) {
    clearObdData();
    if (obdElapsedLabelEl) obdElapsedLabelEl.textContent = 'Durata totale';
    if (obdConnectionTimeEl) obdConnectionTimeEl.textContent = 'Da file CSV';

    let content = String(text || '');
    content = content.replace(/\u0000/g, '');
    if (!content.trim()) {
        alert('CSV vuoto o non leggibile.');
        return;
    }
    if (!content.includes('\n') && !content.includes('\r') && (content.includes('\\n') || content.includes('\\r'))) {
        content = content.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n');
    }
    content = content
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[\u2028\u2029\u0085\u000b\u000c\u001e]/g, '\n');
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
        alert('Il file CSV non contiene dati sufficienti.');
        return;
    }

    const headerLine = lines[0].replace(/^\uFEFF/, '');
    const delimiter = detectCsvDelimiter(headerLine);
    const header = splitCsvLine(headerLine, delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    const headerLower = header.map(normalizeHeaderName);
    const headerMap = new Map();
    headerLower.forEach((name, idx) => headerMap.set(name, idx));
    const findIdx = (names) => {
        for (const name of names) {
            const idx = headerMap.get(normalizeHeaderName(name));
            if (idx != null) return idx;
        }
        return -1;
    };

    const idxTime = findIdx(['time', 'timestamp']);
    const idxMarker = findIdx(['marker']);
    if (idxTime === -1) {
        alert('CSV non valido: manca la colonna "Time" o "timestamp".');
        return;
    }

    const metricIdx = {};
    obdMetricOrder.forEach((key) => {
        const cfg = obdMetricConfig[key];
        if (!cfg) return;
        const names = [key];
        if (cfg.label) names.push(cfg.label);
        if (cfg.headers?.length) names.push(...cfg.headers);
        const idx = findIdx(names);
        if (idx !== -1) metricIdx[key] = idx;
    });

    if (!Object.keys(metricIdx).length) {
        alert('CSV non valido: nessuna metrica riconosciuta.');
        return;
    }

    const markerByTs = new Map();

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = splitCsvLine(line, delimiter);
        const rawTs = cols[idxTime];
        const tsNum = normalizeObdTimestamp(rawTs);
        const timestampFull = formatObdFullTimestamp(rawTs, tsNum);
        const values = {};
        Object.entries(metricIdx).forEach(([key, idx]) => {
            const val = parseCsvNumber(cols[idx]);
            if (val != null) values[key] = val;
        });
        if (!Object.keys(values).length && idxMarker === -1) continue;
        const row = {
            timestamp: tsNum,
            timestampLabel: formatObdTimeLabel(rawTs, tsNum),
            timestampFull,
            values
        };
        if (idxMarker !== -1) {
            const markerVal = (cols[idxMarker] || '').trim();
            if (markerVal) {
                row.marker = markerVal;
                markerByTs.set(tsNum, markerVal);
            }
        }
        obdRecordedData.push(row);
    }

    if (markerByTs.size) {
        const rowForTimestamp = new Map();
        obdRecordedData.forEach((row) => {
            if (!row) return;
            const marker = markerByTs.get(row.timestamp);
            if (marker != null && marker !== '') {
                rowForTimestamp.set(row.timestamp, row);
            }
        });
        rowForTimestamp.forEach((row, timestamp) => {
            const marker = markerByTs.get(timestamp);
            if (marker != null && marker !== '') {
                row.marker = marker;
            }
        });
        obdMarkers = Array.from(markerByTs.entries()).map(([timestamp, label]) => ({
            timestamp,
            label
        }));
        let maxMarker = 0;
        markerByTs.forEach((label) => {
            const num = Number(label);
            if (Number.isFinite(num) && num > maxMarker) maxMarker = num;
        });
        obdMarkerCounter = maxMarker + 1;
    }

    obdRecordedData.forEach((row) => {
        const speedVal = row.values?.speed;
        if (speedVal != null && !Number.isNaN(speedVal)) {
            if (obdData.speedMax == null || speedVal > obdData.speedMax) {
                obdData.speedMax = speedVal;
                obdData.speedMaxTimeLabel = row.timestampFull || formatLocalTimestamp(new Date(row.timestamp));
            }
        }
    });
    if (obdData.speedMax != null && obdSpeedMaxEl) {
        obdSpeedMaxEl.textContent = obdData.speedMax.toFixed(0);
    }
    if (obdSpeedMaxTimeEl) {
        obdSpeedMaxTimeEl.textContent = obdData.speedMaxTimeLabel || '--';
    }

    const lastRow = obdRecordedData[obdRecordedData.length - 1];
    if (lastRow?.values?.rpm != null && obdRpmCardEl) obdRpmCardEl.textContent = lastRow.values.rpm.toFixed(0);
    if (lastRow?.values?.speed != null && obdSpeedCardEl) obdSpeedCardEl.textContent = lastRow.values.speed.toFixed(0);
    if (lastRow?.values?.coolant != null && obdCoolantCardEl) obdCoolantCardEl.textContent = lastRow.values.coolant.toFixed(0);
    if (lastRow?.values) updateObdTelemetry(lastRow.values);

    const minTs = Math.min(...obdRecordedData.map(r => r.timestamp));
    const maxTs = Math.max(...obdRecordedData.map(r => r.timestamp));
    if (obdElapsedTimeEl && Number.isFinite(minTs) && Number.isFinite(maxTs)) {
        obdElapsedTimeEl.textContent = formatObdDuration(maxTs - minTs);
    }

    setObdMetricOptionsVisibilityForDebug({ preferred: obdData.metric, forceFirst: true });
    obdDebugWindowStart = Math.max(0, obdRecordedData.length - OBD_WINDOW_POINTS);
    setObdChartControlsEnabled(obdRecordedData.length > 0);
    redrawObdChart();
}

function exportObdCsv(mode, options = {}) {
    const { silent = false } = options;
    if (!obdRecordedData.length) {
        if (!silent) alert('Nessun dato OBD da esportare');
        return null;
    }
    const markerByTs = new Map();
    obdMarkers.forEach((marker) => {
        const ts = Number(marker?.timestamp);
        if (!Number.isFinite(ts)) return;
        markerByTs.set(String(ts), marker.label);
    });
    obdRecordedData.forEach((row) => {
        if (row?.marker == null || row.marker === '') return;
        const ts = Number(row.timestamp);
        if (!Number.isFinite(ts)) return;
        markerByTs.set(String(ts), row.marker);
    });
    const getMarker = (ts) => markerByTs.get(String(Number(ts))) ?? '';

    if (mode === 'current') {
        const key = obdData.metric;
        const cfg = obdMetricConfig[key];
        if (!cfg) return null;
        const header = `timestamp,${key},marker\n`;
        const rows = obdRecordedData.map(row => {
            const value = row.values?.[key];
            const formatted = (value == null || Number.isNaN(value)) ? '' : value.toFixed(cfg.decimals ?? 2);
            return `${formatLocalTimestamp(new Date(row.timestamp))},${formatted},${getMarker(row.timestamp)}`;
        }).join('\n');
        return header + rows;
    }

    const headerKeys = obdMetricOrder;
    const header = `timestamp,${headerKeys.join(',')},marker\n`;
    const rows = obdRecordedData.map(row => {
        const values = headerKeys.map((key) => {
            const cfg = obdMetricConfig[key];
            const val = row.values?.[key];
            if (val == null || Number.isNaN(val)) return '';
            return val.toFixed(cfg.decimals ?? 2);
        });
        return `${formatLocalTimestamp(new Date(row.timestamp))},${values.join(',')},${getMarker(row.timestamp)}`;
    }).join('\n');
    return header + rows;
}

function exportObdLegacyCsv() {
    if (!obdRecordedData.length) return null;
    const headers = ['Time'];
    obdMetricOrder.forEach((key) => {
        const cfg = obdMetricConfig[key];
        if (cfg?.headers?.length) headers.push(cfg.headers[0]);
    });
    headers.push('Marker');
    const rows = obdRecordedData.map((row) => {
        const ts = new Date(row.timestamp);
        const timeLabel = `${pad2(ts.getHours())}:${pad2(ts.getMinutes())}:${pad2(ts.getSeconds())}.${String(ts.getMilliseconds()).padStart(3, '0')}`;
        const values = obdMetricOrder.map((key) => {
            const cfg = obdMetricConfig[key];
            const val = row.values?.[key];
            if (val == null || Number.isNaN(val)) return '';
            return val.toFixed(cfg.decimals ?? 2);
        });
        const marker = row.marker ?? '';
        return [timeLabel, ...values, marker].join(',');
    }).join('\n');
    return `${headers.join(',')}\n${rows}`;
}

function downloadObdCsvBundle() {
    if (!obdRecordedData.length) {
        alert('Nessun dato OBD da esportare');
        return;
    }
    const currentContent = exportObdCsv('current', { silent: true });
    const fullContent = exportObdCsv('all', { silent: true });
    const legacyContent = exportObdLegacyCsv();
    if (!currentContent || !fullContent || !legacyContent) return;
    const sessionId = getNextObdSessionId();
    const dateStr = formatFileTimestamp(new Date());
    const baseName = `session${sessionId}-${dateStr}-obd`;
    const metricLabel = obdMetricConfig[obdData.metric]?.label || obdData.metric;
    const viewLabel = slugifyLabel(metricLabel) || obdData.metric || 'current';
    const zipBlob = createZipBlob([
        { name: `${baseName}-full.csv`, content: fullContent },
        { name: `${baseName}-${viewLabel}.csv`, content: currentContent },
        { name: `${baseName}-legacy.csv`, content: legacyContent }
    ]);
    downloadBlob(zipBlob, `${baseName}.zip`);
}

async function readObdCsvFile(file) {
    if (!file) return;
    try {
        let text = '';
        if (typeof file.text === 'function') {
            text = await file.text();
        }
        if (!text || !text.trim()) {
            if (typeof FileReader !== 'undefined') {
                text = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ''));
                    reader.onerror = () => reject(reader.error || new Error('CSV read failed'));
                    reader.readAsText(file);
                });
            }
        }
        if (!text || !text.trim()) {
            alert('CSV vuoto o non leggibile.');
            return;
        }
        loadObdCsvDataFromText(text);
    } catch (err) {
        console.error(err);
        alert('Errore nella lettura del file CSV.');
    }
}

function setObdMode(mode) {
    if (mode === obdMode) return;
    if (obdMode === 'live' && mode === 'debug') {
        const confirmed = window.confirm('Passando alla modalità debug tutti i dati della sessione live verranno cancellati');
        if (!confirmed) return;
        disconnectObd();
    } else if (obdMode === 'debug' && mode === 'live') {
        const confirmed = window.confirm('Passando alla modalità live tutte le modifiche apportate al CSV verranno perse');
        if (!confirmed) return;
    }
    obdMode = mode;
    obdModeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.obdMode === mode));
    if (obdElapsedLabelEl) {
        obdElapsedLabelEl.textContent = mode === 'debug' ? 'Durata totale' : 'Tempo trascorso';
    }
    if (mode === 'live') {
        if (obdLoadCsvButton) obdLoadCsvButton.style.display = 'none';
        if (obdConnectButton) obdConnectButton.style.display = 'block';
        if (obdConnectionTimeEl) obdConnectionTimeEl.textContent = '';
        if (obdElapsedTimeEl) obdElapsedTimeEl.textContent = '00:00:00';
        setObdStatus(false);
    } else {
        if (obdConnectButton) obdConnectButton.style.display = 'none';
        if (obdLoadCsvButton) obdLoadCsvButton.style.display = 'block';
        disconnectObd();
        setObdStatus(false);
        if (obdConnectionTimeEl) obdConnectionTimeEl.textContent = '';
        if (obdElapsedTimeEl) obdElapsedTimeEl.textContent = '00:00:00';
    }
    clearObdData();
    obdData.metric = 'rpm';
    if (obdMetricSelect) obdMetricSelect.value = 'rpm';
    setObdMetricOptionsVisibilityForDebug({ forceFirst: true });
    setObdChartControlsEnabled(false);
    updateObdChartScrollState();
    redrawObdChart();
}

export function initObdModule() {
    initObdChart();

    if (obdConnectButton) obdConnectButton.addEventListener('click', connectObd);
    if (obdLoadCsvButton) {
        obdLoadCsvButton.addEventListener('click', () => {
            if (!ensureObdDebugMode()) return;
            if (obdCsvInput) {
                obdCsvInput.value = '';
                obdCsvInput.click();
            }
        });
    }
    if (obdCsvInput) {
        obdCsvInput.addEventListener('change', (e) => {
            if (!ensureObdDebugMode()) return;
            const file = e.target.files[0];
            if (!file) return;
            readObdCsvFile(file);
            obdCsvInput.value = '';
        });
    }
    if (obdDownloadButton) obdDownloadButton.addEventListener('click', downloadObdCsvBundle);
    if (obdMarkerButton) obdMarkerButton.addEventListener('click', addObdMarker);
    if (obdChartScrollInput) {
        obdChartScrollInput.addEventListener('input', () => {
            obdDebugWindowStart = Number(obdChartScrollInput.value) || 0;
            redrawObdChart();
        });
    }
    if (obdMetricSelect) {
        obdMetricSelect.addEventListener('change', () => {
            obdData.metric = obdMetricSelect.value;
            redrawObdChart();
        });
    }
    if (obdModeButtons && obdModeButtons.length) {
        obdModeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.obdMode;
                setObdMode(mode);
            });
        });
    }
    if (obdChartContainer) {
        ['dragenter', 'dragover'].forEach((evt) => {
            obdChartContainer.addEventListener(evt, (e) => {
                if (obdMode !== 'debug') return;
                if (!e.dataTransfer || !e.dataTransfer.items || e.dataTransfer.items.length === 0) return;
                e.preventDefault();
                if (obdChartDropZone) {
                    obdChartDropZone.hidden = false;
                    obdChartDropZone.style.opacity = '1';
                }
            });
        });
        ['dragleave', 'drop'].forEach((evt) => {
            obdChartContainer.addEventListener(evt, (e) => {
                if (evt === 'dragleave' && e.currentTarget.contains(e.relatedTarget)) return;
                if (obdChartDropZone) {
                    obdChartDropZone.hidden = true;
                    obdChartDropZone.style.opacity = '0';
                }
            });
        });
        obdChartContainer.addEventListener('drop', (e) => {
            if (!ensureObdDebugMode()) return;
            e.preventDefault();
            if (obdChartDropZone) {
                obdChartDropZone.hidden = true;
                obdChartDropZone.style.opacity = '0';
            }
            const file = e.dataTransfer?.files?.[0];
            if (!file) return;
            readObdCsvFile(file);
        });
    }
    window.addEventListener('resize', () => {
        drawObdMarkerOverlay();
    });

    setObdMode('live');
    setObdStatus(false);
    setObdChartControlsEnabled(false);
}
