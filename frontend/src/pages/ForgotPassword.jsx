import React, { useState } from "react";
import { Link } from "react-router-dom";
import validator from "validator";
import axios from "axios";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!validator.isEmail(email)) {
      setError("כתובת אימייל לא תקינה");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post("http://localhost:3000/api/forgot-password", { email });
      setMessage(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "שגיאה בשליחת הבקשה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sc-fp-page page-fade-in" dir="rtl">

      {/* Back button */}
      <div style={{ position: "absolute", top: "1rem", left: "1rem" }}>
        <Link to="/login" className="sc-icon-btn" style={{ border: "none", background: "transparent", color: "var(--sc-text-muted)" }}>
          <i className="bi bi-chevron-right"></i>
        </Link>
      </div>

      {/* Icon */}
      <div className="sc-fp-icon-wrap">
        <i className="bi bi-key"></i>
      </div>

      {/* Title */}
      <h2 className="sc-fp-title">שכחת סיסמה?</h2>
      <p className="sc-fp-subtitle">הכנס את כתובת האימייל שלך ונשלח לך קישור לאיפוס הסיסמה</p>

      {/* Form */}
      <div className="sc-fp-form">
        {message && (
          <div className="alert alert-success mb-3" style={{ borderRadius: "12px", fontSize: "0.88rem", textAlign: "center" }}>
            <i className="bi bi-check-circle me-2"></i>{message}
          </div>
        )}
        {error && (
          <div className="alert alert-danger mb-3" style={{ borderRadius: "12px", fontSize: "0.88rem", textAlign: "center" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label" style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--sc-text-secondary)" }}>
              דואר אלקטרוני
            </label>
            <div className="position-relative">
              <span style={{
                position: "absolute", right: "14px", top: "50%",
                transform: "translateY(-50%)", color: "var(--sc-text-muted)", pointerEvents: "none"
              }}>
                <i className="bi bi-envelope"></i>
              </span>
              <input
                type="email"
                className="form-control sc-input"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                style={{ paddingRight: "40px" }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="sc-btn sc-btn-primary w-100"
            disabled={loading}
          >
            {loading && <span className="spinner-border spinner-border-sm me-2"></span>}
            {loading ? "שולח..." : "שלח קישור איפוס"}
          </button>
        </form>

        <div className="text-center mt-3">
          <Link
            to="/login"
            style={{ fontSize: "0.88rem", color: "var(--sc-primary)", fontWeight: 600, textDecoration: "none" }}
          >
            <i className="bi bi-chevron-right me-1" style={{ fontSize: "0.75rem" }}></i>
            חזרה להתחברות
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
