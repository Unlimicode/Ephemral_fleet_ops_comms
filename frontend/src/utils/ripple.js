export function attachRipple(element) {
    if (!element) return;
    const handler = function (e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const ripple = document.createElement('span');
        ripple.style.cssText = `
      position:absolute;width:150px;height:150px;
      border-radius:50%;background:rgba(255,255,255,0.25);
      left:${x - 75}px;top:${y - 75}px;
      animation:ripple 0.6s linear;pointer-events:none;
    `;
        this.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    };
    element.addEventListener('click', handler);
    return () => element.removeEventListener('click', handler);
}
