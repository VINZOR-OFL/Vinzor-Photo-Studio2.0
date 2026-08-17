/**
 * Vinzor Photo Studio Pro — Core Graphics, Layer & Canvas Engine
 * Corrected & Fully Wired Architecture
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. GLOBAL STATE & CONFIGURATION
  // =========================================================================

  const state = {
    docWidth: 1280,
    docHeight: 720,
    docName: 'Vinzor Artwork',
    zoom: 1.0,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    spacePressed: false,

    activeTool: 'move', // move, marquee, crop, brush, eraser, bucket, shape, text, eyedropper, inpaint
    primaryColor: '#3b82f6',
    secondaryColor: '#ffffff',

    brushSize: 20,
    brushOpacity: 1.0,
    brushHardness: 0.8,

    eraserSize: 30,
    eraserOpacity: 1.0,

    shapeType: 'rectangle',
    shapeStroke: 2,
    shapeFill: true,

    fontFamily: 'Inter, sans-serif',
    fontSize: 48,
    fontBold: false,
    fontItalic: false,

    autoSelectLayer: true,
    showTransformBox: true,

    selection: null, // { x, y, w, h }
    cropBox: null,

    isDrawing: false,
    hasMovedDuringDrag: false,
    lastX: 0,
    lastY: 0,
    startX: 0,
    startY: 0,

    inpaintPoints: [],
    transformStart: null,
  };

  // DOM Elements
  const viewportContainer = document.getElementById('viewport-container');
  const panZoomLayer = document.getElementById('pan-zoom-layer');
  const canvasStage = document.getElementById('canvas-stage');
  const mainCanvas = document.getElementById('main-canvas');
  const mainCtx = mainCanvas.getContext('2d', { willReadFrequently: true });
  const overlayCanvas = document.getElementById('overlay-canvas');
  const overlayCtx = overlayCanvas.getContext('2d');

  // =========================================================================
  // 2. LAYER CLASS
  // =========================================================================

  class Layer {
    constructor(name, width, height, type = 'raster') {
      this.id = 'layer_' + Math.random().toString(36).substr(2, 9);
      this.name = name || 'Layer';
      this.type = type; // 'raster', 'text', 'shape'
      this.visible = true;
      this.locked = false;
      this.opacity = 1.0;
      this.blendMode = 'source-over';

      this.x = 0;
      this.y = 0;
      this.width = width;
      this.height = height;

      this.canvas = document.createElement('canvas');
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

      this.textData = {
        text: 'Vinzor Photo Studio',
        fontFamily: 'Inter, sans-serif',
        fontSize: 48,
        color: '#ffffff',
        bold: false,
        italic: false,
      };

      this.shapeData = null;
    }

    renderTo(targetCtx) {
      if (!this.visible || this.opacity <= 0) return;

      targetCtx.save();
      targetCtx.globalAlpha = this.opacity;
      targetCtx.globalCompositeOperation = this.blendMode;

      if (this.type === 'raster') {
        targetCtx.drawImage(this.canvas, this.x, this.y);
      } else if (this.type === 'text') {
        this.renderText(targetCtx);
      } else if (this.type === 'shape') {
        this.renderShape(targetCtx);
      }

      targetCtx.restore();
    }

    renderText(targetCtx) {
      const ctx = targetCtx || this.ctx;
      ctx.save();
      ctx.fillStyle = this.textData.color;
      let fontStyle = '';
      if (this.textData.italic) fontStyle += 'italic ';
      if (this.textData.bold) fontStyle += 'bold ';
      ctx.font = `${fontStyle}${this.textData.fontSize}px ${this.textData.fontFamily}`;
      ctx.textBaseline = 'top';

      const lines = (this.textData.text || '').split('\n');
      const lineHeight = this.textData.fontSize * 1.2;
      lines.forEach((line, index) => {
        ctx.fillText(line, this.x, this.y + index * lineHeight);
      });
      ctx.restore();
    }

    renderShape(targetCtx) {
      if (!this.shapeData) return;
      const ctx = targetCtx || this.ctx;
      const s = this.shapeData;
      ctx.save();
      ctx.fillStyle = s.fillColor;
      ctx.strokeStyle = s.strokeColor;
      ctx.lineWidth = s.strokeWidth;

      ctx.beginPath();
      if (s.type === 'rectangle') {
        ctx.rect(this.x, this.y, this.width, this.height);
      } else if (s.type === 'rounded-rect') {
        const r = Math.min(20, this.width / 4, this.height / 4);
        if (ctx.roundRect) {
          ctx.roundRect(this.x, this.y, this.width, this.height, r);
        } else {
          ctx.rect(this.x, this.y, this.width, this.height);
        }
      } else if (s.type === 'circle') {
        ctx.ellipse(
          this.x + this.width / 2,
          this.y + this.height / 2,
          Math.abs(this.width / 2),
          Math.abs(this.height / 2),
          0,
          0,
          Math.PI * 2
        );
      } else if (s.type === 'star') {
        drawStar(ctx, this.x + this.width / 2, this.y + this.height / 2, 5, this.width / 2, this.width / 4);
      } else if (s.type === 'line') {
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height);
      }

      if (s.fill && s.type !== 'line') ctx.fill();
      if (s.strokeWidth > 0) ctx.stroke();
      ctx.restore();
    }

    clone() {
      const cloned = new Layer(this.name + ' Copy', this.width, this.height, this.type);
      cloned.x = this.x;
      cloned.y = this.y;
      cloned.visible = this.visible;
      cloned.locked = this.locked;
      cloned.opacity = this.opacity;
      cloned.blendMode = this.blendMode;
      cloned.textData = { ...this.textData };
      if (this.shapeData) cloned.shapeData = { ...this.shapeData };
      cloned.ctx.drawImage(this.canvas, 0, 0);
      return cloned;
    }
  }

  function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  }

  // =========================================================================
  // 3. LAYER MANAGER
  // =========================================================================

  class LayerManager {
    constructor() {
      this.layers = [];
      this.activeLayerId = null;
    }

    addLayer(layer, insertIndex = -1) {
      if (insertIndex >= 0 && insertIndex <= this.layers.length) {
        this.layers.splice(insertIndex, 0, layer);
      } else {
        this.layers.push(layer);
      }
      this.setActiveLayer(layer.id);
      this.render();
      this.updateUI();
      return layer;
    }

    getActiveLayer() {
      if (!this.activeLayerId) return null;
      return this.layers.find((l) => l.id === this.activeLayerId) || null;
    }

    setActiveLayer(id) {
      this.activeLayerId = id;
      this.syncToolOptionsWithActiveLayer();
      this.updateUI();
      renderOverlay();
    }

    deselectActiveLayer() {
      this.activeLayerId = null;
      state.selection = null;
      this.updateUI();
      renderOverlay();
      showToast('Deselected active layer & selection.');
    }

    syncToolOptionsWithActiveLayer() {
      const active = this.getActiveLayer();
      if (!active) return;

      if (active.type === 'text') {
        const txtInput = document.getElementById('opt-text-live-input');
        if (txtInput) txtInput.value = active.textData.text || '';
        document.getElementById('opt-font-family').value = active.textData.fontFamily || 'Inter, sans-serif';
        document.getElementById('opt-font-size').value = active.textData.fontSize || 48;
        document.getElementById('opt-font-bold').classList.toggle('active', !!active.textData.bold);
        document.getElementById('opt-font-italic').classList.toggle('active', !!active.textData.italic);
      }
    }

    removeLayer(id) {
      if (this.layers.length <= 1) {
        showToast('Cannot delete the only layer.');
        return;
      }
      const index = this.layers.findIndex((l) => l.id === id);
      if (index !== -1) {
        this.layers.splice(index, 1);
        const newActive = this.layers[Math.max(0, index - 1)];
        this.activeLayerId = newActive ? newActive.id : null;
        historyManager.pushState('Delete Layer');
        this.render();
        this.updateUI();
      }
    }

    duplicateLayer(id) {
      const target = this.layers.find((l) => l.id === id);
      if (target) {
        const index = this.layers.indexOf(target);
        const cloned = target.clone();
        this.addLayer(cloned, index + 1);
        historyManager.pushState('Duplicate Layer');
      }
    }

    moveLayer(id, direction) {
      const index = this.layers.findIndex((l) => l.id === id);
      if (index === -1) return;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= this.layers.length) return;

      const temp = this.layers[index];
      this.layers[index] = this.layers[targetIndex];
      this.layers[targetIndex] = temp;
      this.render();
      this.updateUI();
      historyManager.pushState('Reorder Layers');
    }

    mergeDown(id) {
      const index = this.layers.findIndex((l) => l.id === id);
      if (index <= 0) {
        showToast('No layer beneath to merge into.');
        return;
      }
      const topLayer = this.layers[index];
      const bottomLayer = this.layers[index - 1];

      bottomLayer.ctx.save();
      bottomLayer.ctx.globalAlpha = topLayer.opacity;
      bottomLayer.ctx.globalCompositeOperation = topLayer.blendMode;
      if (topLayer.type === 'raster') {
        bottomLayer.ctx.drawImage(topLayer.canvas, topLayer.x - bottomLayer.x, topLayer.y - bottomLayer.y);
      } else {
        topLayer.renderTo(bottomLayer.ctx);
      }
      bottomLayer.ctx.restore();

      this.layers.splice(index, 1);
      this.activeLayerId = bottomLayer.id;
      historyManager.pushState('Merge Down');
      this.render();
      this.updateUI();
    }

    flatten() {
      if (this.layers.length <= 1) return;
      const flattened = new Layer('Background', state.docWidth, state.docHeight, 'raster');
      this.layers.forEach((l) => l.renderTo(flattened.ctx));
      this.layers = [flattened];
      this.activeLayerId = flattened.id;
      historyManager.pushState('Flatten Image');
      this.render();
      this.updateUI();
    }

    render() {
      mainCtx.clearRect(0, 0, state.docWidth, state.docHeight);
      for (const layer of this.layers) {
        layer.renderTo(mainCtx);
      }
      renderOverlay();
    }

    updateUI() {
      const listEl = document.getElementById('layers-list');
      listEl.innerHTML = '';

      const reversedLayers = [...this.layers].reverse();

      reversedLayers.forEach((layer) => {
        const item = document.createElement('div');
        item.className = `layer-item ${layer.id === this.activeLayerId ? 'active' : ''}`;
        item.onclick = (e) => {
          if (!e.target.closest('.layer-vis-btn') && !e.target.closest('.layer-lock-btn')) {
            layerManager.setActiveLayer(layer.id);
          }
        };

        const thumb = document.createElement('canvas');
        thumb.className = 'layer-thumb';
        thumb.width = 32;
        thumb.height = 32;
        const tCtx = thumb.getContext('2d');
        if (layer.type === 'raster') {
          tCtx.drawImage(layer.canvas, 0, 0, 32, 32);
        } else {
          tCtx.fillStyle = '#222';
          tCtx.fillRect(0, 0, 32, 32);
          tCtx.fillStyle = '#3b82f6';
          tCtx.font = '16px sans-serif';
          tCtx.textAlign = 'center';
          tCtx.textBaseline = 'middle';
          tCtx.fillText(layer.type === 'text' ? 'T' : '◆', 16, 16);
        }

        const info = document.createElement('div');
        info.className = 'layer-info';
        info.innerHTML = `
          <div class="layer-title" title="Double click to rename or edit text">${layer.name}</div>
          <div class="layer-sub">${layer.type.toUpperCase()} • ${Math.round(layer.opacity * 100)}%</div>
        `;

        const titleEl = info.querySelector('.layer-title');
        titleEl.ondblclick = () => {
          if (layer.type === 'text') {
            const newTxt = prompt('Edit Text Content:', layer.textData.text);
            if (newTxt !== null) {
              layer.textData.text = newTxt;
              layer.name = newTxt.slice(0, 20) || 'Text Layer';
              layerManager.render();
              layerManager.updateUI();
              historyManager.pushState('Edit Text Content');
            }
          } else {
            titleEl.contentEditable = 'true';
            titleEl.focus();
          }
        };
        titleEl.onblur = () => {
          titleEl.contentEditable = 'false';
          layer.name = titleEl.innerText.trim() || layer.name;
          historyManager.pushState('Rename Layer');
        };
        titleEl.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            titleEl.blur();
          }
        };

        const visBtn = document.createElement('button');
        visBtn.className = `layer-vis-btn ${layer.visible ? 'visible' : ''}`;
        visBtn.innerHTML = layer.visible
          ? '<i data-lucide="eye"></i>'
          : '<i data-lucide="eye-off"></i>';
        visBtn.onclick = (e) => {
          e.stopPropagation();
          layer.visible = !layer.visible;
          layerManager.render();
          layerManager.updateUI();
          historyManager.pushState('Toggle Visibility');
        };

        item.appendChild(visBtn);
        item.appendChild(thumb);
        item.appendChild(info);
        listEl.appendChild(item);
      });

      const active = this.getActiveLayer();
      if (active) {
        document.getElementById('layer-blend-mode').value = active.blendMode;
        document.getElementById('layer-opacity').value = Math.round(active.opacity * 100);
        document.getElementById('val-layer-opacity').innerText = Math.round(active.opacity * 100) + '%';
      }

      document.getElementById('status-layer-count').innerText = `${this.layers.length} Layer${
        this.layers.length > 1 ? 's' : ''
      }`;

      if (window.lucide) {
        lucide.createIcons();
      }
    }
  }

  const layerManager = new LayerManager();

  // =========================================================================
  // 4. HISTORY MANAGER
  // =========================================================================

  class HistoryManager {
    constructor() {
      this.undoStack = [];
      this.redoStack = [];
      this.maxStates = 30;
      this.isRestoring = false;
    }

    captureSnapshot(actionName) {
      const layerSnapshots = layerManager.layers.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
        blendMode: l.blendMode,
        x: l.x,
        y: l.y,
        width: l.width,
        height: l.height,
        textData: { ...l.textData },
        shapeData: l.shapeData ? { ...l.shapeData } : null,
        dataUrl: l.type === 'raster' ? l.canvas.toDataURL() : null,
      }));

      return {
        actionName: actionName || 'Edit',
        docWidth: state.docWidth,
        docHeight: state.docHeight,
        activeLayerId: layerManager.activeLayerId,
        layers: layerSnapshots,
      };
    }

    pushState(actionName) {
      if (this.isRestoring) return;
      const snapshot = this.captureSnapshot(actionName);
      this.undoStack.push(snapshot);
      if (this.undoStack.length > this.maxStates) {
        this.undoStack.shift();
      }
      this.redoStack = [];
      this.updateUI();
    }

    restoreState(snapshot) {
      this.isRestoring = true;
      state.docWidth = snapshot.docWidth;
      state.docHeight = snapshot.docHeight;
      resizeDocument(snapshot.docWidth, snapshot.docHeight, false);

      layerManager.layers = [];
      const promises = snapshot.layers.map((s) => {
        const layer = new Layer(s.name, s.width, s.height, s.type);
        layer.id = s.id;
        layer.visible = s.visible;
        layer.locked = s.locked;
        layer.opacity = s.opacity;
        layer.blendMode = s.blendMode;
        layer.x = s.x;
        layer.y = s.y;
        layer.textData = { ...s.textData };
        layer.shapeData = s.shapeData ? { ...s.shapeData } : null;

        if (s.type === 'raster' && s.dataUrl) {
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              layer.ctx.clearRect(0, 0, layer.width, layer.height);
              layer.ctx.drawImage(img, 0, 0);
              layerManager.layers.push(layer);
              resolve();
            };
            img.src = s.dataUrl;
          });
        } else {
          layerManager.layers.push(layer);
          return Promise.resolve();
        }
      });

      Promise.all(promises).then(() => {
        layerManager.layers.sort((a, b) => {
          const indexA = snapshot.layers.findIndex((s) => s.id === a.id);
          const indexB = snapshot.layers.findIndex((s) => s.id === b.id);
          return indexA - indexB;
        });

        layerManager.activeLayerId = snapshot.activeLayerId;
        layerManager.render();
        layerManager.updateUI();
        this.isRestoring = false;
        this.updateUI();
      });
    }

    undo() {
      if (this.undoStack.length <= 1) return;
      const current = this.undoStack.pop();
      this.redoStack.push(current);
      const previous = this.undoStack[this.undoStack.length - 1];
      this.restoreState(previous);
      showToast(`Undo: ${current.actionName}`);
    }

    redo() {
      if (this.redoStack.length === 0) return;
      const next = this.redoStack.pop();
      this.undoStack.push(next);
      this.restoreState(next);
      showToast(`Redo: ${next.actionName}`);
    }

    updateUI() {
      const historyList = document.getElementById('history-list');
      if (!historyList) return;
      historyList.innerHTML = '';

      this.undoStack.forEach((item, idx) => {
        const el = document.createElement('div');
        el.className = `history-item ${idx === this.undoStack.length - 1 ? 'active' : ''}`;
        el.innerHTML = `<i data-lucide="clock"></i> <span>${item.actionName}</span>`;
        historyList.appendChild(el);
      });

      if (window.lucide) lucide.createIcons();
    }
  }

  const historyManager = new HistoryManager();

  // =========================================================================
  // 5. VIEWPORT COORDINATES, PAN & ZOOM
  // =========================================================================

  function screenToDoc(clientX, clientY) {
    const stageRect = canvasStage.getBoundingClientRect();
    const x = (clientX - stageRect.left) / state.zoom;
    const y = (clientY - stageRect.top) / state.zoom;
    return { x, y };
  }

  function updateViewportTransform() {
    panZoomLayer.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
    document.getElementById('zoom-percentage').innerText = Math.round(state.zoom * 100) + '%';
  }

  function setZoom(newZoom, centerX = null, centerY = null) {
    const clampedZoom = Math.min(Math.max(0.05, newZoom), 20.0);
    const rect = viewportContainer.getBoundingClientRect();
    const cx = centerX !== null ? centerX : rect.width / 2;
    const cy = centerY !== null ? centerY : rect.height / 2;

    const factor = clampedZoom / state.zoom;
    state.panX = cx - (cx - state.panX) * factor;
    state.panY = cy - (cy - state.panY) * factor;
    state.zoom = clampedZoom;

    updateViewportTransform();
  }

  function fitToScreen() {
    const rect = viewportContainer.getBoundingClientRect();
    const padding = 60;
    const availW = rect.width - padding * 2;
    const availH = rect.height - padding * 2;

    const scaleX = availW / state.docWidth;
    const scaleY = availH / state.docHeight;
    state.zoom = Math.min(scaleX, scaleY, 1.0);

    state.panX = (rect.width - state.docWidth * state.zoom) / 2;
    state.panY = (rect.height - state.docHeight * state.zoom) / 2;
    updateViewportTransform();
  }

  function resizeDocument(w, h, pushHistory = true) {
    state.docWidth = Math.max(10, Math.round(w));
    state.docHeight = Math.max(10, Math.round(h));

    mainCanvas.width = state.docWidth;
    mainCanvas.height = state.docHeight;
    overlayCanvas.width = state.docWidth;
    overlayCanvas.height = state.docHeight;

    canvasStage.style.width = state.docWidth + 'px';
    canvasStage.style.height = state.docHeight + 'px';

    document.getElementById('doc-dim-info').innerText = `${state.docWidth} × ${state.docHeight} px`;
    layerManager.render();

    if (pushHistory) {
      historyManager.pushState(`Resize Canvas (${state.docWidth}x${state.docHeight})`);
    }
  }

  // =========================================================================
  // 6. TOOLS & POINTER EVENT DISPATCHER
  // =========================================================================

  function setActiveTool(toolName) {
    state.activeTool = toolName;
    document.querySelectorAll('.tool-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    });

    const toolNameMap = {
      move: 'Move & Select Tool (V)',
      marquee: 'Marquee Selection (M)',
      crop: 'Crop Canvas (C)',
      brush: 'Paint Brush (B)',
      eraser: 'Eraser (E)',
      bucket: 'Paint Bucket / Fill (G)',
      shape: 'Vector Shapes (U)',
      text: 'Text / Type Tool (T)',
      eyedropper: 'Color Eyedropper (I)',
      inpaint: 'AI Inpainting Brush',
    };

    document.getElementById('active-tool-name').innerHTML = `<i data-lucide="wrench"></i> ${
      toolNameMap[toolName] || toolName
    }`;

    document.querySelectorAll('.tool-opts').forEach((opt) => {
      opt.classList.toggle('hidden', opt.dataset.for !== toolName);
    });

    if (toolName === 'text') {
      layerManager.syncToolOptionsWithActiveLayer();
    }

    if (toolName === 'crop') {
      state.cropBox = { x: 0, y: 0, w: state.docWidth, h: state.docHeight };
    } else {
      state.cropBox = null;
    }

    renderOverlay();
    if (window.lucide) lucide.createIcons();
  }

  canvasStage.addEventListener('pointerdown', onPointerDown);
  canvasStage.addEventListener('dblclick', onCanvasDoubleClick);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  function onCanvasDoubleClick(e) {
    const { x, y } = screenToDoc(e.clientX, e.clientY);
    const active = layerManager.getActiveLayer();
    if (active && active.type === 'text') {
      const newTxt = prompt('Edit Text Content:', active.textData.text);
      if (newTxt !== null) {
        active.textData.text = newTxt;
        active.name = newTxt.slice(0, 20) || 'Text Layer';
        layerManager.render();
        layerManager.updateUI();
        historyManager.pushState('Edit Text Content');
        showToast('Text updated.');
      }
    }
  }

  function onPointerDown(e) {
    if (state.spacePressed || e.button === 1) {
      state.isPanning = true;
      state.panStartX = e.clientX - state.panX;
      state.panStartY = e.clientY - state.panY;
      viewportContainer.classList.add('panning');
      return;
    }

    if (e.button !== 0) return;

    const { x, y } = screenToDoc(e.clientX, e.clientY);
    state.isDrawing = true;
    state.hasMovedDuringDrag = false;
    state.lastX = x;
    state.lastY = y;
    state.startX = x;
    state.startY = y;

    if (state.activeTool === 'move' && state.autoSelectLayer) {
      const hitLayer = findLayerAt(x, y);
      if (hitLayer) {
        layerManager.setActiveLayer(hitLayer.id);
      }
    }

    const activeLayer = layerManager.getActiveLayer();

    if (state.activeTool === 'move') {
      if (activeLayer) {
        state.transformStart = {
          layerX: activeLayer.x,
          layerY: activeLayer.y,
          startX: x,
          startY: y,
        };
      }
    } else if (state.activeTool === 'brush') {
      if (!activeLayer) return;
      drawBrushStroke(activeLayer, x, y, x, y, state.primaryColor, state.brushSize, state.brushOpacity);
      layerManager.render();
    } else if (state.activeTool === 'eraser') {
      if (!activeLayer) return;
      eraseStroke(activeLayer, x, y, x, y, state.eraserSize, state.eraserOpacity);
      layerManager.render();
    } else if (state.activeTool === 'inpaint') {
      state.inpaintPoints = [{ x, y }];
      drawInpaintMask(x, y, x, y);
    } else if (state.activeTool === 'eyedropper') {
      pickColorAt(x, y);
    } else if (state.activeTool === 'bucket') {
      floodFill(x, y, state.primaryColor);
    } else if (state.activeTool === 'text') {
      handleTextToolClick(x, y);
    }
  }

  function findLayerAt(docX, docY) {
    const reversed = [...layerManager.layers].reverse();
    for (const l of reversed) {
      if (!l.visible) continue;
      if (docX >= l.x && docX <= l.x + l.width && docY >= l.y && docY <= l.y + l.height) {
        return l;
      }
    }
    return null;
  }

  function onPointerMove(e) {
    const coords = screenToDoc(e.clientX, e.clientY);
    document.getElementById('status-coords').innerText = `X: ${Math.round(coords.x)} px, Y: ${Math.round(
      coords.y
    )} px`;

    if (state.isPanning) {
      state.panX = e.clientX - state.panStartX;
      state.panY = e.clientY - state.panStartY;
      updateViewportTransform();
      return;
    }

    if (!state.isDrawing) {
      renderOverlayHover(coords.x, coords.y);
      return;
    }

    state.hasMovedDuringDrag = true;
    const { x, y } = coords;
    const activeLayer = layerManager.getActiveLayer();

    if (state.activeTool === 'move' && activeLayer && state.transformStart) {
      activeLayer.x = state.transformStart.layerX + (x - state.transformStart.startX);
      activeLayer.y = state.transformStart.layerY + (y - state.transformStart.startY);
      layerManager.render();
    } else if (state.activeTool === 'brush' && activeLayer) {
      drawBrushStroke(activeLayer, state.lastX, state.lastY, x, y, state.primaryColor, state.brushSize, state.brushOpacity);
      state.lastX = x;
      state.lastY = y;
      layerManager.render();
    } else if (state.activeTool === 'eraser' && activeLayer) {
      eraseStroke(activeLayer, state.lastX, state.lastY, x, y, state.eraserSize, state.eraserOpacity);
      state.lastX = x;
      state.lastY = y;
      layerManager.render();
    } else if (state.activeTool === 'inpaint') {
      state.inpaintPoints.push({ x, y });
      drawInpaintMask(state.lastX, state.lastY, x, y);
      state.lastX = x;
      state.lastY = y;
    } else if (state.activeTool === 'marquee' || state.activeTool === 'shape' || state.activeTool === 'crop') {
      renderOverlayPreview(x, y);
    }
  }

  function onPointerUp(e) {
    if (state.isPanning) {
      state.isPanning = false;
      viewportContainer.classList.remove('panning');
      return;
    }

    if (!state.isDrawing) return;
    state.isDrawing = false;

    const { x, y } = screenToDoc(e.clientX, e.clientY);

    if (state.activeTool === 'brush' && state.hasMovedDuringDrag) {
      historyManager.pushState('Brush Stroke');
    } else if (state.activeTool === 'eraser' && state.hasMovedDuringDrag) {
      historyManager.pushState('Eraser Stroke');
    } else if (state.activeTool === 'move' && state.hasMovedDuringDrag) {
      historyManager.pushState('Move / Transform');
    } else if (state.activeTool === 'marquee') {
      const w = x - state.startX;
      const h = y - state.startY;
      if (Math.abs(w) > 4 && Math.abs(h) > 4) {
        state.selection = {
          x: Math.min(state.startX, x),
          y: Math.min(state.startY, y),
          w: Math.abs(w),
          h: Math.abs(h),
        };
      } else {
        state.selection = null;
      }
      renderOverlay();
    } else if (state.activeTool === 'crop') {
      const w = x - state.startX;
      const h = y - state.startY;
      if (Math.abs(w) > 10 && Math.abs(h) > 10) {
        state.cropBox = {
          x: Math.min(state.startX, x),
          y: Math.min(state.startY, y),
          w: Math.abs(w),
          h: Math.abs(h),
        };
      }
      renderOverlay();
    } else if (state.activeTool === 'shape') {
      commitShape(state.startX, state.startY, x, y);
    } else if (state.activeTool === 'inpaint') {
      applyGenerativeInpaint();
    }
  }

  // =========================================================================
  // 7. TOOL IMPLEMENTATIONS
  // =========================================================================

  function drawBrushStroke(layer, x1, y1, x2, y2, color, size, opacity) {
    const ctx = layer.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;
    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.moveTo(x1 - layer.x, y1 - layer.y);
    ctx.lineTo(x2 - layer.x, y2 - layer.y);
    ctx.stroke();
    ctx.restore();
  }

  function eraseStroke(layer, x1, y1, x2, y2, size, opacity) {
    const ctx = layer.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.moveTo(x1 - layer.x, y1 - layer.y);
    ctx.lineTo(x2 - layer.x, y2 - layer.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawInpaintMask(x1, y1, x2, y2) {
    overlayCtx.save();
    overlayCtx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
    overlayCtx.lineWidth = state.brushSize;
    overlayCtx.lineCap = 'round';
    overlayCtx.beginPath();
    overlayCtx.moveTo(x1, y1);
    overlayCtx.lineTo(x2, y2);
    overlayCtx.stroke();
    overlayCtx.restore();
  }

  function applyGenerativeInpaint() {
    const layer = layerManager.getActiveLayer();
    if (!layer || layer.type !== 'raster' || state.inpaintPoints.length === 0) {
      renderOverlay();
      return;
    }

    showToast('AI: Synthesizing texture patch...');
    setTimeout(() => {
      state.inpaintPoints.forEach((pt) => {
        const radius = state.brushSize / 2;
        const patch = layer.ctx.getImageData(
          Math.max(0, pt.x - layer.x - radius - 10),
          Math.max(0, pt.y - layer.y - radius - 10),
          radius * 2,
          radius * 2
        );
        layer.ctx.putImageData(patch, pt.x - layer.x - radius, pt.y - layer.y - radius);
      });
      state.inpaintPoints = [];
      layerManager.render();
      historyManager.pushState('Generative Inpaint');
      showToast('Inpainting complete.');
    }, 200);
  }

  function pickColorAt(x, y) {
    if (x < 0 || y < 0 || x >= state.docWidth || y >= state.docHeight) return;
    const pixel = mainCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
    state.primaryColor = hex;
    document.getElementById('primary-color').value = hex;
    showToast(`Color: ${hex.toUpperCase()}`);
  }

  function rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function floodFill(startX, startY, fillColorHex) {
    const layer = layerManager.getActiveLayer();
    if (!layer || layer.type !== 'raster') return;

    const x = Math.floor(startX - layer.x);
    const y = Math.floor(startY - layer.y);
    if (x < 0 || y < 0 || x >= layer.width || y >= layer.height) return;

    const imgData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
    const data = imgData.data;
    const targetIdx = (y * layer.width + x) * 4;

    const targetR = data[targetIdx];
    const targetG = data[targetIdx + 1];
    const targetB = data[targetIdx + 2];
    const targetA = data[targetIdx + 3];

    const fillR = parseInt(fillColorHex.slice(1, 3), 16);
    const fillG = parseInt(fillColorHex.slice(3, 5), 16);
    const fillB = parseInt(fillColorHex.slice(5, 7), 16);
    const fillA = 255;

    if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === fillA) return;

    const queue = [[x, y]];
    const visited = new Uint8Array(layer.width * layer.height);

    function colorMatch(idx) {
      return (
        Math.abs(data[idx] - targetR) < 32 &&
        Math.abs(data[idx + 1] - targetG) < 32 &&
        Math.abs(data[idx + 2] - targetB) < 32 &&
        Math.abs(data[idx + 3] - targetA) < 32
      );
    }

    while (queue.length > 0) {
      const [curX, curY] = queue.pop();
      const pos = curY * layer.width + curX;
      if (visited[pos]) continue;
      visited[pos] = 1;

      const idx = pos * 4;
      data[idx] = fillR;
      data[idx + 1] = fillG;
      data[idx + 2] = fillB;
      data[idx + 3] = fillA;

      if (curX > 0 && colorMatch((curY * layer.width + curX - 1) * 4)) queue.push([curX - 1, curY]);
      if (curX < layer.width - 1 && colorMatch((curY * layer.width + curX + 1) * 4)) queue.push([curX + 1, curY]);
      if (curY > 0 && colorMatch(((curY - 1) * layer.width + curX) * 4)) queue.push([curX, curY - 1]);
      if (curY < layer.height - 1 && colorMatch(((curY + 1) * layer.width + curX) * 4)) queue.push([curX, curY + 1]);
    }

    layer.ctx.putImageData(imgData, 0, 0);
    layerManager.render();
    historyManager.pushState('Paint Bucket Fill');
  }

  function commitShape(x1, y1, x2, y2) {
    const w = x2 - x1;
    const h = y2 - y1;
    if (Math.abs(w) < 4 || Math.abs(h) < 4) return;

    const shapeLayer = new Layer(`Shape (${state.shapeType})`, Math.abs(w), Math.abs(h), 'shape');
    shapeLayer.x = Math.min(x1, x2);
    shapeLayer.y = Math.min(y1, y2);
    shapeLayer.shapeData = {
      type: state.shapeType,
      fill: state.shapeFill,
      fillColor: state.primaryColor,
      strokeColor: state.secondaryColor,
      strokeWidth: state.shapeStroke,
    };

    layerManager.addLayer(shapeLayer);
    historyManager.pushState(`Create Shape`);
  }

  function handleTextToolClick(x, y) {
    const hit = findLayerAt(x, y);
    if (hit && hit.type === 'text') {
      layerManager.setActiveLayer(hit.id);
      const newTxt = prompt('Edit Text Content:', hit.textData.text);
      if (newTxt !== null) {
        hit.textData.text = newTxt;
        hit.name = newTxt.slice(0, 20) || 'Text Layer';
        layerManager.render();
        layerManager.updateUI();
        historyManager.pushState('Edit Text');
      }
      return;
    }

    const text = prompt('Enter Text:', 'Vinzor Studio Pro');
    if (!text) return;

    const textLayer = new Layer(text.slice(0, 20), 400, 100, 'text');
    textLayer.x = x;
    textLayer.y = y;
    textLayer.textData = {
      text: text,
      fontFamily: state.fontFamily,
      fontSize: state.fontSize,
      color: state.primaryColor,
      bold: state.fontBold,
      italic: state.fontItalic,
    };

    layerManager.addLayer(textLayer);
    historyManager.pushState('Add Text Layer');
  }

  function executeCrop(crop) {
    if (!crop || crop.w <= 0 || crop.h <= 0) return;
    const off = document.createElement('canvas');
    off.width = crop.w;
    off.height = crop.h;
    const oCtx = off.getContext('2d');

    layerManager.layers.forEach((layer) => {
      layer.x -= crop.x;
      layer.y -= crop.y;
    });

    resizeDocument(crop.w, crop.h, false);
    state.cropBox = null;
    state.selection = null;
    setActiveTool('move');
    fitToScreen();
    historyManager.pushState(`Crop Canvas (${Math.round(crop.w)}x${Math.round(crop.h)})`);
    showToast('Canvas cropped.');
  }

  function transformActiveLayer(mode) {
    const active = layerManager.getActiveLayer();
    if (!active) {
      showToast('Select a layer to transform.');
      return;
    }

    const temp = document.createElement('canvas');
    temp.width = active.canvas.width;
    temp.height = active.canvas.height;
    const tCtx = temp.getContext('2d');
    tCtx.drawImage(active.canvas, 0, 0);

    active.ctx.clearRect(0, 0, active.canvas.width, active.canvas.height);
    active.ctx.save();

    if (mode === 'flip-h') {
      active.ctx.translate(active.canvas.width, 0);
      active.ctx.scale(-1, 1);
      active.ctx.drawImage(temp, 0, 0);
    } else if (mode === 'flip-v') {
      active.ctx.translate(0, active.canvas.height);
      active.ctx.scale(1, -1);
      active.ctx.drawImage(temp, 0, 0);
    } else if (mode === 'rot-90') {
      const oldW = active.canvas.width;
      const oldH = active.canvas.height;
      active.canvas.width = oldH;
      active.canvas.height = oldW;
      active.width = oldH;
      active.height = oldW;
      active.ctx.translate(oldH, 0);
      active.ctx.rotate(Math.PI / 2);
      active.ctx.drawImage(temp, 0, 0);
    }

    active.ctx.restore();
    layerManager.render();
    historyManager.pushState(`Transform: ${mode}`);
    showToast(`Applied ${mode}`);
  }

  // =========================================================================
  // 8. OVERLAY RENDERING (Guides, Handles, Selections)
  // =========================================================================

  function renderOverlay() {
    overlayCtx.clearRect(0, 0, state.docWidth, state.docHeight);

    if (state.selection) {
      const s = state.selection;
      overlayCtx.save();
      overlayCtx.strokeStyle = '#3b82f6';
      overlayCtx.lineWidth = 1.5;
      overlayCtx.setLineDash([4, 4]);
      overlayCtx.strokeRect(s.x, s.y, s.w, s.h);
      overlayCtx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      overlayCtx.fillRect(s.x, s.y, s.w, s.h);
      overlayCtx.restore();
    }

    if (state.cropBox && state.activeTool === 'crop') {
      const c = state.cropBox;
      overlayCtx.save();
      overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      overlayCtx.fillRect(0, 0, state.docWidth, state.docHeight);
      overlayCtx.clearRect(c.x, c.y, c.w, c.h);

      overlayCtx.strokeStyle = '#38bdf8';
      overlayCtx.lineWidth = 2;
      overlayCtx.setLineDash([6, 3]);
      overlayCtx.strokeRect(c.x, c.y, c.w, c.h);
      overlayCtx.restore();
    }

    const active = layerManager.getActiveLayer();
    if (active && state.activeTool === 'move' && state.showTransformBox) {
      overlayCtx.save();
      overlayCtx.strokeStyle = '#60a5fa';
      overlayCtx.lineWidth = 1.5;
      overlayCtx.setLineDash([]);
      overlayCtx.strokeRect(active.x, active.y, active.width, active.height);

      const handleSize = 6;
      overlayCtx.fillStyle = '#ffffff';
      const corners = [
        [active.x, active.y],
        [active.x + active.width, active.y],
        [active.x, active.y + active.height],
        [active.x + active.width, active.y + active.height],
      ];
      corners.forEach(([hx, hy]) => {
        overlayCtx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        overlayCtx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
      });
      overlayCtx.restore();
    }
  }

  function renderOverlayPreview(currX, currY) {
    renderOverlay();
    const w = currX - state.startX;
    const h = currY - state.startY;

    if (state.activeTool === 'shape') {
      overlayCtx.save();
      overlayCtx.fillStyle = state.primaryColor;
      overlayCtx.strokeStyle = state.secondaryColor;
      overlayCtx.lineWidth = state.shapeStroke;
      overlayCtx.setLineDash([3, 3]);
      overlayCtx.strokeRect(Math.min(state.startX, currX), Math.min(state.startY, currY), Math.abs(w), Math.abs(h));
      overlayCtx.restore();
    } else if (state.activeTool === 'marquee' || state.activeTool === 'crop') {
      overlayCtx.save();
      overlayCtx.strokeStyle = state.activeTool === 'crop' ? '#38bdf8' : '#3b82f6';
      overlayCtx.setLineDash([4, 4]);
      overlayCtx.strokeRect(Math.min(state.startX, currX), Math.min(state.startY, currY), Math.abs(w), Math.abs(h));
      overlayCtx.restore();
    }
  }

  function renderOverlayHover(x, y) {
    if (state.activeTool === 'brush' || state.activeTool === 'eraser' || state.activeTool === 'inpaint') {
      renderOverlay();
      const size = state.activeTool === 'brush' ? state.brushSize : state.eraserSize;
      overlayCtx.save();
      overlayCtx.beginPath();
      overlayCtx.arc(x, y, size / 2, 0, Math.PI * 2);
      overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      overlayCtx.lineWidth = 1.5;
      overlayCtx.stroke();
      overlayCtx.restore();
    }
  }

  // =========================================================================
  // 9. IMAGE FILTERS & ADJUSTMENTS
  // =========================================================================

  function applyAdjustments(brightness = 0, contrast = 0, hue = 0, saturation = 0) {
    const layer = layerManager.getActiveLayer();
    if (!layer || layer.type !== 'raster') {
      showToast('Select a raster image layer.');
      return;
    }

    const imgData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
    const data = imgData.data;

    const bFactor = brightness * 1.28;
    const cFactor = (contrast + 100) / 100;
    const cFactorSq = cFactor * cFactor;
    const sFactor = (saturation + 100) / 100;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;

      let r = data[i] + bFactor;
      let g = data[i + 1] + bFactor;
      let b = data[i + 2] + bFactor;

      r = ((r / 255 - 0.5) * cFactorSq + 0.5) * 255;
      g = ((g / 255 - 0.5) * cFactorSq + 0.5) * 255;
      b = ((b / 255 - 0.5) * cFactorSq + 0.5) * 255;

      const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * sFactor;
      g = gray + (g - gray) * sFactor;
      b = gray + (g - gray) * sFactor;

      data[i] = Math.min(255, Math.max(0, r));
      data[i + 1] = Math.min(255, Math.max(0, g));
      data[i + 2] = Math.min(255, Math.max(0, b));
    }

    layer.ctx.putImageData(imgData, 0, 0);
    layerManager.render();
    historyManager.pushState('Color Adjustments');
    showToast('Adjustments applied.');
  }

  function applyPresetFilter(filterName) {
    const layer = layerManager.getActiveLayer();
    if (!layer || layer.type !== 'raster') {
      showToast('Select a raster layer first.');
      return;
    }

    const imgData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
    const data = imgData.data;

    if (filterName === 'grayscale') {
      for (let i = 0; i < data.length; i += 4) {
        const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = data[i + 1] = data[i + 2] = v;
      }
    } else if (filterName === 'invert') {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
      }
    } else if (filterName === 'sepia') {
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
        data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
        data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
      }
    } else if (filterName === 'sharpen') {
      convolve3x3(imgData, [0, -1, 0, -1, 5, -1, 0, -1, 0]);
    } else if (filterName === 'blur') {
      convolve3x3(imgData, [1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9]);
    } else if (filterName === 'vignette') {
      const cx = layer.width / 2;
      const cy = layer.height / 2;
      const maxDist = Math.sqrt(cx * cx + cy * cy);
      for (let y = 0; y < layer.height; y++) {
        for (let x = 0; x < layer.width; x++) {
          const idx = (y * layer.width + x) * 4;
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          const factor = 1 - Math.pow(dist / maxDist, 1.8) * 0.7;
          data[idx] *= factor;
          data[idx + 1] *= factor;
          data[idx + 2] *= factor;
        }
      }
    }

    layer.ctx.putImageData(imgData, 0, 0);
    layerManager.render();
    historyManager.pushState(`Filter: ${filterName}`);
    showToast(`Applied ${filterName}.`);
  }

  function convolve3x3(imgData, weights) {
    const src = new Uint8ClampedArray(imgData.data);
    const dst = imgData.data;
    const w = imgData.width;
    const h = imgData.height;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let r = 0,
          g = 0,
          b = 0;
        for (let cy = -1; cy <= 1; cy++) {
          for (let cx = -1; cx <= 1; cx++) {
            const weight = weights[(cy + 1) * 3 + (cx + 1)];
            const sIdx = ((y + cy) * w + (x + cx)) * 4;
            r += src[sIdx] * weight;
            g += src[sIdx + 1] * weight;
            b += src[sIdx + 2] * weight;
          }
        }
        const dIdx = (y * w + x) * 4;
        dst[dIdx] = Math.min(255, Math.max(0, r));
        dst[dIdx + 1] = Math.min(255, Math.max(0, g));
        dst[dIdx + 2] = Math.min(255, Math.max(0, b));
      }
    }
  }

  // =========================================================================
  // 10. AI TOOLS & WORKFLOWS
  // =========================================================================

  function aiRemoveBackground() {
    const layer = layerManager.getActiveLayer();
    if (!layer || layer.type !== 'raster') {
      showToast('Select an image layer.');
      return;
    }

    showToast('AI: Analyzing foreground & isolating subject...');
    setTimeout(() => {
      const imgData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
      const data = imgData.data;
      const bgR = data[0],
        bgG = data[1],
        bgB = data[2];
      const threshold = 45;

      for (let i = 0; i < data.length; i += 4) {
        const dist = Math.sqrt((data[i] - bgR) ** 2 + (data[i + 1] - bgG) ** 2 + (data[i + 2] - bgB) ** 2);
        if (dist < threshold) {
          data[i + 3] = Math.floor(data[i + 3] * ((dist / threshold) ** 2));
        }
      }

      layer.ctx.putImageData(imgData, 0, 0);
      layerManager.render();
      historyManager.pushState('AI Cutout');
      showToast('Background cutout complete.');
    }, 150);
  }

  function aiAutoEnhance() {
    const layer = layerManager.getActiveLayer();
    if (!layer || layer.type !== 'raster') {
      showToast('Select an image layer.');
      return;
    }

    showToast('AI: Auto-balancing dynamic range...');
    setTimeout(() => {
      const imgData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * 1.08 + 4);
        data[i + 1] = Math.min(255, data[i + 1] * 1.08 + 4);
        data[i + 2] = Math.min(255, data[i + 2] * 1.08 + 4);
      }

      layer.ctx.putImageData(imgData, 0, 0);
      layerManager.render();
      historyManager.pushState('AI Auto Enhance');
      showToast('Photo auto-enhanced.');
    }, 150);
  }

  // =========================================================================
  // 11. FILE PERSISTENCE & EXPORTS
  // =========================================================================

  function openImageFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (layerManager.layers.length <= 1) {
          resizeDocument(img.width, img.height, false);
        }
        const newLayer = new Layer(file.name.replace(/\.[^/.]+$/, ''), img.width, img.height, 'raster');
        newLayer.ctx.drawImage(img, 0, 0);
        layerManager.addLayer(newLayer);
        historyManager.pushState(`Open: ${file.name}`);
        fitToScreen();
        showToast(`Imported ${file.name}`);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function exportArtwork(format = 'image/png', quality = 0.92, scale = 1.0) {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = state.docWidth * scale;
    exportCanvas.height = state.docHeight * scale;
    const eCtx = exportCanvas.getContext('2d');

    eCtx.scale(scale, scale);
    layerManager.layers.forEach((l) => l.renderTo(eCtx));

    const link = document.createElement('a');
    const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
    link.download = `${state.docName || 'Artwork'}.${ext}`;
    link.href = exportCanvas.toDataURL(format, quality);
    link.click();
    showToast(`Exported as ${ext.toUpperCase()}`);
  }

  function saveProjectJSON() {
    const projectData = {
      version: '2.0',
      name: state.docName,
      width: state.docWidth,
      height: state.docHeight,
      layers: layerManager.layers.map((l) => ({
        name: l.name,
        type: l.type,
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
        blendMode: l.blendMode,
        x: l.x,
        y: l.y,
        width: l.width,
        height: l.height,
        textData: l.textData,
        shapeData: l.shapeData,
        dataUrl: l.type === 'raster' ? l.canvas.toDataURL() : null,
      })),
    };

    const blob = new Blob([JSON.stringify(projectData)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `${state.docName || 'Project'}.vinzor.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    showToast('Project file saved.');
  }

  function loadProjectJSON(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const project = JSON.parse(e.target.result);
        state.docName = project.name || 'Untitled';
        historyManager.restoreState({
          actionName: 'Load Project',
          docWidth: project.width,
          docHeight: project.height,
          activeLayerId: null,
          layers: project.layers,
        });
        showToast('Project loaded.');
      } catch (err) {
        showToast('Failed to load project.');
      }
    };
    reader.readAsText(file);
  }

  function loadSampleArtwork() {
    resizeDocument(1280, 720, false);
    layerManager.layers = [];

    const bgLayer = new Layer('Vibrant Gradient Background', 1280, 720, 'raster');
    const grad = bgLayer.ctx.createLinearGradient(0, 0, 1280, 720);
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.5, '#4338ca');
    grad.addColorStop(1, '#ec4899');
    bgLayer.ctx.fillStyle = grad;
    bgLayer.ctx.fillRect(0, 0, 1280, 720);
    layerManager.addLayer(bgLayer);

    const circleLayer = new Layer('Glow Circle', 500, 500, 'shape');
    circleLayer.x = 390;
    circleLayer.y = 110;
    circleLayer.opacity = 0.4;
    circleLayer.blendMode = 'screen';
    circleLayer.shapeData = {
      type: 'circle',
      fill: true,
      fillColor: '#38bdf8',
      strokeColor: '#ffffff',
      strokeWidth: 4,
    };
    layerManager.addLayer(circleLayer);

    const titleLayer = new Layer('Headline Typography', 800, 120, 'text');
    titleLayer.x = 240;
    titleLayer.y = 280;
    titleLayer.textData = {
      text: 'VINZOR PHOTO STUDIO',
      fontFamily: 'Inter, sans-serif',
      fontSize: 54,
      color: '#ffffff',
      bold: true,
      italic: false,
    };
    layerManager.addLayer(titleLayer);

    const subLayer = new Layer('Subtitle Typography', 800, 80, 'text');
    subLayer.x = 340;
    subLayer.y = 370;
    subLayer.textData = {
      text: 'High-Performance Web Graphics Engine',
      fontFamily: 'Inter, sans-serif',
      fontSize: 24,
      color: '#cbd5e1',
      bold: false,
      italic: false,
    };
    layerManager.addLayer(subLayer);

    historyManager.pushState('Load Sample Artwork');
    fitToScreen();
    showToast('Loaded sample artwork.');
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerHTML = `<i data-lucide="info"></i> <span>${msg}</span>`;
    toast.classList.add('show');
    if (window.lucide) lucide.createIcons();
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  // =========================================================================
  // 12. UI INITIALIZATION & EVENT BINDINGS
  // =========================================================================

  function initUI() {
    document.querySelectorAll('.tool-btn').forEach((btn) => {
      btn.addEventListener('click', () => setActiveTool(btn.dataset.tool));
    });

    document.getElementById('btn-deselect-current').addEventListener('click', () => layerManager.deselectActiveLayer());
    document.getElementById('menu-deselect-layer').addEventListener('click', () => layerManager.deselectActiveLayer());
    document.getElementById('menu-deselect').addEventListener('click', () => {
      state.selection = null;
      renderOverlay();
      showToast('Deselected selection marquee.');
    });

    const liveTextInput = document.getElementById('opt-text-live-input');
    liveTextInput.addEventListener('input', (e) => {
      const active = layerManager.getActiveLayer();
      if (active && active.type === 'text') {
        active.textData.text = e.target.value;
        layerManager.render();
      }
    });
    liveTextInput.addEventListener('change', () => {
      historyManager.pushState('Update Text');
    });

    document.getElementById('btn-apply-text-change').addEventListener('click', () => {
      const active = layerManager.getActiveLayer();
      if (active && active.type === 'text') {
        active.textData.text = liveTextInput.value;
        active.textData.fontFamily = document.getElementById('opt-font-family').value;
        active.textData.fontSize = parseInt(document.getElementById('opt-font-size').value) || 48;
        active.textData.bold = document.getElementById('opt-font-bold').classList.contains('active');
        active.textData.italic = document.getElementById('opt-font-italic').classList.contains('active');
        layerManager.render();
        layerManager.updateUI();
        historyManager.pushState('Update Text Properties');
        showToast('Text updated.');
      }
    });

    document.getElementById('opt-font-family').addEventListener('change', (e) => {
      state.fontFamily = e.target.value;
      const active = layerManager.getActiveLayer();
      if (active && active.type === 'text') {
        active.textData.fontFamily = e.target.value;
        layerManager.render();
        historyManager.pushState('Change Font');
      }
    });

    document.getElementById('opt-font-size').addEventListener('input', (e) => {
      state.fontSize = parseInt(e.target.value) || 48;
      const active = layerManager.getActiveLayer();
      if (active && active.type === 'text') {
        active.textData.fontSize = state.fontSize;
        layerManager.render();
      }
    });

    const btnBold = document.getElementById('opt-font-bold');
    btnBold.addEventListener('click', () => {
      state.fontBold = !state.fontBold;
      btnBold.classList.toggle('active', state.fontBold);
      const active = layerManager.getActiveLayer();
      if (active && active.type === 'text') {
        active.textData.bold = state.fontBold;
        layerManager.render();
        historyManager.pushState('Toggle Bold');
      }
    });

    const btnItalic = document.getElementById('opt-font-italic');
    btnItalic.addEventListener('click', () => {
      state.fontItalic = !state.fontItalic;
      btnItalic.classList.toggle('active', state.fontItalic);
      const active = layerManager.getActiveLayer();
      if (active && active.type === 'text') {
        active.textData.italic = state.fontItalic;
        layerManager.render();
        historyManager.pushState('Toggle Italic');
      }
    });

    const primColorInput = document.getElementById('primary-color');
    const secColorInput = document.getElementById('secondary-color');
    primColorInput.addEventListener('input', (e) => {
      state.primaryColor = e.target.value;
      const active = layerManager.getActiveLayer();
      if (active && active.type === 'text') {
        active.textData.color = e.target.value;
        layerManager.render();
      }
    });
    secColorInput.addEventListener('input', (e) => (state.secondaryColor = e.target.value));
    document.getElementById('btn-swap-colors').addEventListener('click', () => {
      const temp = state.primaryColor;
      state.primaryColor = state.secondaryColor;
      state.secondaryColor = temp;
      primColorInput.value = state.primaryColor;
      secColorInput.value = state.secondaryColor;
    });

    document.getElementById('opt-brush-size').addEventListener('input', (e) => {
      state.brushSize = parseInt(e.target.value);
      document.getElementById('val-brush-size').innerText = state.brushSize + 'px';
    });
    document.getElementById('opt-eraser-size').addEventListener('input', (e) => {
      state.eraserSize = parseInt(e.target.value);
      document.getElementById('val-eraser-size').innerText = state.eraserSize + 'px';
    });
    document.getElementById('opt-shape-type').addEventListener('change', (e) => (state.shapeType = e.target.value));
    document.getElementById('opt-shape-stroke').addEventListener('input', (e) => {
      state.shapeStroke = parseInt(e.target.value);
      document.getElementById('val-shape-stroke').innerText = state.shapeStroke + 'px';
    });

    document.getElementById('btn-zoom-add').addEventListener('click', () => setZoom(state.zoom * 1.25));
    document.getElementById('btn-zoom-sub').addEventListener('click', () => setZoom(state.zoom / 1.25));
    document.getElementById('btn-fit-screen').addEventListener('click', fitToScreen);
    document.getElementById('btn-actual-size').addEventListener('click', () => setZoom(1.0));
    document.getElementById('btn-center-canvas').addEventListener('click', fitToScreen);

    viewportContainer.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        setZoom(state.zoom * factor, e.clientX, e.clientY);
      },
      { passive: false }
    );

    document.getElementById('btn-layer-new').addEventListener('click', () => {
      layerManager.addLayer(new Layer(`Layer ${layerManager.layers.length + 1}`, state.docWidth, state.docHeight, 'raster'));
      historyManager.pushState('New Layer');
    });
    document.getElementById('btn-layer-duplicate').addEventListener('click', () => {
      if (layerManager.activeLayerId) layerManager.duplicateLayer(layerManager.activeLayerId);
    });
    document.getElementById('btn-layer-delete').addEventListener('click', () => {
      if (layerManager.activeLayerId) layerManager.removeLayer(layerManager.activeLayerId);
    });
    document.getElementById('btn-layer-up').addEventListener('click', () => {
      if (layerManager.activeLayerId) layerManager.moveLayer(layerManager.activeLayerId, 1);
    });
    document.getElementById('btn-layer-down').addEventListener('click', () => {
      if (layerManager.activeLayerId) layerManager.moveLayer(layerManager.activeLayerId, -1);
    });
    document.getElementById('btn-layer-merge').addEventListener('click', () => {
      if (layerManager.activeLayerId) layerManager.mergeDown(layerManager.activeLayerId);
    });

    document.getElementById('layer-blend-mode').addEventListener('change', (e) => {
      const active = layerManager.getActiveLayer();
      if (active) {
        active.blendMode = e.target.value;
        layerManager.render();
        historyManager.pushState('Change Blend Mode');
      }
    });

    document.getElementById('layer-opacity').addEventListener('input', (e) => {
      const active = layerManager.getActiveLayer();
      if (active) {
        active.opacity = parseInt(e.target.value) / 100;
        document.getElementById('val-layer-opacity').innerText = e.target.value + '%';
        layerManager.render();
      }
    });

    document.querySelectorAll('.tab-btn').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((t) => t.classList.remove('active'));
        document.querySelectorAll('.panel-content').forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
      });
    });

    document.getElementById('menu-new').addEventListener('click', () => openModal('modal-new-doc'));
    document.getElementById('btn-quick-new').addEventListener('click', () => openModal('modal-new-doc'));
    document.getElementById('menu-open').addEventListener('click', () => document.getElementById('file-input-image').click());
    document.getElementById('file-input-image').addEventListener('change', (e) => openImageFile(e.target.files[0]));
    document.getElementById('menu-open-project').addEventListener('click', () => document.getElementById('file-input-project').click());
    document.getElementById('file-input-project').addEventListener('change', (e) => loadProjectJSON(e.target.files[0]));
    document.getElementById('menu-save-project').addEventListener('click', saveProjectJSON);
    document.getElementById('menu-export').addEventListener('click', openExportModal);
    document.getElementById('btn-quick-export').addEventListener('click', openExportModal);
    document.getElementById('menu-sample').addEventListener('click', loadSampleArtwork);

    // Edit Menu
    document.getElementById('menu-undo').addEventListener('click', () => historyManager.undo());
    document.getElementById('menu-redo').addEventListener('click', () => historyManager.redo());
    document.getElementById('menu-cut').addEventListener('click', () => {
      const active = layerManager.getActiveLayer();
      if (active && active.type === 'raster') {
        if (state.selection) {
          active.ctx.clearRect(state.selection.x - active.x, state.selection.y - active.y, state.selection.w, state.selection.h);
        } else {
          active.ctx.clearRect(0, 0, active.width, active.height);
        }
        layerManager.render();
        historyManager.pushState('Clear Layer Contents');
      }
    });
    document.getElementById('menu-select-all').addEventListener('click', () => {
      state.selection = { x: 0, y: 0, w: state.docWidth, h: state.docHeight };
      renderOverlay();
      showToast('Selected entire canvas');
    });

    // Image Menu
    document.getElementById('menu-canvas-size').addEventListener('click', () => {
      const w = parseInt(prompt('New Width (px):', state.docWidth));
      const h = parseInt(prompt('New Height (px):', state.docHeight));
      if (w > 0 && h > 0) {
        resizeDocument(w, h);
        fitToScreen();
      }
    });
    document.getElementById('menu-crop-doc').addEventListener('click', () => {
      if (state.selection) executeCrop(state.selection);
      else showToast('Make a marquee selection first.');
    });
    document.getElementById('menu-flip-h').addEventListener('click', () => transformActiveLayer('flip-h'));
    document.getElementById('menu-flip-v').addEventListener('click', () => transformActiveLayer('flip-v'));
    document.getElementById('menu-rot-90').addEventListener('click', () => transformActiveLayer('rot-90'));

    // Layer Menu
    document.getElementById('menu-add-layer').addEventListener('click', () => {
      layerManager.addLayer(new Layer(`Layer ${layerManager.layers.length + 1}`, state.docWidth, state.docHeight, 'raster'));
      historyManager.pushState('New Raster Layer');
    });
    document.getElementById('menu-dup-layer').addEventListener('click', () => {
      if (layerManager.activeLayerId) layerManager.duplicateLayer(layerManager.activeLayerId);
    });
    document.getElementById('menu-del-layer').addEventListener('click', () => {
      if (layerManager.activeLayerId) layerManager.removeLayer(layerManager.activeLayerId);
    });
    document.getElementById('menu-merge-down').addEventListener('click', () => {
      if (layerManager.activeLayerId) layerManager.mergeDown(layerManager.activeLayerId);
    });
    document.getElementById('menu-flatten').addEventListener('click', () => layerManager.flatten());

    // Filter Menu
    document.getElementById('menu-filter-blur').addEventListener('click', () => applyPresetFilter('blur'));
    document.getElementById('menu-filter-sharpen').addEventListener('click', () => applyPresetFilter('sharpen'));
    document.getElementById('menu-filter-grayscale').addEventListener('click', () => applyPresetFilter('grayscale'));
    document.getElementById('menu-filter-invert').addEventListener('click', () => applyPresetFilter('invert'));
    document.getElementById('menu-filter-sepia').addEventListener('click', () => applyPresetFilter('sepia'));
    document.getElementById('menu-filter-vignette').addEventListener('click', () => applyPresetFilter('vignette'));

    // Crop Toolbar Options
    document.getElementById('btn-apply-crop').addEventListener('click', () => {
      if (state.cropBox) executeCrop(state.cropBox);
    });
    document.getElementById('btn-cancel-crop').addEventListener('click', () => {
      state.cropBox = null;
      setActiveTool('move');
      renderOverlay();
    });

    // Color Panel Sliders
    ['brightness', 'contrast', 'hue', 'saturation', 'vibrance'].forEach((id) => {
      const el = document.getElementById(`adj-${id}`);
      if (el) {
        el.addEventListener('input', (e) => {
          document.getElementById(`val-adj-${id}`).innerText = e.target.value + (id === 'hue' ? '°' : '');
        });
      }
    });

    document.querySelectorAll('.filter-pill-btn').forEach((btn) => {
      btn.addEventListener('click', () => applyPresetFilter(btn.dataset.filter));
    });
    document.getElementById('btn-apply-adjustments').addEventListener('click', () => {
      const b = parseInt(document.getElementById('adj-brightness').value);
      const c = parseInt(document.getElementById('adj-contrast').value);
      const h = parseInt(document.getElementById('adj-hue').value);
      const s = parseInt(document.getElementById('adj-saturation').value);
      applyAdjustments(b, c, h, s);
    });
    document.getElementById('btn-reset-adjustments').addEventListener('click', () => {
      ['brightness', 'contrast', 'hue', 'saturation', 'vibrance'].forEach((id) => {
        const el = document.getElementById(`adj-${id}`);
        if (el) el.value = 0;
        const valEl = document.getElementById(`val-adj-${id}`);
        if (valEl) valEl.innerText = '0' + (id === 'hue' ? '°' : '');
      });
    });

    // AI Studio
    document.getElementById('menu-ai-bg-remove').addEventListener('click', aiRemoveBackground);
    document.getElementById('btn-ai-remove-bg').addEventListener('click', aiRemoveBackground);
    document.getElementById('menu-ai-auto-enhance').addEventListener('click', aiAutoEnhance);
    document.getElementById('btn-ai-auto-enhance-tab').addEventListener('click', aiAutoEnhance);
    document.getElementById('menu-ai-inpaint').addEventListener('click', () => setActiveTool('inpaint'));

    // Social Media Presets
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        resizeDocument(parseInt(btn.dataset.w), parseInt(btn.dataset.h));
        fitToScreen();
        showToast(`Resized to ${btn.innerText}`);
      });
    });

    // View Menu
    document.getElementById('menu-zoom-in').addEventListener('click', () => setZoom(state.zoom * 1.25));
    document.getElementById('menu-zoom-out').addEventListener('click', () => setZoom(state.zoom / 1.25));
    document.getElementById('menu-zoom-100').addEventListener('click', () => setZoom(1.0));
    document.getElementById('menu-zoom-fit').addEventListener('click', fitToScreen);

    // Modal Events
    document.querySelectorAll('[data-close]').forEach((el) => {
      el.addEventListener('click', () => closeModal(el.dataset.close));
    });

    document.querySelectorAll('.preset-chips .chip-btn').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.getElementById('new-doc-w').value = chip.dataset.w;
        document.getElementById('new-doc-h').value = chip.dataset.h;
      });
    });

    document.getElementById('btn-confirm-new-doc').addEventListener('click', () => {
      const name = document.getElementById('new-doc-name').value.trim() || 'Untitled';
      const w = parseInt(document.getElementById('new-doc-w').value) || 1280;
      const h = parseInt(document.getElementById('new-doc-h').value) || 720;
      const bg = document.getElementById('new-doc-bg').value;

      state.docName = name;
      resizeDocument(w, h, false);
      layerManager.layers = [];
      const baseLayer = new Layer('Background', w, h, 'raster');
      if (bg !== 'transparent') {
        baseLayer.ctx.fillStyle = bg;
        baseLayer.ctx.fillRect(0, 0, w, h);
      }
      layerManager.addLayer(baseLayer);
      historyManager.pushState(`New Project`);
      closeModal('modal-new-doc');
      fitToScreen();
    });

    document.getElementById('btn-confirm-export').addEventListener('click', () => {
      const format = document.getElementById('export-format').value;
      const quality = parseInt(document.getElementById('export-quality').value) / 100;
      const scale = parseFloat(document.getElementById('export-scale').value);
      exportArtwork(format, quality, scale);
      closeModal('modal-export');
    });

    // Global Hotkeys
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        state.spacePressed = false;
        viewportContainer.classList.remove('panning');
      }
    });
  }

  function openModal(id) {
    document.getElementById(id).classList.add('open');
  }

  function closeModal(id) {
    document.getElementById(id).classList.remove('open');
  }

  function openExportModal() {
    const previewImg = document.getElementById('export-preview-img');
    previewImg.src = mainCanvas.toDataURL('image/png');
    document.getElementById('export-calc-dim').innerText = `${state.docWidth} × ${state.docHeight} px`;
    openModal('modal-export');
  }

  function handleKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    if (e.code === 'Space') {
      state.spacePressed = true;
      viewportContainer.classList.add('panning');
    }

    if (e.key === 'Escape') {
      layerManager.deselectActiveLayer();
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) historyManager.redo();
        else historyManager.undo();
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        historyManager.redo();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveProjectJSON();
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        openExportModal();
      } else if (e.key.toLowerCase() === '0') {
        e.preventDefault();
        fitToScreen();
      } else if (e.key.toLowerCase() === '1') {
        e.preventDefault();
        setZoom(1.0);
      } else if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        layerManager.deselectActiveLayer();
      }
      return;
    }

    const key = e.key.toLowerCase();
    if (key === 'v') setActiveTool('move');
    else if (key === 'b') setActiveTool('brush');
    else if (key === 'e') setActiveTool('eraser');
    else if (key === 'u') setActiveTool('shape');
    else if (key === 't') setActiveTool('text');
    else if (key === 'i') setActiveTool('eyedropper');
    else if (key === 'g') setActiveTool('bucket');
    else if (key === 'm') setActiveTool('marquee');
    else if (key === 'c') setActiveTool('crop');
    else if (key === 'x') document.getElementById('btn-swap-colors').click();
    else if (key === 'delete' || key === 'backspace') {
      const active = layerManager.getActiveLayer();
      if (active && active.type === 'raster') {
        if (state.selection) {
          active.ctx.clearRect(state.selection.x - active.x, state.selection.y - active.y, state.selection.w, state.selection.h);
        } else {
          active.ctx.clearRect(0, 0, active.width, active.height);
        }
        layerManager.render();
        historyManager.pushState('Clear Pixels');
      }
    }
  }

  // Bootstrap
  window.addEventListener('DOMContentLoaded', () => {
    initUI();
    loadSampleArtwork();
    if (window.lucide) lucide.createIcons();
  });
})();
