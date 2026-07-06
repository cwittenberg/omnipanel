// omnipanel/window_manager_adapter.js

import { WaylandTransformStrategy } from './transform_wayland.js';

class WindowManagerAdapter {
    constructor() {
        this.strategy = new WaylandTransformStrategy();
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
    
    let winTitle = window.get_title() || 'unknown'; 
    let winId = window.get_id();

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