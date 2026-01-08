import { pad2, formatLocalTimestamp } from '../../lib/time.js';

const osmoConnectButton = document.getElementById('osmoConnectButton');
const osmoStatusEl = document.getElementById('osmoStatus');
const osmoStatusLed = document.getElementById('osmoStatusLed');
const osmoBatteryBadge = document.getElementById('osmoBatteryBadge');
const osmoRowEl = document.getElementById('rowOsmo360');
const osmoElapsedTimeEl = document.getElementById('osmoElapsedTime');
const osmoElapsedLabelEl = document.getElementById('osmoElapsedLabel');
const osmoConnectionTimeEl = document.getElementById('osmoConnectionTime');
const osmoFrontVideo = document.getElementById('osmoFrontVideo');
const osmoRearVideo = document.getElementById('osmoRearVideo');
const osmoFrontFrame = document.getElementById('osmoFrontFrame');
const osmoRearFrame = document.getElementById('osmoRearFrame');
const osmoFrontDropZone = document.getElementById('osmoFrontDropZone');
const osmoRearDropZone = document.getElementById('osmoRearDropZone');
const osmoSeekBackButton = document.getElementById('osmoSeekBack');
const osmoPlayToggleButton = document.getElementById('osmoPlayToggle');
const osmoSeekForwardButton = document.getElementById('osmoSeekForward');
const osmoModeButtons = document.querySelectorAll('.mode-btn-osmo');
const osmoMetaFpsEl = document.getElementById('osmoMetaFps');
const osmoMetaFovEl = document.getElementById('osmoMetaFov');
const osmoMetaCorrectionEl = document.getElementById('osmoMetaCorrection');

let osmoMode = 'live';
let osmoConnected = false;
let osmoConnectionStartTime = null;
let osmoConnectionTimerId = null;
let osmoSyncing = false;
let osmoFrontUrl = null;
let osmoRearUrl = null;
let osmoFrontDuration = null;
let osmoRearDuration = null;
let osmoFrontHasCustomSource = false;
let osmoRearHasCustomSource = false;
const osmoFrontSourceEl = osmoFrontVideo?.querySelector('source') || null;
const osmoRearSourceEl = osmoRearVideo?.querySelector('source') || null;
const osmoFrontDefaultSrc = osmoFrontSourceEl?.getAttribute('src') || '';
const osmoRearDefaultSrc = osmoRearSourceEl?.getAttribute('src') || '';
const OSMO_META_VALUES = {
    fps: '60',
    fov: '95',
    correction: '0.35'
};
const OSMO_META_PLACEHOLDERS = {
    fps: '--',
    fov: '--',
    correction: '---'
};

function formatOsmoDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '--';
    const totalSeconds = Math.floor(seconds);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function getOsmoDebugDuration() {
    const values = [osmoFrontDuration, osmoRearDuration].filter((v) => Number.isFinite(v));
    if (!values.length) return null;
    return Math.max(...values);
}

function updateOsmoDebugElapsed() {
    if (osmoMode !== 'debug' || !osmoElapsedTimeEl) return;
    const duration = getOsmoDebugDuration();
    osmoElapsedTimeEl.textContent = duration != null ? formatOsmoDuration(duration) : '00:00:00';
}

function updateOsmoMetadata(active) {
    if (!osmoMetaFpsEl || !osmoMetaFovEl || !osmoMetaCorrectionEl) return;
    const values = active ? OSMO_META_VALUES : OSMO_META_PLACEHOLDERS;
    osmoMetaFpsEl.textContent = values.fps;
    osmoMetaFovEl.textContent = values.fov;
    osmoMetaCorrectionEl.textContent = values.correction;
}

function updateOsmoDurations() {
    const frontDuration = osmoFrontVideo?.duration;
    const rearDuration = osmoRearVideo?.duration;
    osmoFrontDuration = Number.isFinite(frontDuration) ? frontDuration : null;
    osmoRearDuration = Number.isFinite(rearDuration) ? rearDuration : null;
    updateOsmoDebugElapsed();
}

function updateOsmoElapsedTime() {
    if (osmoMode !== 'live') return;
    if (!osmoConnectionStartTime || !osmoElapsedTimeEl) return;
    const now = new Date();
    const diffMs = now - osmoConnectionStartTime;
    const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    osmoElapsedTimeEl.textContent = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function setOsmoStatus(connected) {
    osmoConnected = connected;
    if (osmoMode === 'debug') {
        if (osmoStatusLed) osmoStatusLed.classList.remove('connected');
        if (osmoStatusEl) osmoStatusEl.textContent = 'Modalità debug';
    } else {
        if (osmoStatusLed) osmoStatusLed.classList.toggle('connected', connected);
        if (osmoStatusEl) osmoStatusEl.textContent = connected ? 'Connesso' : 'Non connesso';
    }
    if (osmoConnectButton) {
        osmoConnectButton.textContent = connected ? 'Disconnetti' : 'Connetti';
        osmoConnectButton.classList.toggle('disconnect', connected);
    }
}

function updateOsmoBattery(level) {
    if (!osmoBatteryBadge) return;
    osmoBatteryBadge.textContent = (level != null && !Number.isNaN(level)) ? `${level}%` : '--%';
}

function setOsmoConnectEnabled(enabled) {
    if (!osmoConnectButton) return;
    osmoConnectButton.disabled = !enabled;
    osmoConnectButton.classList.toggle('disabled', !enabled);
    osmoConnectButton.setAttribute('aria-disabled', (!enabled).toString());
}

function setOsmoControlsEnabled(enabled) {
    const buttons = [osmoSeekBackButton, osmoPlayToggleButton, osmoSeekForwardButton];
    buttons.forEach((btn) => {
        if (!btn) return;
        btn.disabled = !enabled;
        btn.classList.toggle('disabled', !enabled);
        btn.setAttribute('aria-disabled', (!enabled).toString());
    });
    if (!enabled && osmoPlayToggleButton) {
        osmoPlayToggleButton.classList.remove('is-playing');
    }
}

function setOsmoVideoVisibility() {
    const showLive = osmoMode === 'live' && osmoConnected;
    const showDebugFront = osmoMode === 'debug' && osmoFrontHasCustomSource;
    const showDebugRear = osmoMode === 'debug' && osmoRearHasCustomSource;
    if (osmoFrontVideo) {
        const shouldShow = showLive || showDebugFront;
        osmoFrontVideo.classList.toggle('is-hidden', !shouldShow);
    }
    if (osmoRearVideo) {
        const shouldShow = showLive || showDebugRear;
        osmoRearVideo.classList.toggle('is-hidden', !shouldShow);
    }
    if (osmoFrontFrame) {
        const hasVideo = showLive || showDebugFront;
        osmoFrontFrame.classList.toggle('has-video', hasVideo);
    }
    if (osmoRearFrame) {
        const hasVideo = showLive || showDebugRear;
        osmoRearFrame.classList.toggle('has-video', hasVideo);
    }
    const controlsEnabled = (osmoMode === 'live' && osmoConnected) || (osmoMode === 'debug' && (osmoFrontHasCustomSource || osmoRearHasCustomSource));
    setOsmoControlsEnabled(controlsEnabled);
    updateOsmoMetadata(showLive || showDebugFront || showDebugRear);
}

function playVideo(videoEl) {
    if (!videoEl) return;
    const hasSrc = Boolean(videoEl.currentSrc || videoEl.src);
    if (!hasSrc) return;
    const playPromise = videoEl.play();
    if (playPromise?.catch) {
        playPromise.catch(() => {});
    }
}

function pauseVideo(videoEl) {
    if (!videoEl) return;
    videoEl.pause();
}

function connectOsmo() {
    if (osmoMode !== 'live') return;
    if (osmoConnected) {
        const confirmed = window.confirm('Disconnettendo il sensore i dati rimarranno visibili ma non saranno più in tempo reale');
        if (!confirmed) return;
        disconnectOsmo();
        return;
    }
    setOsmoStatus(true);
    osmoConnectionStartTime = new Date();
    if (osmoConnectionTimeEl) {
        osmoConnectionTimeEl.textContent = `Dal: ${formatLocalTimestamp(osmoConnectionStartTime)}`;
    }
    if (osmoConnectionTimerId) clearInterval(osmoConnectionTimerId);
    osmoConnectionTimerId = setInterval(updateOsmoElapsedTime, 1000);
    updateOsmoElapsedTime();
    setOsmoVideoVisibility();
    playVideo(osmoFrontVideo);
    playVideo(osmoRearVideo);
    updateOsmoBattery(Math.round(65 + Math.random() * 30));
}

function disconnectOsmo() {
    pauseVideo(osmoFrontVideo);
    pauseVideo(osmoRearVideo);
    setOsmoStatus(false);
    updateOsmoBattery(null);
    setOsmoVideoVisibility();
    if (osmoConnectionTimerId) clearInterval(osmoConnectionTimerId);
    osmoConnectionTimerId = null;
    osmoConnectionStartTime = null;
    if (osmoElapsedTimeEl) osmoElapsedTimeEl.textContent = '00:00:00';
    if (osmoConnectionTimeEl) osmoConnectionTimeEl.textContent = '';
}

function syncVideoState(source, target, action) {
    if (!source || !target || osmoSyncing) return;
    osmoSyncing = true;
    try {
        if (action === 'play') {
            const delta = Math.abs((source.currentTime || 0) - (target.currentTime || 0));
            if (delta > 0.15) {
                target.currentTime = source.currentTime;
            }
            playVideo(target);
        } else if (action === 'pause') {
            pauseVideo(target);
        } else if (action === 'seek') {
            target.currentTime = source.currentTime || 0;
        } else if (action === 'rate') {
            target.playbackRate = source.playbackRate || 1;
        } else if (action === 'ended') {
            pauseVideo(target);
        }
    } finally {
        setTimeout(() => {
            osmoSyncing = false;
        }, 0);
    }
}

function wireVideoSync(source, target) {
    if (!source || !target) return;
    source.addEventListener('play', () => syncVideoState(source, target, 'play'));
    source.addEventListener('pause', () => syncVideoState(source, target, 'pause'));
    source.addEventListener('seeking', () => syncVideoState(source, target, 'seek'));
    source.addEventListener('ratechange', () => syncVideoState(source, target, 'rate'));
    source.addEventListener('ended', () => syncVideoState(source, target, 'ended'));
}

function setVideoSource(videoEl, file, side) {
    if (!videoEl || !file) return;
    const url = URL.createObjectURL(file);
    if (side === 'front' && osmoFrontUrl) URL.revokeObjectURL(osmoFrontUrl);
    if (side === 'rear' && osmoRearUrl) URL.revokeObjectURL(osmoRearUrl);
    if (side === 'front') osmoFrontUrl = url;
    if (side === 'rear') osmoRearUrl = url;
    if (side === 'front' && osmoFrontSourceEl) osmoFrontSourceEl.setAttribute('src', '');
    if (side === 'rear' && osmoRearSourceEl) osmoRearSourceEl.setAttribute('src', '');
    videoEl.src = url;
    videoEl.load();
    if (side === 'front') osmoFrontHasCustomSource = true;
    if (side === 'rear') osmoRearHasCustomSource = true;
    setOsmoVideoVisibility();
}

function handleVideoDrop(file, side) {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
        alert('Formato non supportato. Inserisci un file video.');
        return;
    }
    const videoEl = side === 'front' ? osmoFrontVideo : osmoRearVideo;
    setVideoSource(videoEl, file, side);
}

function setupOsmoDropZone(frameEl, dropZoneEl, side) {
    if (!frameEl) return;
    ['dragenter', 'dragover'].forEach((evt) => {
        frameEl.addEventListener(evt, (e) => {
            if (osmoMode !== 'debug') return;
            if (!e.dataTransfer || !e.dataTransfer.items || e.dataTransfer.items.length === 0) return;
            e.preventDefault();
            if (dropZoneEl) {
                dropZoneEl.hidden = false;
                dropZoneEl.style.opacity = '1';
            }
        });
    });
    ['dragleave', 'drop'].forEach((evt) => {
        frameEl.addEventListener(evt, (e) => {
            if (evt === 'dragleave' && e.currentTarget.contains(e.relatedTarget)) return;
            if (dropZoneEl) {
                dropZoneEl.hidden = true;
                dropZoneEl.style.opacity = '0';
            }
        });
    });
    frameEl.addEventListener('drop', (e) => {
        if (osmoMode !== 'debug') return;
        e.preventDefault();
        if (dropZoneEl) {
            dropZoneEl.hidden = true;
            dropZoneEl.style.opacity = '0';
        }
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        handleVideoDrop(file, side);
    });
}

function updateOsmoPlayToggleState() {
    if (!osmoPlayToggleButton) return;
    if (osmoMode === 'live') {
        osmoPlayToggleButton.classList.remove('is-playing');
        return;
    }
    const isPlaying = [osmoFrontVideo, osmoRearVideo].some((video) => video && !video.paused && !video.ended);
    osmoPlayToggleButton.classList.toggle('is-playing', isPlaying);
}

function getPrimaryVideo() {
    if (osmoFrontVideo && (osmoFrontVideo.currentSrc || osmoFrontVideo.src)) return osmoFrontVideo;
    if (osmoRearVideo && (osmoRearVideo.currentSrc || osmoRearVideo.src)) return osmoRearVideo;
    return osmoFrontVideo || osmoRearVideo;
}

function seekBoth(deltaSeconds) {
    const primary = getPrimaryVideo();
    if (!primary) return;
    const targetTime = Math.max(0, (primary.currentTime || 0) + deltaSeconds);
    if (osmoFrontVideo) {
        const maxTime = Number.isFinite(osmoFrontVideo.duration) ? osmoFrontVideo.duration : targetTime;
        osmoFrontVideo.currentTime = Math.min(targetTime, maxTime);
    }
    if (osmoRearVideo) {
        const maxTime = Number.isFinite(osmoRearVideo.duration) ? osmoRearVideo.duration : targetTime;
        osmoRearVideo.currentTime = Math.min(targetTime, maxTime);
    }
}

function handleOsmoPrimaryAction() {
    if (osmoMode === 'live') {
        if (!osmoConnected) return;
        const confirmed = window.confirm('Disconnettendo il sensore i dati rimarranno visibili ma non saranno più in tempo reale');
        if (!confirmed) return;
        disconnectOsmo();
        return;
    }
    const primary = getPrimaryVideo();
    if (!primary) return;
    if (primary.paused || primary.ended) {
        playVideo(primary);
        playVideo(primary === osmoFrontVideo ? osmoRearVideo : osmoFrontVideo);
    } else {
        pauseVideo(osmoFrontVideo);
        pauseVideo(osmoRearVideo);
    }
    updateOsmoPlayToggleState();
}

function resetOsmoVideoSourcesForLive() {
    if (osmoFrontVideo && osmoFrontDefaultSrc) {
        if (osmoFrontSourceEl) osmoFrontSourceEl.setAttribute('src', osmoFrontDefaultSrc);
        osmoFrontVideo.removeAttribute('src');
        osmoFrontVideo.load();
        osmoFrontHasCustomSource = false;
    }
    if (osmoRearVideo && osmoRearDefaultSrc) {
        if (osmoRearSourceEl) osmoRearSourceEl.setAttribute('src', osmoRearDefaultSrc);
        osmoRearVideo.removeAttribute('src');
        osmoRearVideo.load();
        osmoRearHasCustomSource = false;
    }
    if (osmoFrontUrl) {
        URL.revokeObjectURL(osmoFrontUrl);
        osmoFrontUrl = null;
    }
    if (osmoRearUrl) {
        URL.revokeObjectURL(osmoRearUrl);
        osmoRearUrl = null;
    }
    updateOsmoDurations();
    setOsmoVideoVisibility();
}

function clearOsmoVideoSourcesForDebug() {
    if (osmoFrontSourceEl) osmoFrontSourceEl.setAttribute('src', '');
    if (osmoRearSourceEl) osmoRearSourceEl.setAttribute('src', '');
    if (osmoFrontVideo) {
        osmoFrontVideo.removeAttribute('src');
        osmoFrontVideo.load();
    }
    if (osmoRearVideo) {
        osmoRearVideo.removeAttribute('src');
        osmoRearVideo.load();
    }
    osmoFrontHasCustomSource = false;
    osmoRearHasCustomSource = false;
    osmoFrontDuration = null;
    osmoRearDuration = null;
    updateOsmoDebugElapsed();
    setOsmoVideoVisibility();
}

function setOsmoMode(mode) {
    if (mode === osmoMode) return;
    if (osmoMode === 'live' && mode === 'debug') {
        const confirmed = window.confirm('Passando alla modalità debug tutti i dati della sessione live verranno cancellati');
        if (!confirmed) return;
        disconnectOsmo();
    } else if (osmoMode === 'debug' && mode === 'live') {
        const confirmed = window.confirm('Passando alla modalità live tutti i video caricati verranno rimossi');
        if (!confirmed) return;
    }
    osmoMode = mode;
    osmoModeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.osmoMode === mode));
    if (osmoRowEl) {
        osmoRowEl.classList.toggle('osmo-mode-live', mode === 'live');
        osmoRowEl.classList.toggle('osmo-mode-debug', mode === 'debug');
    }
    if (osmoElapsedLabelEl) osmoElapsedLabelEl.textContent = mode === 'debug' ? 'Durata totale' : 'Tempo trascorso';
    if (osmoMode === 'debug') {
        if (osmoConnectionTimeEl) osmoConnectionTimeEl.textContent = 'Da file video';
        updateOsmoBattery(null);
        updateOsmoDebugElapsed();
        clearOsmoVideoSourcesForDebug();
    } else {
        if (osmoConnectionTimeEl) osmoConnectionTimeEl.textContent = '';
        if (osmoElapsedTimeEl) osmoElapsedTimeEl.textContent = '00:00:00';
        resetOsmoVideoSourcesForLive();
    }
    setOsmoStatus(osmoConnected);
    setOsmoConnectEnabled(mode === 'live');
    setOsmoVideoVisibility();
    if (osmoPlayToggleButton) {
        osmoPlayToggleButton.setAttribute('aria-label', mode === 'live' ? 'Stop' : 'Play/Pausa');
    }
}

export function initOsmo360Module() {
    if (osmoConnectButton) osmoConnectButton.addEventListener('click', connectOsmo);
    if (osmoFrontVideo) {
        osmoFrontVideo.addEventListener('loadedmetadata', updateOsmoDurations);
        osmoFrontVideo.addEventListener('durationchange', updateOsmoDurations);
        osmoFrontVideo.addEventListener('play', updateOsmoPlayToggleState);
        osmoFrontVideo.addEventListener('pause', updateOsmoPlayToggleState);
        osmoFrontVideo.addEventListener('ended', updateOsmoPlayToggleState);
    }
    if (osmoRearVideo) {
        osmoRearVideo.addEventListener('loadedmetadata', updateOsmoDurations);
        osmoRearVideo.addEventListener('durationchange', updateOsmoDurations);
        osmoRearVideo.addEventListener('play', updateOsmoPlayToggleState);
        osmoRearVideo.addEventListener('pause', updateOsmoPlayToggleState);
        osmoRearVideo.addEventListener('ended', updateOsmoPlayToggleState);
    }
    wireVideoSync(osmoFrontVideo, osmoRearVideo);
    wireVideoSync(osmoRearVideo, osmoFrontVideo);
    setupOsmoDropZone(osmoFrontFrame, osmoFrontDropZone, 'front');
    setupOsmoDropZone(osmoRearFrame, osmoRearDropZone, 'rear');
    if (osmoPlayToggleButton) osmoPlayToggleButton.addEventListener('click', handleOsmoPrimaryAction);
    if (osmoSeekBackButton) osmoSeekBackButton.addEventListener('click', () => seekBoth(-5));
    if (osmoSeekForwardButton) osmoSeekForwardButton.addEventListener('click', () => seekBoth(5));
    if (osmoModeButtons && osmoModeButtons.length) {
        osmoModeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.osmoMode;
                setOsmoMode(mode);
            });
        });
    }
    if (osmoFrontVideo) osmoFrontVideo.controls = false;
    if (osmoRearVideo) osmoRearVideo.controls = false;
    updateOsmoDurations();
    updateOsmoBattery(null);
    setOsmoConnectEnabled(true);
    setOsmoStatus(false);
    setOsmoVideoVisibility();
    updateOsmoMetadata(false);
    if (osmoRowEl) {
        osmoRowEl.classList.add('osmo-mode-live');
        osmoRowEl.classList.remove('osmo-mode-debug');
    }
    if (osmoPlayToggleButton) {
        osmoPlayToggleButton.setAttribute('aria-label', 'Stop');
    }
}
