import React, { useContext, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import api from "../api";

const Home = () => {
  const { user, isLinkedChild } = useContext(AuthContext);
  const [lists, setLists] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoadingLists(true);
    api
      .get("/api/lists")
      .then(({ data }) => setLists(data.lists || []))
      .catch(() => {})
      .finally(() => setLoadingLists(false));
  }, [user]);

  /* ── Logged-out landing ─────────────────────────────────── */
  if (!user) {
    return (
      <div className="page-fade-in" dir="rtl">
        {/* Hero */}
        <div className="sc-hero text-center py-5">
          <div className="container py-4" style={{ position: "relative", zIndex: 1 }}>
            {/* Badge */}
            <div
              className="d-inline-flex align-items-center gap-2 mb-4 px-3 py-2"
              style={{
                background: "rgba(255,255,255,0.15)",
                borderRadius: "20px",
                color: "#bfdbfe",
                fontSize: "0.82rem",
                fontWeight: 500,
                backdropFilter: "blur(4px)",
              }}
            >
              <i className="bi bi-tag-fill" style={{ fontSize: "0.75rem" }}></i>
              <span>השוואת מחירים חכמה</span>
            </div>

            <h1
              className="fw-bold mb-3"
              style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", lineHeight: 1.15 }}
            >
              חסכו כסף על כל קנייה
            </h1>
            <p
              className="mb-2"
              style={{ fontSize: "clamp(1rem, 2.5vw, 1.25rem)", opacity: 0.85, maxWidth: "560px", margin: "0 auto" }}
            >
              SmartCart משווה מחירים בין כל רשתות השיווק בישראל
            </p>
            <p
              className="mb-4"
              style={{ fontSize: "clamp(1rem, 2.5vw, 1.25rem)", opacity: 0.75, maxWidth: "560px", margin: "0 auto 2rem" }}
            >
              ועוזר לכם למצוא את הסל הזול ביותר
            </p>

            <div className="d-flex gap-3 justify-content-center flex-wrap">
              <Link
                to="/register"
                className="sc-btn"
                style={{
                  background: "white",
                  color: "var(--sc-primary)",
                  padding: "13px 32px",
                  fontSize: "1rem",
                  fontWeight: 700,
                  borderRadius: "8px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                }}
              >
                התחל עכשיו בחינם
              </Link>
              <Link
                to="/login"
                className="sc-btn"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  color: "white",
                  border: "1.5px solid rgba(255,255,255,0.35)",
                  padding: "13px 32px",
                  fontSize: "1rem",
                  borderRadius: "8px",
                }}
              >
                כבר יש לי חשבון
              </Link>
            </div>
          </div>
        </div>

        {/* Features */}
        <div style={{ background: "var(--sc-bg)", paddingTop: "5rem", paddingBottom: "4rem" }}>
          <div className="container">
            <div className="text-center mb-5">
              <h2 className="fw-bold mb-2" style={{ color: "var(--sc-text)", fontSize: "clamp(1.4rem, 3vw, 2rem)" }}>
                למה SmartCart?
              </h2>
              <p style={{ color: "var(--sc-text-muted)", fontSize: "1rem" }}>
                כל הכלים שאתם צריכים לקניה חכמה
              </p>
            </div>

            <div className="row g-4">
              {[
                {
                  icon: "bi-graph-up-arrow",
                  title: "השוואת מחירים בזמן אמת",
                  desc: "משווים מחירים מרמי לוי, שופרסל, ויקטורי ועוד — הכל במקום אחד",
                },
                {
                  icon: "bi-cart3",
                  title: "ניהול רשימות קניות",
                  desc: "צרו רשימות קניות, שתפו עם בני המשפחה וקבלו תמיד את ההצעה הטובה ביותר",
                },
                {
                  icon: "bi-bell",
                  title: "התראות מחיר",
                  desc: "קבלו התראה כשמחיר מוצר שאתם אוהבים יורד — אף פעם אל תחמיצו מבצע",
                },
              ].map((f, i) => (
                <div key={i} className="col-md-4">
                  <div
                    className="sc-card sc-card-interactive h-100"
                    style={{ padding: "2rem", borderRadius: "var(--sc-radius)" }}
                  >
                    <div className="sc-feature-icon">
                      <i
                        className={`bi ${f.icon}`}
                        style={{ fontSize: "1.5rem", color: "var(--sc-primary)" }}
                      ></i>
                    </div>
                    <h5 className="fw-bold mb-2" style={{ color: "var(--sc-text)" }}>
                      {f.title}
                    </h5>
                    <p style={{ color: "var(--sc-text-muted)", fontSize: "0.9rem", lineHeight: 1.65, margin: 0 }}>
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Logged-in dashboard ────────────────────────────────── */
  const allQuickActions = [
    { to: "/list",      icon: "bi-clipboard-check", label: "הרשימות שלי", color: "#2563eb" },
    { to: "/store",     icon: "bi-shop",            label: "חנות",         color: "#0ea5e9" },
    { to: "/templates", icon: "bi-files",           label: "תבניות",       color: "#7c3aed", parentOnly: true },
    { to: "/profile",   icon: "bi-gear",            label: "הגדרות",       color: "#64748b" },
  ];

  const quickActions = allQuickActions.filter(
    (action) => !action.parentOnly || !isLinkedChild
  );

  return (
    <div className="page-fade-in" dir="rtl">
      <div className="container py-4">

        {/* Welcome banner */}
        <div className="sc-welcome-banner mb-4">
          <div
            className="d-flex align-items-center justify-content-between flex-wrap gap-3"
            style={{ position: "relative", zIndex: 1 }}
          >
            <div>
              <h2 className="fw-bold mb-1" style={{ color: "white", fontSize: "1.5rem" }}>
                שלום, {user.first_name}! 👋
              </h2>
              <p style={{ color: "#bfdbfe", margin: 0, fontSize: "0.9rem" }}>
                {lists.length > 0
                  ? `יש לך ${lists.length} רשימות קניות פעילות`
                  : "מה נקנה היום?"}
              </p>
            </div>
            {!isLinkedChild && (
              <Link
                to="/list"
                className="sc-btn"
                style={{
                  background: "white",
                  color: "var(--sc-primary)",
                  fontWeight: 700,
                  padding: "9px 22px",
                  fontSize: "0.9rem",
                  borderRadius: "8px",
                  flexShrink: 0,
                }}
              >
                <i className="bi bi-plus-lg me-1"></i> רשימה חדשה
              </Link>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="row g-3 mb-4">
          {quickActions.map((a) => (
            <div key={a.to} className="col-6 col-md-3">
              <Link to={a.to} className="sc-quick-action-card text-decoration-none">
                <div
                  className="sc-quick-action-icon"
                  style={{ background: `${a.color}14` }}
                >
                  <i
                    className={`bi ${a.icon}`}
                    style={{ fontSize: "1.3rem", color: a.color }}
                  ></i>
                </div>
                <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--sc-text)" }}>
                  {a.label}
                </span>
              </Link>
            </div>
          ))}
        </div>

        {/* Recent Lists */}
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="sc-section-title">הרשימות שלי</h5>
            <Link
              to="/list"
              className="sc-btn sc-btn-ghost"
              style={{ fontSize: "0.8rem", padding: "5px 14px" }}
            >
              הצג הכל
            </Link>
          </div>

          {loadingLists ? (
            <div className="text-center py-4">
              <div className="sc-spinner" style={{ margin: "0 auto" }}></div>
            </div>
          ) : lists.length === 0 ? (
            <div className="sc-card">
              <div className="sc-empty" style={{ padding: "2rem" }}>
                <p style={{ color: "var(--sc-text-muted)" }}>
                  {isLinkedChild ? "אין רשימות עדיין" : "אין לך רשימות עדיין"}
                </p>
                {!isLinkedChild && (
                  <Link to="/list" className="sc-btn sc-btn-primary">
                    <i className="bi bi-plus-lg me-1"></i> צור רשימה חדשה
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="row g-3">
              {lists.slice(0, 6).map((list) => (
                <div key={list.id} className="col-md-6 col-lg-4">
                  <Link to={`/list/${list.id}`} className="text-decoration-none">
                    <div className="sc-card sc-card-interactive p-3">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <h6
                          className="fw-bold mb-0"
                          style={{ color: "var(--sc-text)" }}
                        >
                          {list.list_name}
                        </h6>
                        <span
                          className={`sc-badge ${
                            list.role === "admin"
                              ? "sc-badge-primary"
                              : "sc-badge-muted"
                          }`}
                        >
                          {list.role === "admin" ? "מנהל" : "חבר"}
                        </span>
                      </div>
                      <div
                        className="d-flex gap-3"
                        style={{ color: "var(--sc-text-muted)", fontSize: "0.85rem" }}
                      >
                        <span>
                          <i className="bi bi-box me-1" style={{ opacity: 0.6 }}></i>
                          {list.item_count} פריטים
                        </span>
                        <span>
                          <i className="bi bi-people me-1" style={{ opacity: 0.6 }}></i>
                          {list.member_count} חברים
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
