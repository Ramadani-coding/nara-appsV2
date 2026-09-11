import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // Disable automatic browser scroll restoration so router navigation coordinates cleanly
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    if (hash) {
      const rawTarget = hash.replace("#", "");
      // Support aliases for category/catalog sections
      const targetId =
        rawTarget === "kategori" || rawTarget === "katalog"
          ? "categories-filter"
          : rawTarget;

      const performScroll = () => {
        const el =
          document.getElementById(targetId) || document.getElementById(rawTarget);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
          return true;
        }
        return false;
      };

      // Try immediately; if DOM hasn't rendered yet (e.g. cross-page route change), retry after short delay
      if (!performScroll()) {
        const timer = setTimeout(performScroll, 120);
        return () => clearTimeout(timer);
      }
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname, hash]);

  return null;
}
