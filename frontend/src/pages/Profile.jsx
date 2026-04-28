import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import { useNavigate, Link } from "react-router-dom";

const Profile = () => {
  const { user, setUser, loading, isLinkedChild } = useContext(AuthContext);
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [message, setMessage] = useState({ type: "", text: "" });
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setMessage({ type: "error", text: "הסיסמאות החדשות אינן תואמות" });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "הסיסמה החדשה חייבת להיות באורך 8 תווים לפחות" });
      return;
    }
    if (currentPassword.length < 8) {
      setMessage({ type: "error", text: "הסיסמה הנוכחית חייבת להיות באורך 8 תווים לפחות" });
      return;
    }
    if (currentPassword === newPassword) {
      setMessage({ type: "error", text: "הסיסמה החדשה חייבת להיות שונה מהסיסמה הנוכחית" });
      return;
    }
    setSaving(true);
    try {
      await api.put("/api/user/password", { currentPassword, newPassword, confirmNewPassword });
      setMessage({ type: "success", text: "הסיסמה שונתה בהצלחה" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "שינוי הסיסמה נכשל" });
    } finally {
      setSaving(false);
      await api.post("/api/logout-all");
      setUser(null);
      navigate("/login");
    }
  };

  const handleLogout = async () => {
    try {
      await api.post("/api/logout");
      setUser(null);
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleLogoutAllDevices = async () => {
    try {
      await api.post("/api/logout-all");
      setUser(null);
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="sc-loading-page">
        <div className="sc-spinner"></div>
      </div>
    );
  }

  return (
    <div className="page-fade-in" dir="rtl">

      {/* Green page header */}
      <div className="sc-page-header">
        <div className="container">
          <div className="d-flex align-items-center gap-3">
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "14px",
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.4rem",
                flexShrink: 0,
              }}
            >
              <i className="bi bi-person-circle"></i>
            </div>
            <div>
              <h2 style={{ marginBottom: "0.1rem" }}>
                {user?.first_name} {user?.last_name}
              </h2>
              <p>{user?.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-4" style={{ paddingBottom: "6rem" }}>
        {message.text && (
          <div
            className={`alert alert-${message.type === "error" ? "danger" : "success"} d-flex align-items-center mb-4`}
            style={{ borderRadius: "10px", fontSize: "0.9rem" }}
          >
            <i className={`bi ${message.type === "success" ? "bi-check-circle" : "bi-exclamation-triangle"} me-2`}></i>
            <span className="flex-grow-1">{message.text}</span>
            <button type="button" className="btn-close" onClick={() => setMessage({ type: "", text: "" })}></button>
          </div>
        )}

        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6">

            {/* Security */}
            <div className="sc-card p-4 mb-3">
              <h5 className="fw-bold mb-3">
                <i className="bi bi-shield-lock me-2" style={{ color: "var(--sc-primary)" }}></i>
                שינוי סיסמה
              </h5>
              <form onSubmit={handleChangePassword}>
                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>סיסמה נוכחית</label>
                  <input type="password" className="form-control sc-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>סיסמה חדשה</label>
                  <input type="password" className="form-control sc-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div className="mb-4">
                  <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>אישור סיסמה חדשה</label>
                  <input type="password" className="form-control sc-input" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
                </div>
                <button type="submit" className="sc-btn sc-btn-primary w-100" disabled={saving}>
                  {saving && <span className="spinner-border spinner-border-sm me-2"></span>}
                  עדכן סיסמה
                </button>
              </form>
            </div>

            {/* Family - only for parents */}
            {!isLinkedChild && (
              <div className="sc-card p-4 mb-3">
                <h5 className="fw-bold mb-2">
                  <i className="bi bi-people me-2" style={{ color: "var(--sc-primary)" }}></i>
                  ניהול משפחה
                </h5>
                <p style={{ fontSize: "0.85rem", color: "var(--sc-text-muted)", marginBottom: "1rem" }}>
                  צור חשבונות לילדים כדי לאשר מוצרים שהם מוסיפים
                </p>
                <Link
                  to="/family"
                  className="sc-btn sc-btn-ghost w-100"
                  style={{ textDecoration: "none" }}
                >
                  <i className="bi bi-people me-1"></i> נהל ילדים
                </Link>
              </div>
            )}

            {/* Session */}
            <div className="sc-card p-4">
              <h5 className="fw-bold mb-3" style={{ color: "var(--sc-danger)" }}>
                <i className="bi bi-box-arrow-right me-2"></i>
                יציאה מהחשבון
              </h5>
              <div className="d-grid gap-2">
                <button className="sc-btn sc-btn-danger w-100" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-2"></i> התנתק
                </button>
                <button
                  className="sc-btn sc-btn-ghost w-100"
                  onClick={handleLogoutAllDevices}
                  style={{ color: "var(--sc-danger)", borderColor: "rgba(224, 82, 82, 0.3)" }}
                >
                  <i className="bi bi-shield-exclamation me-2"></i> התנתק מכל המכשירים
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
