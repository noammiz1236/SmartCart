import React, { useContext } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import NotificationBell from "./NotificationBell";

const NavBar = () => {
  const { user, setUser, loading, isLinkedChild } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await api.post("/api/logout");
      setUser(null);
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const isActive = (path) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(path);

  const allNavLinks = [
    { to: "/list", label: isLinkedChild ? "רשימות" : "הרשימות שלי", icon: "bi-clipboard-check" },
    { to: "/store", label: "חנות", icon: "bi-shop" },
    { to: "/templates", label: "תבניות", icon: "bi-files", parentOnly: true },
  ];
  const navLinks = allNavLinks.filter((link) => !link.parentOnly || !isLinkedChild);

  const bottomNavItems = user
    ? [
        { to: "/", label: "בית", icon: "bi-house-fill" },
        { to: "/list", label: "רשימות", icon: "bi-clipboard-check" },
        { to: "/store", label: "חנות", icon: "bi-shop" },
        ...(!isLinkedChild ? [{ to: "/templates", label: "תבניות", icon: "bi-files" }] : []),
        { to: "/profile", label: "הגדרות", icon: "bi-person-circle" },
      ]
    : [
        { to: "/", label: "בית", icon: "bi-house-fill" },
        { to: "/login", label: "כניסה", icon: "bi-box-arrow-in-right" },
        { to: "/register", label: "הרשמה", icon: "bi-person-plus" },
      ];

  return (
    <>
      {/* ── Top navbar ── */}
      <nav className="sc-navbar">
        <div className="d-flex align-items-center justify-content-between w-100">
          {/* Brand */}
          <Link className="sc-navbar-brand" to="/">
            <i className="bi bi-cart3 me-1"></i> SmartCart
          </Link>

          {/* Desktop nav links */}
          <div className="d-none d-lg-flex align-items-center gap-2 flex-grow-1 justify-content-center">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                className={`sc-nav-link ${isActive(link.to) ? "active" : ""}`}
                to={link.to}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop user section */}
          <div className="d-none d-lg-flex align-items-center gap-2">
            {loading ? null : user ? (
              <>
                <span
                  className="fw-semibold"
                  style={{ color: "var(--sc-primary)", fontSize: "0.9rem" }}
                >
                  {user.first_name}
                </span>
                {!isLinkedChild && <NotificationBell />}
                <Link
                  className="sc-icon-btn"
                  to="/profile"
                  title="הגדרות"
                  style={{ textDecoration: "none" }}
                >
                  <i className="bi bi-gear"></i>
                </Link>
                <button
                  className="sc-btn sc-btn-ghost"
                  onClick={handleLogout}
                  style={{ padding: "6px 14px", fontSize: "0.85rem" }}
                >
                  התנתק
                </button>
              </>
            ) : (
              <>
                <Link className="sc-nav-link" to="/login">
                  התחברות
                </Link>
                <Link
                  className="sc-btn sc-btn-primary"
                  to="/register"
                  style={{ textDecoration: "none", padding: "6px 18px", fontSize: "0.85rem" }}
                >
                  הרשמה
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="sc-bottom-nav d-lg-none" dir="rtl" aria-label="ניווט תחתון">
        <div className="sc-bottom-nav-inner">
          {bottomNavItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`sc-bottom-nav-item ${isActive(item.to) ? "active" : ""}`}
            >
              <i className={`bi ${item.icon}`}></i>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
};

export default NavBar;
