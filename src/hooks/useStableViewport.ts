import { useEffect } from "react";

// iOS WebView can leave document scroll offsets behind after keyboard and system viewport changes.
// Keep document-level scroll fixed; individual app panes own all real scrolling.
export function useStableViewport() {
  useEffect(() => {
    let frame = 0;
    const resetViewportPosition = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        if (viewportHeight > 0) {
          document.documentElement.style.setProperty("--app-viewport-height", `${viewportHeight}px`);
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
    };
    resetViewportPosition();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", resetViewportPosition);
    viewport?.addEventListener("scroll", resetViewportPosition);
    window.addEventListener("resize", resetViewportPosition);
    window.addEventListener("orientationchange", resetAfterKeyboardSettles);
    window.addEventListener("focusout", resetAfterKeyboardSettles);
    window.addEventListener("blur", resetAfterKeyboardSettles);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", resetViewportPosition);
      viewport?.removeEventListener("scroll", resetViewportPosition);
      window.removeEventListener("resize", resetViewportPosition);
      window.removeEventListener("orientationchange", resetAfterKeyboardSettles);
      window.removeEventListener("focusout", resetAfterKeyboardSettles);
      window.removeEventListener("blur", resetAfterKeyboardSettles);
    };
  }, []);
}
