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

    if (!loginId.trim()) { setError("יש להזין אימייל או שם משתמש"); return; }
    if (!password)        { setError("יש להזין סיסמה"); return; }
    if (password.length < 8) { setError("סיסמה שגויה"); return; }

    setLoading(true);
    try {
      const isEmail = loginId.includes("@");
      const body = isEmail ? { email: loginId, password } : { username: loginId, password };
      const res = await api.post("/api/login", body);
      setAccessToken(res.data.accessToken);
      setUser(res.data.user);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "ההתחברות נכשלה. נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sc-auth-page page-fade-in" dir="rtl">
      <div className="sc-auth-card">

        {/* Gradient header */}
        <div className="sc-auth-header">
          <div className="sc-auth-icon">
            <i className="bi bi-cart3"></i>
          </div>
          <h2>SmartCart</h2>
          <p>ברוכים השבים!</p>
        </div>

        {/* Form body */}
        <div className="sc-auth-body">
          {error && (
            <div className="alert alert-danger py-2 text-center mb-3" style={{ borderRadius: "10px", fontSize: "0.88rem" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email / Username */}
            <div className="mb-3">
              <label className="form-label">דואר אלקטרוני</label>
              <div className="position-relative">
                <span className="sc-input-icon-left">
                  <i className="bi bi-envelope"></i>
                </span>
                <input
                  type="text"
                  className="form-control sc-input sc-input-with-icon"
                  placeholder="you@example.com"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  required
                  dir="ltr"
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-4">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label mb-0">סיסמה</label>
                <Link to="/forgot-password" style={{ fontSize: "0.8rem", color: "var(--sc-primary)", fontWeight: 600, textDecoration: "none" }}>
                  לשכוח סיסמה?
                </Link>
              </div>
              <div className="position-relative">
                <span className="sc-input-icon-left">
                  <i className="bi bi-lock"></i>
                </span>
                <input
                  type="password"
                  className="form-control sc-input sc-input-with-icon"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="sc-btn sc-btn-primary w-100" disabled={loading}>
              {loading && <span className="spinner-border spinner-border-sm me-2"></span>}
              {loading ? "מתחבר..." : "כניסה לחשבון"}
            </button>
          </form>

          <p className="text-center mt-3 mb-0" style={{ fontSize: "0.88rem", color: "var(--sc-text-muted)" }}>
            הירשם?{" "}
            <Link to="/register" style={{ color: "var(--sc-primary)", fontWeight: 600, textDecoration: "none" }}>
              אין לך חשבון
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
