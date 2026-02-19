(function () {
    let timeoutId;
    const TIMEOUT_DURATION = 3 * 60 * 1000; // 3分
    const REDIRECT_URL = 'start.html'; // 遷移先に合わせる

    function resetTimer() {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            window.location.href = REDIRECT_URL;
        }, TIMEOUT_DURATION);
    }

    // スクロールだけでなく、クリックやマウス移動、タッチも検知
    const events = ['scroll', 'mousedown', 'mousemove', 'keypress', 'touchstart'];
    
    events.forEach(event => {
        window.addEventListener(event, resetTimer, { passive: true });
    });

    resetTimer();
})();