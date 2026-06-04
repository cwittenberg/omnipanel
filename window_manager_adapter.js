// omnipanel/window_manager_adapter.js
import Meta from 'gi://Meta';
import { WaylandTransformStrategy } from './transform_wayland.js';
import { X11TransformStrategy } from './transform_x11.js';

class WindowManagerAdapter {
    constructor() {
        this.isWayland = Meta.is_wayland_compositor();
        this.strategy = this.isWayland ? new WaylandTransformStrategy() : new X11TransformStrategy();
    }

    clearPendingTransforms() {
        this.strategy.clear();
    }

    queueTransform(task) {
        this.strategy.applyTransform(task);
    }
}

let _windowAdapter = null;

function getAdapter() {
    if (!_windowAdapter) {
        _windowAdapter = new WindowManagerAdapter();
    }
    return _windowAdapter;
}

export function clearPendingTransforms() {
    if (_windowAdapter) {
        _windowAdapter.clearPendingTransforms();
        _windowAdapter = null;
    }
}

export function applyWindowTransform(window, targetMonitorIndex, targetRect, isMaximized = false, logger = null) {
    if (!window) return;
    
    let winTitle = 'unknown';
    let winId = 'unknown';
    try { 
        winTitle = window.get_title() || 'unknown'; 
        winId = window.get_id ? window.get_id() : Math.random().toString();
    } catch {}

    if (window._omnipanel_is_dead) return;

    let targetX = Number.isFinite(Number(targetRect.x)) ? targetRect.x : 0;
    let targetY = Number.isFinite(Number(targetRect.y)) ? targetRect.y : 0;
    let targetW = Number.isFinite(Number(targetRect.width)) ? targetRect.width : 400;
    let targetH = Number.isFinite(Number(targetRect.height)) ? targetRect.height : 300;

    let minW = 50, minH = 50;
    try {
        if (typeof window.get_min_size === 'function') {
            let minSize = window.get_min_size();
            if (Array.isArray(minSize) && minSize.length >= 2) {
                if (minSize[0] > 0) minW = Math.max(minW, minSize[0]);
                if (minSize[1] > 0) minH = Math.max(minH, minSize[1]);
            }
        }
    } catch {}

    let safeW = Math.max(minW, Math.round(targetW));
    let safeH = Math.max(minH, Math.round(targetH));
    let safeX = Math.round(targetX);
    let safeY = Math.round(targetY);

    if (logger) logger(`[WindowManagerAdapter] Routing transform request on [${winTitle}]`);

    let task = {
        id: winId,
        window: window,
        x: safeX, y: safeY, w: safeW, h: safeH,
        isMax: isMaximized,
        title: winTitle,
        logger: logger
    };

    getAdapter().queueTransform(task);
}