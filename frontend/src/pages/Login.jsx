import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { setAccessToken } from "../api";
import { AuthContext } from "../context/AuthContext";

const Login = () => {
  const { setUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!loginId.trim()) {
      setError("יש להזין אימייל או שם משתמש");
      return;
    }
    if (!password) {
      setError("יש להזין סיסמה");
      return;
    }
    if (password.length < 8) {
      setError("סיסמה שגויה");
      return;
    }

    setLoading(true);
    try {
      // Send as email if it contains @, otherwise as username
      const isEmail = loginId.includes("@");
      const body = isEmail
        ? { email: loginId, password }
        : { username: loginId, password };
      const res = await api.post("/api/login", body);
      setAccessToken(res.data.accessToken);
      setUser(res.data.user);
      navigate("/");
    } catch (err) {
      const message = err.response?.data?.message;
      setError(message || "ההתחברות נכשלה. נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sc-login-layout page-fade-in" dir="rtl">
      {/* ── Brand panel (desktop only) ── */}
      <div className="sc-login-brand">
        {/* Logo */}
        <Link to="/" style={{ textDecoration: "none" }}>
          <div className="d-flex align-items-center gap-3">
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.3rem",
                fontWeight: 800,
                color: "white",
              }}
            >
              S
            </div>
            <span style={{ fontSize: "1.3rem", fontWeight: 700, color: "white" }}>
              SmartCart
            </span>
          </div>
        </Link>

        {/* Tagline */}
        <div>
          <h2
            style={{
              color: "white",
              fontSize: "clamp(2rem, 3.5vw, 2.6rem)",
              fontWeight: 800,
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            קנו חכם.
          </h2>
          <h2
            style={{
              color: "#93c5fd",
              fontSize: "clamp(2rem, 3.5vw, 2.6rem)",
              fontWeight: 800,
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            חסכו יותר.
          </h2>
          <p
            style={{
              color: "#bfdbfe",
              fontSize: "1rem",
              lineHeight: 1.65,
              marginTop: "1rem",
              maxWidth: 340,
            }}
          >
            השוואת מחירים בין כל רשתות השיווק בישראל — שופרסל, רמי לוי, ויקטורי ועוד.
          </p>
        </div>

        {/* Stats */}
        <div className="d-flex gap-4">
          {[
            { value: "50+", label: "רשתות שיווק" },
            { value: "₪200", label: "חיסכון ממוצע לחודש" },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "white" }}>
                {s.value}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#93c5fd" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Form area ── */}
      <div className="sc-login-form-area">
        <div
          className="sc-auth-card page-fade-in"
          style={{ position: "relative", overflow: "hidden" }}
        >
          {/* Top accent bar */}
          <div className="sc-auth-card-accent"></div>

          {/* Mobile logo (hidden on desktop via sc-login-brand display:none) */}
          <div className="text-center mb-3 d-lg-none">
            <Link to="/" style={{ textDecoration: "none" }}>
              <span
                className="sc-text-gradient"
                style={{ fontSize: "1.6rem", fontWeight: 800 }}
              >
                <i className="bi bi-cart3"></i> SmartCart
              </span>
            </Link>
          </div>

          <h2 style={{ textAlign: "center" }}>ברוכים השבים</h2>
          <p className="sc-auth-subtitle">התחברו לחשבון SmartCart שלכם</p>

          {error && (
            <div
              className="alert alert-danger py-2 text-center"
              style={{ borderRadius: "10px", fontSize: "0.9rem" }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label
                className="form-label fw-semibold"
                style={{ fontSize: "0.9rem" }}
              >
                אימייל או שם משתמש
              </label>
              <input
                type="text"
                className="form-control sc-input"
                placeholder="אימייל או שם משתמש"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                required
                dir="ltr"
              />
            </div>

            <div className="mb-4">
              <div className="d-flex justify-content-between align-items-center">
                <label
                  className="form-label fw-semibold mb-0"
                  style={{ fontSize: "0.9rem" }}
                >
                  סיסמה
                </label>
                <Link
                  to="/forgot-password"
                  style={{ fontSize: "0.8rem", color: "var(--sc-primary)" }}
                >
                  שכחת סיסמה?
                </Link>
              </div>
              <input
                type="password"
                className="form-control sc-input mt-1"
                placeholder="הכנס סיסמה"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="sc-btn sc-btn-primary w-100"
              disabled={loading}
              style={{ padding: "12px", fontSize: "1rem" }}
            >
              {loading && (
                <span className="spinner-border spinner-border-sm me-2"></span>
              )}
              {loading ? "מתחבר..." : "התחברות"}
            </button>
          </form>

          <p
            className="text-center mt-4 mb-0"
            style={{ fontSize: "0.9rem", color: "var(--sc-text-muted)" }}
          >
            אין לך חשבון?{" "}
            <Link
              to="/register"
              style={{ color: "var(--sc-primary)", fontWeight: 600 }}
            >
              הרשם כאן
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
