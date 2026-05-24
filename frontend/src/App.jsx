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
    function handlePointerMove(event) {
      const x = `${(event.clientX / window.innerWidth) * 100}%`;
      const y = `${(event.clientY / window.innerHeight) * 100}%`;
      document.documentElement.style.setProperty("--mx", x);
      document.documentElement.style.setProperty("--my", y);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  return (
    <div className="app-shell">
      <div className="spotlight" />
      <div className="scanline" />
      <div className="grid-overlay" />
      <div className="ambient-noise" />
      <header className="topbar">
        <Link className="logo" to="/">
          <span className="logo-bracket">[</span>
          <span className="logo-s">V</span>eraAudit
          <span className="logo-bracket">]</span>
        </Link>
        <nav className="tabs">
          <NavLink end className={({ isActive }) => `tab-btn ${isActive ? "tab-btn-active" : ""}`} to="/">
            Landing
          </NavLink>
          <NavLink className={({ isActive }) => `tab-btn ${isActive ? "tab-btn-active" : ""}`} to="/audit">
            Audit
          </NavLink>
        </nav>
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
        <p>made with &lt;3 by anoop</p>
      </footer>
    </div>
  );
}
