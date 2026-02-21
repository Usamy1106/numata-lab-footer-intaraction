// ============================================================
//  main.js — 沼田研究室 フッターカスタマイザー (グリッド崩れ完全防止版)
// ============================================================

(function() {
    const yearEl = document.getElementById('js-current-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    const COLS = 5;
    let drag = null;

    function getWorkspaceMetrics() {
        const slots = Array.from(document.querySelectorAll('#workspace .slot'));
        // 非表示になっていないスロットを基準に計算
        const visibleSlots = slots.filter(s => s.style.display !== 'none');
        if (visibleSlots.length < 2) return { width: 150, gap: 10 };
        const rect1 = visibleSlots[0].getBoundingClientRect();
        const rect2 = visibleSlots[1].getBoundingClientRect();
        return {
            width: rect1.width,
            gap: rect2.left - rect1.right
        };
    }

    function isTwoBox(box) {
        return box?.classList.contains('two-box');
    }

    function getAllSlots() {
        return Array.from(document.querySelectorAll('#workspace .slot'));
    }

    function colOf(slots, idx) {
        return idx % COLS;
    }

    function resolveTwoBoxIndex(slots, idx) {
        const col = colOf(slots, idx);
        if (col === COLS - 1) return Math.max(0, idx - 1);
        return idx;
    }

    /** * 全スロットの状態を整理する 
     * 2マス要素がある場所の隣のスロットを隠し、マスが増えないようにする
     */
    function refreshGridLayout() {
        const slots = getAllSlots();
        // 一旦全スロットを表示し、スパンを解除
        slots.forEach(s => {
            s.style.display = '';
            s.classList.remove('slot--span2');
        });

        slots.forEach((slot, idx) => {
            const box = slot.querySelector('.footer-box');
            if (box && isTwoBox(box)) {
                slot.classList.add('slot--span2');
                const nextSlot = slots[idx + 1];
                // 隣のスロットが存在し、かつ同じ行であれば隠す
                if (nextSlot && colOf(slots, idx) < COLS - 1) {
                    nextSlot.style.display = 'none';
                }
            }
        });
    }

    function cleanup() {
        if (drag) {
            if (drag.ghost) drag.ghost.remove();
            if (drag.element) drag.element.style.opacity = '1';
        }
        document.querySelectorAll('.slot.highlight').forEach(s => s.classList.remove('highlight'));
        document.querySelectorAll('.dragging-ghost').forEach(el => el.remove());
        drag = null;
        refreshGridLayout(); // ドラッグ終了後にレイアウトを再整列
    }

    /* ---------- ドラッグ開始 ---------- */
    function onPointerDown(e) {
        if (drag) {
            cleanup();
            return;
        }

        const box = e.target.closest('.footer-box');
        if (!box || box.classList.contains('dragging-ghost')) return;

        e.preventDefault();
        e.stopPropagation();

        const metrics = getWorkspaceMetrics();
        const slot = box.closest('.slot');
        const rect = box.getBoundingClientRect();

        let targetWidth = metrics.width;
        if (isTwoBox(box)) {
            targetWidth = (metrics.width * 2) + metrics.gap;
        }

        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        const ghost = box.cloneNode(true);
        ghost.classList.add('dragging-ghost');
        
        ghost.style.cssText = `
            position: fixed;
            z-index: 10000;
            pointer-events: none;
            opacity: 0.9;
            transform: scale(1.05);
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            width: ${targetWidth}px;
            height: ${rect.height}px;
            left: ${e.clientX - offsetX}px;
            top: ${e.clientY - offsetY}px;
            margin: 0;
            box-sizing: border-box;
        `;
        document.body.appendChild(ghost);

        box.style.opacity = '0';

        drag = {
            element: box,
            sourceSlot: slot ?? null,
            ghost,
            offsetX,
            offsetY,
            isTwo: isTwoBox(box)
        };

        ghost.setPointerCapture(e.pointerId);
        ghost.addEventListener('pointermove', onPointerMove);
        ghost.addEventListener('pointerup', onPointerUp);
        ghost.addEventListener('pointercancel', cleanup);
    }

    /* ---------- ドラッグ中 ---------- */
    function onPointerMove(e) {
        if (!drag) return;

        drag.ghost.style.left = (e.clientX - drag.offsetX) + 'px';
        drag.ghost.style.top = (e.clientY - drag.offsetY) + 'px';

        document.querySelectorAll('.slot.highlight').forEach(s => s.classList.remove('highlight'));

        drag.ghost.style.visibility = 'hidden';
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const targetSlot = el?.closest('.slot');
        drag.ghost.style.visibility = 'visible';

        if (targetSlot) {
            const slots = getAllSlots();
            let idx = slots.indexOf(targetSlot);
            if (drag.isTwo) {
                idx = resolveTwoBoxIndex(slots, idx);
                slots[idx].classList.add('highlight');
                // 隣のスロットが非表示でも、ハイライトのために一時的に隣も光らせる
                if (slots[idx + 1]) slots[idx + 1].classList.add('highlight');
            } else {
                targetSlot.classList.add('highlight');
            }
        }
    }

    /* ---------- ドロップ ---------- */
    function onPointerUp(e) {
        if (!drag) return;

        const { element, sourceSlot, isTwo } = drag;
        
        drag.ghost.style.visibility = 'hidden';
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const targetSlot = el?.closest('.slot');
        const isDock = el?.closest('#dock-container');
        drag.ghost.style.visibility = 'visible';

        if (targetSlot) {
            const slots = getAllSlots();
            let idx = slots.indexOf(targetSlot);

            if (isTwo) {
                idx = resolveTwoBoxIndex(slots, idx);
                const actualTarget = slots[idx];
                const occupant = actualTarget.querySelector('.footer-box');

                if (sourceSlot && occupant) {
                    sourceSlot.appendChild(occupant);
                }
                actualTarget.appendChild(element);
            } else {
                const occupant = targetSlot.querySelector('.footer-box');
                if (sourceSlot && occupant) {
                    sourceSlot.appendChild(occupant);
                }
                targetSlot.appendChild(element);
            }
        } else if (isDock) {
            if (sourceSlot) {
                document.getElementById('dock').appendChild(element);
            }
        }

        cleanup();
    }

    /* ---------- 初期化 ---------- */
    function bindDrag(box) {
        if (box.dataset.dragBound) return;
        box.dataset.dragBound = '1';
        box.setAttribute('draggable', 'false');
        box.style.touchAction = 'none';
        box.addEventListener('pointerdown', onPointerDown);
    }

    document.querySelectorAll('.footer-box').forEach(bindDrag);

    const observer = new MutationObserver(() => {
        document.querySelectorAll('.footer-box').forEach(bindDrag);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 初期ロード時に一度整列
    refreshGridLayout();

})();