import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import validator from "validator";

const Register = () => {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const { password, confirmPassword, email, first_name, last_name } = formData;

    if (first_name.length < 2 || last_name.length < 2) { setError("שם חייב להכיל לפחות 2 תווים"); return; }
    if (!validator.isEmail(email)) { setError("כתובת אימייל לא תקינה"); return; }
    if (password.length < 8)       { setError("הסיסמה חייבת להכיל לפחות 8 תווים"); return; }
    if (password !== confirmPassword) { setError("הסיסמאות אינן תואמות"); return; }

    setLoading(true);
    try {
      await axios.post("http://localhost:3000/api/register", formData);
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.message || "ההרשמה נכשלה. נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sc-auth-page page-fade-in" dir="rtl">
      <div className="sc-auth-card">

        {/* Gradient header */}
        <div className="sc-auth-header">
          <h2>SmartCart</h2>
          <p>יצירת חשבון חדש</p>
        </div>

        {/* Form body */}
        <div className="sc-auth-body">
          {error && (
            <div className="alert alert-danger py-2 text-center mb-3" style={{ borderRadius: "10px", fontSize: "0.88rem" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Full name */}
            <div className="mb-3">
              <label className="form-label">שם מלא</label>
              <div className="position-relative">
                <span className="sc-input-icon-left">
                  <i className="bi bi-person"></i>
                </span>
                <input
                  type="text"
                  className="form-control sc-input sc-input-with-icon"
                  name="first_name"
                  placeholder="ישראל ישראלי"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="mb-3">
              <label className="form-label">דואר אלקטרוני</label>
              <div className="position-relative">
                <span className="sc-input-icon-left">
                  <i className="bi bi-envelope"></i>
                </span>
                <input
                  type="email"
                  className="form-control sc-input sc-input-with-icon"
                  name="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  dir="ltr"
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-3">
              <label className="form-label">סיסמה</label>
              <div className="position-relative">
                <span className="sc-input-icon-left">
                  <i className="bi bi-lock"></i>
                </span>
                <input
                  type="password"
                  className="form-control sc-input sc-input-with-icon"
                  name="password"
                  placeholder="לפחות 8 תווים"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Confirm password */}
            <div className="mb-3">
              <label className="form-label">אימות סיסמה</label>
              <div className="position-relative">
                <span className="sc-input-icon-left">
                  <i className="bi bi-lock-fill"></i>
                </span>
                <input
                  type="password"
                  className="form-control sc-input sc-input-with-icon"
                  name="confirmPassword"
                  placeholder="חזור על הסיסמה"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Terms */}
            <div className="d-flex align-items-start gap-2 mb-4 mt-1">
              <div
                style={{
                  width: 20, height: 20,
                  borderRadius: 6,
                  background: "var(--sc-primary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginTop: 2,
                }}
              >
                <i className="bi bi-check" style={{ color: "white", fontSize: "0.75rem" }}></i>
              </div>
              <span style={{ fontSize: "0.8rem", color: "var(--sc-text-secondary)", lineHeight: 1.5 }}>
                אני מסכים לתנאי השימוש ולמדיניות הפרטיות
              </span>
            </div>

            <button type="submit" className="sc-btn sc-btn-primary w-100" disabled={loading}>
              {loading && <span className="spinner-border spinner-border-sm me-2"></span>}
              {loading ? "נרשם..." : "יצירת חשבון"}
            </button>
          </form>

          <p className="text-center mt-3 mb-0" style={{ fontSize: "0.88rem", color: "var(--sc-text-muted)" }}>
            התחבר לכבר יש לך חשבון?{" "}
            <Link to="/login" style={{ color: "var(--sc-primary)", fontWeight: 600, textDecoration: "none" }}>
              כניסה
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
