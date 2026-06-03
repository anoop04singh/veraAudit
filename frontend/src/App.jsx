import { useEffect } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { LandingPage } from "./pages/LandingPage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { AuditPage } from "./pages/AuditPage.jsx";
import { VerifyPage } from "./pages/VerifyPage.jsx";

export function App() {
  const location = useLocation();

  useEffect(() => {
    let frameId = 0;
    let pointerX = window.innerWidth * 0.5;
    let pointerY = window.innerHeight * 0.5;

    function flushPointerPosition() {
      frameId = 0;
      const x = `${(pointerX / window.innerWidth) * 100}%`;
      const y = `${(pointerY / window.innerHeight) * 100}%`;
      document.documentElement.style.setProperty("--mx", x);
      document.documentElement.style.setProperty("--my", y);
    }

    function handlePointerMove(event) {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!frameId) frameId = requestAnimationFrame(flushPointerPosition);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className="app-shell">
      <div className="spotlight" />
      <div className="scanline" />
      <div className="grid-overlay" />
      <div className="ambient-noise" />

      <header className="topbar">
        <div className="topbar-inner section">
          <div className="topbar-left">
            <Link className="logo" to="/">
              <img className="logo-mark logo-mark-transparent" src="/vera-logo-transparent.png" alt="VeraAudit" />
            </Link>
            <p className="topbar-meta mono">VERAAUDIT</p>
          </div>

          <div className="topbar-right">
            <p className="topbar-note mono">TATUM + WALRUS + SUI</p>
            <nav className="tabs">
              <NavLink end className={({ isActive }) => `tab-btn ${isActive ? "tab-btn-active" : ""}`} to="/">
                Home
              </NavLink>
              <NavLink className={({ isActive }) => `tab-btn ${isActive ? "tab-btn-active" : ""}`} to="/audit">
                Audit History
              </NavLink>
            </nav>
          </div>
        </div>
      </header>

      <main>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <Routes location={location}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/audit" element={<HomePage />} />
              <Route path="/audit/:contractId" element={<AuditPage />} />
              <Route path="/verify/:blobId" element={<VerifyPage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="site-footer">
        <p>made with &lt;3 by <a href="https://github.com/anoop04singh" target="_blank" rel="noopener noreferrer">
          anoop
        </a></p>
      </footer>
    </div>
  );
}
