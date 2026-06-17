// omnipanel/layout_algorithms.js

import { applyWindowTransform } from './window_manager_adapter.js';

export function getWindowMinSize(win) {
    let minW = Math.max(50, win._omnipanel_min_w || 0);
    let minH = Math.max(50, win._omnipanel_min_h || 0);

    let hints = win.get_size_hints?.();
    if (hints) {
        minW = Math.max(minW, hints.min_width || 0);
        minH = Math.max(minH, hints.min_height || 0);
    } else {
        minW = Math.max(minW, win.min_width || 0);
        minH = Math.max(minH, win.min_height || 0);
    }
    
    return { w: minW, h: minH };
}

export function getViableStackModes(windows, zRect) {
    let viable = { stack: true, grid: true, columns: true, rows: true };
    if (!zRect || windows.length === 0) return viable;

    let validWindows = windows.filter(w => w.get_workspace());
    let count = validWindows.length;
    if (count === 0) return viable;

    let maxMinW = 50;
    let maxMinH = 50;
    for (let w of validWindows) {
        let size = getWindowMinSize(w);
        if (size.w > maxMinW) maxMinW = size.w;
        if (size.h > maxMinH) maxMinH = size.h;
    }

    maxMinW -= 2;
    maxMinH -= 2;

    let gCols = Math.ceil(Math.sqrt(count));
    let gRows = Math.ceil(count / gCols);
    if (zRect.width / gCols < maxMinW || zRect.height / gRows < maxMinH) viable.grid = false;
    
    if (zRect.width / count < maxMinW) viable.columns = false;
    
    if (zRect.height / count < maxMinH) viable.rows = false;

    return viable;
}

function fitWithinZone(win, reqX, reqY, reqW, reqH, zRect) {
    let minSize = getWindowMinSize(win);
    
    let safeW = Math.max(minSize.w, reqW);
    let safeH = Math.max(minSize.h, reqH);

    let safeX = reqX;
    let safeY = reqY;
    
    if (safeX + safeW > zRect.x + zRect.width) {
        safeX = zRect.x + zRect.width - safeW;
    }
    if (safeY + safeH > zRect.y + zRect.height) {
        safeY = zRect.y + zRect.height - safeH;
    }
    
    if (safeX < zRect.x) safeX = zRect.x;
    if (safeY < zRect.y) safeY = zRect.y;
    
    return {
        x: Math.round(safeX),
        y: Math.round(safeY),
        width: Math.round(safeW),
        height: Math.round(safeH)
    };
}

export function applyStackLayout(windows, actualMonitor, zRect, mode, logger) {
    if (!zRect || windows.length === 0) return;

    let validWindows = windows.filter(w => w.get_workspace());
    let count = validWindows.length;
    if (count === 0) return;

    for (let i = 0; i < count; i++) {
        let win = validWindows[i];
        
        let rx = zRect.x;
        let ry = zRect.y;
        let rw = zRect.width;
        let rh = zRect.height;

        if (mode === 'grid') {
            let cols = Math.ceil(Math.sqrt(count));
            let rows = Math.ceil(count / cols);
            let row = Math.floor(i / cols);
            let col = i % cols;
            
            let itemsInThisRow = (row === rows - 1) ? (count - (row * cols)) : cols;
            
            let startX = zRect.x + (col / itemsInThisRow) * zRect.width;
            let endX = zRect.x + ((col + 1) / itemsInThisRow) * zRect.width;
            let startY = zRect.y + (row / rows) * zRect.height;
            let endY = zRect.y + ((row + 1) / rows) * zRect.height;
            
            rx = startX;
            ry = startY;
            rw = endX - startX;
            rh = endY - startY;

        } else if (mode === 'rows' || mode === 'horizontal') {
            let startY = zRect.y + (i / count) * zRect.height;
            let endY = zRect.y + ((i + 1) / count) * zRect.height;
            
            rx = zRect.x;
            ry = startY;
            rw = zRect.width;
            rh = endY - startY;

        } else if (mode === 'columns' || mode === 'vertical') {
            let startX = zRect.x + (i / count) * zRect.width;
            let endX = zRect.x + ((i + 1) / count) * zRect.width;
            
            rx = startX;
            ry = zRect.y;
            rw = endX - startX;
            rh = zRect.height;
            
        } else if (mode === 'stack') {
            rx = zRect.x;
            ry = zRect.y;
            rw = zRect.width;
            rh = zRect.height;
        }
        
        let finalRect = fitWithinZone(win, rx, ry, rw, rh, zRect);
        applyWindowTransform(win, actualMonitor, finalRect, false, logger, zRect);
    }
}

export function applyBSP(windows, x, y, w, h, gap, monitorIndex, logger) {
    if (windows.length === 0) return;
    
    let zRect = { x: x, y: y, width: w, height: h };

    if (windows.length === 1) {
        let reqX = x + gap;
        let reqY = y + gap;
        let reqW = w - 2 * gap;
        let reqH = h - 2 * gap;

        let rect = fitWithinZone(windows[0], reqX, reqY, reqW, reqH, zRect);
        applyWindowTransform(windows[0], monitorIndex, rect, false, logger, zRect);
        return;
    }

    let splitVertical = w > h;
    let mid = Math.ceil(windows.length / 2);

    if (splitVertical) {
        let w1 = w / 2;
        applyBSP(windows.slice(0, mid), x, y, w1, h, gap, monitorIndex, logger);
        applyBSP(windows.slice(mid), x + w1, y, w - w1, h, gap, monitorIndex, logger);
    } else {
        let h1 = h / 2;
        applyBSP(windows.slice(0, mid), x, y, w, h1, gap, monitorIndex, logger);
        applyBSP(windows.slice(mid), x, y + h1, w, h - h1, gap, monitorIndex, logger);
    }
}

export function applyCascade(windows, x, y, w, h, monitorIndex, logger) {
    let offset = 40;
    let tw = w * 0.7;
    let th = h * 0.7;
    let zRect = { x: x, y: y, width: w, height: h };
    
    for (let i = 0; i < windows.length; i++) {
        let cx = x + ((i * offset) % Math.max(1, w - tw));
        let cy = y + ((i * offset) % Math.max(1, h - th));
        
        let rect = fitWithinZone(windows[i], cx, cy, tw, th, zRect);
        applyWindowTransform(windows[i], monitorIndex, rect, false, logger, zRect);
        
        windows[i].raise();
    }
}

export function applyMasterStack(windows, x, y, w, h, gap, monitorIndex, logger) {
    if (windows.length === 0) return;
    
    let zRect = { x: x, y: y, width: w, height: h };

    if (windows.length === 1) {
        let reqX = x + gap;
        let reqY = y + gap;
        let reqW = w - 2 * gap;
        let reqH = h - 2 * gap;

        let rect = fitWithinZone(windows[0], reqX, reqY, reqW, reqH, zRect);
        applyWindowTransform(windows[0], monitorIndex, rect, false, logger, zRect);
        return;
    }

    let masterW = Math.floor((w - 3 * gap) / 2); 
    let masterReqX = x + gap;
    let masterReqY = y + gap;
    let masterReqH = h - 2 * gap;
    
    let masterRect = fitWithinZone(windows[0], masterReqX, masterReqY, masterW, masterReqH, zRect);
    applyWindowTransform(windows[0], monitorIndex, masterRect, false, logger, zRect);

    let stackX = x + 2 * gap + masterW;
    let stackW = w - 3 * gap - masterW;
    let stackCount = windows.length - 1;
    let stackH = Math.floor((h - (stackCount + 1) * gap) / stackCount);

    for (let i = 0; i < stackCount; i++) {
        let win = windows[i + 1];
        let rectY = y + gap + i * (stackH + gap);
        let currentH = (i === stackCount - 1) ? (h - gap - (rectY - y)) : stackH;
        
        let rect = fitWithinZone(win, stackX, rectY, stackW, currentH, zRect);
        applyWindowTransform(win, monitorIndex, rect, false, logger, zRect);
    }
}