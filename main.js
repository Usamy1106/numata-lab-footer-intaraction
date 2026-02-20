// ============================================================
//  main.js — 沼田研究室 フッターカスタマイザー (iPad対応)
//  two-box (横2マス) 対応版
// ============================================================

/* ---------- 西暦の自動更新 ---------- */
const yearEl = document.getElementById('js-current-year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ---------- 定数 ---------- */
const COLS = 5;

/* ---------- 状態 ---------- */
let drag = null;

/* ---------- ユーティリティ ---------- */

function realElementAt(x, y) {
  if (drag?.ghost) drag.ghost.style.visibility = 'hidden';
  const el = document.elementFromPoint(x, y);
  if (drag?.ghost) drag.ghost.style.visibility = '';
  return el;
}

function slotAt(x, y) {
  return realElementAt(x, y)?.closest('.slot') ?? null;
}

function isOverDock(x, y) {
  const r = document.getElementById('dock-container').getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function isTwoBox(box) {
  return box?.classList.contains('two-box');
}

function getAllSlots() {
  return Array.from(document.querySelectorAll('#workspace .slot'));
}

/** スロットの列番号を返す (0-indexed) */
function colOf(slots, idx) {
  return idx % COLS;
}

/* ---------- two-box のスロット管理 ---------- */

/** two-box をスロットに置く：slot--span2 を付与するだけ */
function placeTwoBox(slot, box) {
  clearTwoBoxSlot(slot);
  slot.classList.add('slot--span2');
  slot.appendChild(box);
}

/** two-box をスロットから外す：slot--span2 を解除するだけ */
function clearTwoBoxSlot(slot) {
  slot.classList.remove('slot--span2');
}

/* ---------- 右ずらし（two-box の行折り返し対応） ---------- */

/**
 * fromSlot を起点に右へ1マスずらす。
 * ずらす要素が two-box かつ行末なら次の行先頭へ折り返す。
 * 空きがなければ末尾要素をdockへ返す。
 */
function shiftRight(fromSlot) {
  const slots    = getAllSlots();
  const startIdx = slots.indexOf(fromSlot);
  if (startIdx === -1) return;

  // fromSlot を空にするため、最初の「空きスロット」を探す
  // two-box が行末にある場合は次行先頭を空きとして扱う
  let emptyIdx = findEmptyForShift(slots, startIdx);

  if (emptyIdx === -1) {
    // 全部埋まっている → 末尾の要素をdockへ逃がす
    let lastFilledIdx = startIdx;
    for (let i = startIdx + 1; i < slots.length; i++) {
      if (slots[i].querySelector('.footer-box')) lastFilledIdx = i;
    }
    const lastBox = slots[lastFilledIdx].querySelector('.footer-box');
    if (isTwoBox(lastBox)) clearTwoBoxSlot(slots[lastFilledIdx]);
    document.getElementById('dock').appendChild(lastBox);
    emptyIdx = lastFilledIdx;
  }

  // emptyIdx ← emptyIdx-1 ← … ← startIdx+1 と右へ1マスずつ移動
  // two-box は span を付け直す
  for (let i = emptyIdx; i > startIdx; i--) {
    const prevSlot = slots[i - 1];
    const box = prevSlot.querySelector('.footer-box');
    if (!box) continue;

    if (isTwoBox(box)) {
      const col = colOf(slots, i - 1);
      if (col >= COLS - 1) {
        // two-box が行末 → 次行先頭（i+1 ではなく行頭）へ
        // この場合は既に emptyIdx がそこを指しているはずなので
        // 単純に次スロットへ置く
        clearTwoBoxSlot(prevSlot);
        placeTwoBox(slots[i], box);
      } else {
        clearTwoBoxSlot(prevSlot);
        placeTwoBox(slots[i], box);
      }
    } else {
      slots[i].appendChild(box);
    }
  }
}

/**
 * startIdx の右から最初の空きスロットを返す。
 * two-box が行末にある場合、次行の先頭を「空き候補」として探す。
 */
function findEmptyForShift(slots, startIdx) {
  for (let i = startIdx + 1; i < slots.length; i++) {
    if (!slots[i].querySelector('.footer-box')) return i;
  }
  return -1;
}

/* ---------- two-box の配置先インデックスを解決 ---------- */

/**
 * two-boxを置くとき、列末(COLS-1)なら次行先頭、
 * COLS-2 より右なら1つ左に調整して2マス収まる位置にする。
 */
function resolveTwoBoxIndex(slots, idx) {
  const col = colOf(slots, idx);
  if (col === COLS - 1) {
    // 5列目 → 次行先頭（存在すれば）
    const nextRowStart = idx - col + COLS;
    return nextRowStart < slots.length ? nextRowStart : idx - 1;
  }
  return idx;
}

/* ---------- ドラッグ開始 ---------- */

function onPointerDown(e) {
  const box = e.target.closest('.footer-box');
  if (!box || box.classList.contains('dragging-ghost')) return;

  e.preventDefault();
  e.stopPropagation();

  const slot = box.closest('.slot');
  if (isTwoBox(box) && slot) clearTwoBoxSlot(slot);

  const rect    = box.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;

  const ghost = box.cloneNode(true);
  ghost.classList.add('dragging-ghost');

  // two-box のゴーストは1スロット分の幅（実寸の半分）
  const ghostWidth = rect.width;

  ghost.style.cssText = `
    position: fixed;
    z-index: 9999;
    pointer-events: auto;
    opacity: 0.85;
    transform: scale(1.05);
    box-shadow: 0 12px 24px rgba(0,0,0,0.3);
    width: ${ghostWidth}px;
    height: ${rect.height}px;
    left: ${e.clientX - offsetX}px;
    top: ${e.clientY - offsetY}px;
    margin: 0;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  `;
  document.body.appendChild(ghost);

  box.style.opacity = '0.25';

  // ドラッグ中はテキスト・画像の選択を無効化
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';

  drag = {
    element:    box,
    sourceSlot: slot ?? null,
    ghost,
    offsetX,
    offsetY,
  };

  ghost.setPointerCapture(e.pointerId);
  ghost.addEventListener('pointermove',   onPointerMove,   { passive: false });
  ghost.addEventListener('pointerup',     onPointerUp);
  ghost.addEventListener('pointercancel', onPointerCancel);
}

/* ---------- ドラッグ中 ---------- */

function onPointerMove(e) {
  if (!drag) return;
  e.preventDefault();

  drag.ghost.style.left = (e.clientX - drag.offsetX) + 'px';
  drag.ghost.style.top  = (e.clientY - drag.offsetY) + 'px';

  document.querySelectorAll('.slot.highlight')
    .forEach(s => s.classList.remove('highlight'));
  const target = slotAt(e.clientX, e.clientY);
  if (target) target.classList.add('highlight');
}

/* ---------- ドロップ ---------- */

function onPointerUp(e) {
  if (!drag) return;

  const { element, sourceSlot } = drag;
  const x = e.clientX, y = e.clientY;

  cleanup();

  const dock = document.getElementById('dock');
  let targetSlot = slotAt(x, y);

  if (targetSlot) {
    const slots = getAllSlots();

    if (isTwoBox(element)) {
      // ── two-box のドロップ ──
      let idx = slots.indexOf(targetSlot);
      idx = resolveTwoBoxIndex(slots, idx);
      targetSlot = slots[idx];

      const occupant = targetSlot.querySelector('.footer-box');
      if (sourceSlot) {
        // workspace → workspace: スワップ
        if (occupant) {
          if (isTwoBox(occupant)) {
            clearTwoBoxSlot(targetSlot);
            placeTwoBox(sourceSlot, occupant); // two-box は span2 を付け直して戻す
          } else {
            sourceSlot.appendChild(occupant);
          }
        }
      } else {
        // dock → workspace: 右にずらす
        if (occupant) shiftRight(targetSlot);
      }
      placeTwoBox(targetSlot, element);

    } else {
      // ── 通常 box のドロップ ──
      const occupant = targetSlot.querySelector('.footer-box');
      if (sourceSlot) {
        // workspace → workspace: スワップ
        if (occupant) {
          if (isTwoBox(occupant)) {
            clearTwoBoxSlot(targetSlot);
            placeTwoBox(sourceSlot, occupant); // two-box は span2 を付け直して戻す
          } else {
            sourceSlot.appendChild(occupant);
          }
        }
      } else {
        // dock → workspace: 右にずらす
        if (occupant) shiftRight(targetSlot);
      }
      targetSlot.appendChild(element);
    }

  } else if (isOverDock(x, y)) {
    if (sourceSlot) dock.appendChild(element);

  } else {
    // 範囲外: 元の位置に戻す
    if (sourceSlot) {
      if (isTwoBox(element)) placeTwoBox(sourceSlot, element);
      else sourceSlot.appendChild(element);
    }
  }
}

/* ---------- キャンセル ---------- */

function onPointerCancel() {
  if (!drag) return;
  const { sourceSlot, element } = drag;
  cleanup();
  if (sourceSlot) {
    if (isTwoBox(element)) placeTwoBox(sourceSlot, element);
    else sourceSlot.appendChild(element);
  }
}

/* ---------- 後始末 ---------- */

function cleanup() {
  if (!drag) return;

  drag.ghost.removeEventListener('pointermove',   onPointerMove);
  drag.ghost.removeEventListener('pointerup',     onPointerUp);
  drag.ghost.removeEventListener('pointercancel', onPointerCancel);
  drag.ghost.remove();
  drag.element.style.opacity = '';

  // テキスト・画像の選択を再び有効化
  document.body.style.userSelect = '';
  document.body.style.webkitUserSelect = '';

  document.querySelectorAll('.slot.highlight')
    .forEach(s => s.classList.remove('highlight'));

  drag = null;
}

/* ---------- イベント登録 ---------- */

function bindDrag(box) {
  if (box.dataset.dragBound) return;
  box.dataset.dragBound = '1';
  box.style.touchAction = 'none';
  box.addEventListener('pointerdown', onPointerDown, { passive: false });
}

document.querySelectorAll('.footer-box').forEach(bindDrag);

const observer = new MutationObserver((mutations) => {
  mutations.forEach(m => {
    m.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.classList.contains('footer-box')) bindDrag(node);
      node.querySelectorAll?.('.footer-box').forEach(bindDrag);
    });
  });
});
observer.observe(document.getElementById('workspace'), { childList: true, subtree: true });
observer.observe(document.getElementById('dock'),      { childList: true, subtree: true });