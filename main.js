// ============================================================
//  main.js — 沼田研究室 フッターカスタマイザー (上下左右はみ出し完全防止版)
// ============================================================

(function() {
    const yearEl = document.getElementById('js-current-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    const COLS = 5;
    let drag = null;

    function getWorkspaceMetrics() {
        const slots = Array.from(document.querySelectorAll('#workspace .slot'));
        if (slots.length < 2) return { width: 150, gap: 10 };
        const rect1 = slots[0].getBoundingClientRect();
        const rect2 = slots[1].getBoundingClientRect();
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

    function colOf(idx) { return idx % COLS; }
    function rowOf(idx) { return Math.floor(idx / COLS); }

    /** * 2マス要素の配置範囲を行（Row）の中に閉じ込める
     */
    function resolveTwoBoxIndex(slots, idx) {
        const col = colOf(idx);
        const row = rowOf(idx);
        
        let targetIdx = idx;

        // 右端（5列目）なら1つ左へ
        if (col === COLS - 1) {
            targetIdx = idx - 1;
        }

        // 【修正】左端の境界チェック：計算した結果が「上の行」にはみ出さないようにガード
        if (rowOf(targetIdx) !== row) {
            targetIdx = row * COLS; 
        }
        
        // 最終的なインデックスが配列外にならないよう丸める
        return Math.max(0, Math.min(targetIdx, slots.length - 2));
    }

    /* ---------- ドラッグ開始 ---------- */
    function onPointerDown(e) {
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

    /* ---------- ドラッグ中（行内制限ハイライト） ---------- */
    function onPointerMove(e) {
        if (!drag) return;

        drag.ghost.style.left = (e.clientX - drag.offsetX) + 'px';
        drag.ghost.style.top = (e.clientY - drag.offsetY) + 'px';

        document.querySelectorAll('.slot.highlight').forEach(s => s.classList.remove('highlight'));

        drag.ghost.style.visibility = 'hidden';
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const target = el?.closest('.slot');
        drag.ghost.style.visibility = 'visible';

        if (target) {
            const slots = getAllSlots();
            let idx = slots.indexOf(target);

            if (drag.isTwo) {
                // 同じ行内だけでスライドするようにインデックスを解決
                idx = resolveTwoBoxIndex(slots, idx);
                slots[idx].classList.add('highlight');
                if (slots[idx + 1]) slots[idx + 1].classList.add('highlight');
            } else {
                target.classList.add('highlight');
            }
        }
    }

    /* ---------- ドロップ ---------- */
    function onPointerUp(e) {
        if (!drag) return;

        const { element, sourceSlot, isTwo } = drag;
        
        drag.ghost.style.visibility = 'hidden';
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const target = el?.closest('.slot');
        const isDock = el?.closest('#dock-container');
        drag.ghost.style.visibility = 'visible';

        if (sourceSlot) sourceSlot.classList.remove('slot--span2');

        if (target) {
            const slots = getAllSlots();
            let idx = slots.indexOf(target);

            if (isTwo) {
                idx = resolveTwoBoxIndex(slots, idx);
                const targetSlot = slots[idx];
                const occupant = targetSlot.querySelector('.footer-box');

                if (sourceSlot && occupant) {
                    if (isTwoBox(occupant)) {
                        targetSlot.classList.remove('slot--span2');
                        sourceSlot.classList.add('slot--span2');
                        sourceSlot.appendChild(occupant);
                    } else {
                        sourceSlot.appendChild(occupant);
                    }
                }
                targetSlot.classList.add('slot--span2');
                targetSlot.appendChild(element);
            } else {
                const occupant = target.querySelector('.footer-box');
                if (sourceSlot && occupant) {
                    if (isTwoBox(occupant)) {
                        target.classList.remove('slot--span2');
                        sourceSlot.classList.add('slot--span2');
                        sourceSlot.appendChild(occupant);
                    } else {
                        sourceSlot.appendChild(occupant);
                    }
                }
                target.appendChild(element);
            }
        } else if (isDock) {
            document.getElementById('dock').appendChild(element);
        } else if (sourceSlot) {
            if (isTwo) sourceSlot.classList.add('slot--span2');
            sourceSlot.appendChild(element);
        }

        cleanup();
    }

    function cleanup() {
        if (!drag) return;
        drag.ghost.remove();
        drag.element.style.opacity = '1';
        document.querySelectorAll('.slot.highlight').forEach(s => s.classList.remove('highlight'));
        drag = null;
    }

    function bindDrag(box) {
        if (box.dataset.dragBound) return;
        box.dataset.dragBound = '1';
        box.style.touchAction = 'none';
        box.addEventListener('pointerdown', onPointerDown);
    }

    document.querySelectorAll('.footer-box').forEach(bindDrag);

    const observer = new MutationObserver(m => {
        m.forEach(r => r.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
                if (node.classList.contains('footer-box')) bindDrag(node);
                node.querySelectorAll?.('.footer-box').forEach(bindDrag);
            }
        }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();