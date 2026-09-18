import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** New screen, top of the page — the native app behaviour people expect. */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
