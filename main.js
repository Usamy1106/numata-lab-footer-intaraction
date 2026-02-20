// ============================================================
//  main.js — 沼田研究室 フッターカスタマイザー (2マス完全同期版)
// ============================================================

(function() {
    const yearEl = document.getElementById('js-current-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    const COLS = 5;
    let drag = null;

    /** ワークスペースの1マス幅と隙間を最新の状態で取得 */
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

    function colOf(slots, idx) {
        return idx % COLS;
    }

    /** 2マス要素が右端(5列目)で1マス分はみ出さないよう調整 */
    function resolveTwoBoxIndex(slots, idx) {
        const col = colOf(slots, idx);
        // 右端（4番目のインデックスなど）なら1つ左のスロットを起点にする
        if (col === COLS - 1) return Math.max(0, idx - 1);
        return idx;
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

        // 【修正】ドックにある時でも、ワークスペース基準の2マス幅を計算
        let targetWidth = metrics.width;
        if (isTwoBox(box)) {
            targetWidth = (metrics.width * 2) + metrics.gap;
        }

        // 指のタッチ位置を正確に維持
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        // ゴースト（クローン）の生成
        const ghost = box.cloneNode(true);
        ghost.classList.add('dragging-ghost');
        
        // 2マス分のスタイルを強制固定
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

        // 元の要素を透明化。スロットにある場合はその幅(span2)を維持してレイアウト崩れを防ぐ
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

    /* ---------- ドラッグ中（2マス分の青枠を表示） ---------- */
    function onPointerMove(e) {
        if (!drag) return;

        // 指の動きに吸い付く
        drag.ghost.style.left = (e.clientX - drag.offsetX) + 'px';
        drag.ghost.style.top = (e.clientY - drag.offsetY) + 'px';

        // ハイライト（青枠）のリセット
        document.querySelectorAll('.slot.highlight').forEach(s => s.classList.remove('highlight'));

        // 指の下のスロットを探す
        drag.ghost.style.visibility = 'hidden';
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const target = el?.closest('.slot');
        drag.ghost.style.visibility = 'visible';

        if (target) {
            const slots = getAllSlots();
            let idx = slots.indexOf(target);

            if (drag.isTwo) {
                // 【修正】追加時も入れ替え時も、2マス分のスロットを青枠で囲む
                idx = resolveTwoBoxIndex(slots, idx);
                slots[idx].classList.add('highlight');
                if (slots[idx + 1]) {
                    slots[idx + 1].classList.add('highlight');
                }
            } else {
                target.classList.add('highlight');
            }
        }
    }

    /* ---------- ドロップ処理 ---------- */
    function onPointerUp(e) {
        if (!drag) return;

        const { element, sourceSlot, isTwo } = drag;
        
        drag.ghost.style.visibility = 'hidden';
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const target = el?.closest('.slot');
        const isDock = el?.closest('#dock-container');
        drag.ghost.style.visibility = 'visible';

        // 配置開始前に元のスロット予約を一度解除
        if (sourceSlot) sourceSlot.classList.remove('slot--span2');

        if (target) {
            const slots = getAllSlots();
            let idx = slots.indexOf(target);

            if (isTwo) {
                // 2マスのドロップ位置を確定
                idx = resolveTwoBoxIndex(slots, idx);
                const targetSlot = slots[idx];
                const occupant = targetSlot.querySelector('.footer-box');

                // 入れ替え処理
                if (sourceSlot && occupant) {
                    if (isTwoBox(occupant)) {
                        targetSlot.classList.remove('slot--span2');
                        sourceSlot.classList.add('slot--span2');
                        sourceSlot.appendChild(occupant);
                    } else {
                        sourceSlot.appendChild(occupant);
                    }
                }
                // 配置
                targetSlot.classList.add('slot--span2');
                targetSlot.appendChild(element);
            } else {
                // 1マスのドロップ
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
            // 元の場所に戻す
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

    /* ---------- 初期バインドと監視 ---------- */
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