import { useEffect } from "react";

// iOS WebView can leave document scroll offsets behind after keyboard and system viewport changes.
// Keep document-level scroll fixed; individual app panes own all real scrolling.
export function useStableViewport() {
  useEffect(() => {
    let frame = 0;
    let stableHeight = 0;
    let stableWidth = 0;

    const currentViewportSize = () => ({
      height: Math.round(Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0)),
      visualHeight: Math.round(window.visualViewport?.height || 0),
      visualOffsetTop: Math.round(window.visualViewport?.offsetTop || 0),
      width: Math.round(Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0, window.visualViewport?.width || 0)),
    });

    const hasTextInputFocus = () => {
      const active = document.activeElement;
      if (!active) return false;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return true;
      return active instanceof HTMLElement && active.isContentEditable;
    };

    const resetViewportPosition = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const {
          height: viewportHeight,
          visualHeight,
          visualOffsetTop,
          width: viewportWidth,
        } = currentViewportSize();
        if (viewportWidth > 0 && Math.abs(viewportWidth - stableWidth) > 2) {
          stableWidth = viewportWidth;
          stableHeight = viewportHeight;
        } else if (!stableWidth) {
          stableWidth = viewportWidth;
        }
        if (!stableHeight || viewportHeight > stableHeight) stableHeight = viewportHeight;

        const keyboardLikelyOpen =
          hasTextInputFocus() &&
          Boolean(window.visualViewport) &&
          (visualHeight < stableHeight - 80 || visualOffsetTop > 1 || viewportHeight < stableHeight - 80);
        const visualBottom = keyboardLikelyOpen && visualHeight > 0 ? visualHeight + visualOffsetTop : viewportHeight;
        const keyboardInset = keyboardLikelyOpen ? Math.max(0, (stableHeight || viewportHeight) - visualBottom) : 0;
        const appHeight = stableHeight || viewportHeight;

        document.body.classList.toggle("keyboard-open", keyboardLikelyOpen);
        if (appHeight > 0) {
          document.documentElement.style.setProperty("--app-viewport-height", `${appHeight}px`);
        }
        document.documentElement.style.setProperty("--keyboard-inset", `${keyboardInset}px`);
        if (keyboardLikelyOpen && document.activeElement instanceof HTMLElement) {
          document.activeElement.scrollIntoView({ block: "center", inline: "nearest" });
        }
        document.documentElement.scrollLeft = 0;
        document.documentElement.scrollTop = 0;
        document.body.scrollLeft = 0;
        document.body.scrollTop = 0;
        if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
      });
    };
    const resetAfterKeyboardSettles = () => {
      resetViewportPosition();
      window.setTimeout(resetViewportPosition, 80);
      window.setTimeout(resetViewportPosition, 220);
      window.setTimeout(resetViewportPosition, 420);
    };
    resetViewportPosition();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", resetViewportPosition);
    viewport?.addEventListener("scroll", resetViewportPosition);
    window.addEventListener("resize", resetViewportPosition);
    window.addEventListener("focusin", resetAfterKeyboardSettles);
    window.addEventListener("orientationchange", resetAfterKeyboardSettles);
    window.addEventListener("focusout", resetAfterKeyboardSettles);
    window.addEventListener("blur", resetAfterKeyboardSettles);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      document.body.classList.remove("keyboard-open");
      document.documentElement.style.removeProperty("--keyboard-inset");
      viewport?.removeEventListener("resize", resetViewportPosition);
      viewport?.removeEventListener("scroll", resetViewportPosition);
      window.removeEventListener("resize", resetViewportPosition);
      window.removeEventListener("focusin", resetAfterKeyboardSettles);
      window.removeEventListener("orientationchange", resetAfterKeyboardSettles);
      window.removeEventListener("focusout", resetAfterKeyboardSettles);
      window.removeEventListener("blur", resetAfterKeyboardSettles);
    };
  }, []);
}
