import React, { useState, useEffect } from "react";
import api from "../api";

const FamilySettings = () => {
  const [children, setChildren] = useState([]);
  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChildren = async () => {
      try {
        const { data } = await api.get("/api/family/children");
        setChildren(data.children);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchChildren();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !username.trim() || !password) return;
    try {
      const { data } = await api.post("/api/family/create-child", {
        firstName: firstName.trim(),
        username: username.trim(),
        password,
      });
      setMessage({ type: "success", text: `${data.message}` });
      setFirstName("");
      setUsername("");
      setPassword("");
      // Refresh list
      const res = await api.get("/api/family/children");
      setChildren(res.data.children);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "שגיאה ביצירת החשבון" });
    }
  };

  const handleDelete = async (childId, name) => {
    if (!confirm(`למחוק את החשבון של ${name}?`)) return;
    try {
      await api.delete(`/api/family/delete-child/${childId}`);
      setChildren((prev) => prev.filter((c) => c.id !== childId));
      setMessage({ type: "success", text: `${name} הוסר/ה בהצלחה` });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "שגיאה במחיקה" });
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
      <div className="container py-4" style={{ maxWidth: "600px" }}>
        <button
          className="sc-btn sc-btn-ghost mb-3"
          onClick={() => window.history.back()}
          style={{ fontSize: "0.8rem", padding: "4px 12px" }}
        >
          <i className="bi bi-arrow-right me-1"></i> חזרה
        </button>

        <h2 className="fw-bold mb-1">
          <i className="bi bi-people me-2" style={{ color: "var(--sc-primary)" }}></i>
          ניהול משפחה
        </h2>
        <p className="mb-4" style={{ color: "var(--sc-text-muted)", fontSize: "0.9rem" }}>
          צור חשבונות ילדים. כשהם יוסיפו מוצרים לרשימה, תקבל בקשה לאישור
        </p>

        {message.text && (
          <div
            className={`alert alert-${message.type === "error" ? "danger" : "success"} d-flex align-items-center`}
            style={{ borderRadius: "10px", fontSize: "0.9rem" }}
          >
            <i className={`bi ${message.type === "success" ? "bi-check-circle" : "bi-exclamation-triangle"} me-2`}></i>
            <span className="flex-grow-1">{message.text}</span>
            <button type="button" className="btn-close" onClick={() => setMessage({ type: "", text: "" })}></button>
          </div>
        )}

        {/* Create child form */}
        <div className="sc-card p-4 mb-4">
          <h5 className="fw-bold mb-3">
            <i className="bi bi-person-plus me-2" style={{ color: "var(--sc-primary)" }}></i>
            צור חשבון ילד/ה
          </h5>
          <form onSubmit={handleCreate}>
            <div className="mb-3">
              <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>שם פרטי</label>
              <input
                type="text"
                className="form-control sc-input"
                placeholder="שם הילד/ה..."
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>שם משתמש</label>
              <input
                type="text"
                className="form-control sc-input"
                placeholder="שם משתמש להתחברות..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                dir="ltr"
              />
              <small style={{ color: "var(--sc-text-muted)", fontSize: "0.8rem" }}>
                הילד/ה ישתמש/תשתמש בשם המשתמש כדי להתחבר
              </small>
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>סיסמה</label>
              <input
                type="password"
                className="form-control sc-input"
                placeholder="סיסמה (לפחות 4 תווים)..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
              />
            </div>
            <button type="submit" className="sc-btn sc-btn-primary w-100" style={{ padding: "10px" }}>
              <i className="bi bi-person-plus me-1"></i> צור חשבון
            </button>
          </form>
        </div>

        {/* Children list */}
        <div className="sc-card p-4">
          <h5 className="fw-bold mb-3">
            <i className="bi bi-people me-2" style={{ color: "var(--sc-primary)" }}></i>
            חשבונות ילדים
          </h5>
          {children.length === 0 ? (
            <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--sc-text-muted)" }}>
              <i className="bi bi-person-dash" style={{ fontSize: "2rem", opacity: 0.5 }}></i>
              <p className="mt-2 mb-0" style={{ fontSize: "0.9rem" }}>אין חשבונות ילדים עדיין</p>
            </div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {children.map((child) => (
                <div
                  key={child.id}
                  className="d-flex justify-content-between align-items-center p-3"
                  style={{ background: "var(--sc-bg)", borderRadius: "var(--sc-radius)" }}
                >
                  <div>
                    <span className="fw-semibold">{child.first_name}</span>
                    <br />
                    <small style={{ color: "var(--sc-text-muted)" }}>@{child.username}</small>
                  </div>
                  <button
                    className="sc-icon-btn sc-icon-btn-danger"
                    onClick={() => handleDelete(child.id, child.first_name)}
                    title="מחק חשבון"
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FamilySettings;
