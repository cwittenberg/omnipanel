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

export function applyWindowTransform(window, targetMonitorIndex, targetRect, isMaximized = false, logger = null, zoneRect = null) {
    if (!window) return;
    
    let winTitle = 'unknown';
    let winId = 'unknown';
    try { 
        winTitle = window.get_title() || 'unknown'; 
        winId = window.get_id ? window.get_id() : Math.random().toString();
    } catch {}

    if (window._omnipanel_is_dead) return;

    let safeW = Math.max(50, Math.round(targetRect.width));
    let safeH = Math.max(50, Math.round(targetRect.height));
    let safeX = Math.round(targetRect.x);
    let safeY = Math.round(targetRect.y);

    let zX = zoneRect ? Math.round(zoneRect.x) : safeX;
    let zY = zoneRect ? Math.round(zoneRect.y) : safeY;
    let zW = zoneRect ? Math.round(zoneRect.width) : safeW;
    let zH = zoneRect ? Math.round(zoneRect.height) : safeH;

    if (logger) logger(`[WindowManagerAdapter] Routing transform request on [${winTitle}] to [X:${safeX} Y:${safeY} W:${safeW} H:${safeH}]`);

    let task = {
        id: winId,
        window: window,
        x: safeX, y: safeY, w: safeW, h: safeH,
        zoneX: zX, zoneY: zY, zoneW: zW, zoneH: zH,
        isMax: isMaximized,
        title: winTitle,
        logger: logger
    };

    getAdapter().queueTransform(task);
}