import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../api";

const roleLabel = (member) => {
  if (member.parent_id !== null && member.parent_id !== undefined) return "ילד";
  return member.role === "admin" ? "מנהל" : "חבר";
};

const roleBadgeClass = (member) => {
  if (member.parent_id !== null && member.parent_id !== undefined)
    return "sc-badge-warning";
  return member.role === "admin" ? "sc-badge-primary" : "sc-badge-muted";
};

const ManageListModal = ({ show, onClose, members, onMembersChange, listId }) => {
  const { user } = useContext(AuthContext);
  const [busyUserId, setBusyUserId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  if (!show) return null;

  const isChild = (m) => m.parent_id !== null && m.parent_id !== undefined;

  const handleRoleChange = async (member, newRole) => {
    setErrorMsg("");
    setBusyUserId(member.id);
    try {
      await api.put(`/api/lists/${listId}/members/${member.id}/role`, {
        role: newRole,
      });
      onMembersChange(
        members.map((m) =>
          m.id === member.id ? { ...m, role: newRole } : m,
        ),
      );
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "שגיאה בעדכון תפקיד");
    } finally {
      setBusyUserId(null);
    }
  };

  const handleKick = async (member) => {
    if (!confirm(`להסיר את ${member.first_name} מהרשימה?`)) return;
    setErrorMsg("");
    setBusyUserId(member.id);
    try {
      await api.delete(`/api/lists/${listId}/members/${member.id}`);
      onMembersChange(members.filter((m) => m.id !== member.id));
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "שגיאה בהסרת חבר");
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="sc-modal-overlay" onClick={onClose} dir="rtl">
      <div className="sc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sc-modal-header">
          <h5>ניהול רשימה</h5>
          <button className="sc-icon-btn" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        <div className="sc-modal-body">
          {errorMsg && (
            <div
              className="mb-3"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "var(--sc-danger)",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "0.85rem",
              }}
            >
              {errorMsg}
            </div>
          )}
          <div className="d-flex flex-column gap-2">
            {members.map((m) => {
              const isSelf = m.id === user?.id;
              const child = isChild(m);
              const busy = busyUserId === m.id;
              return (
                <div
                  key={m.id}
                  className="d-flex align-items-center gap-2"
                  style={{
                    padding: "10px 12px",
                    background: "var(--sc-bg)",
                    borderRadius: "var(--sc-radius)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="fw-bold"
                      style={{ fontSize: "0.92rem" }}
                    >
                      {m.first_name} {m.last_name || ""}
                      {isSelf && (
                        <span
                          className="ms-1"
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--sc-text-muted)",
                          }}
                        >
                          (אתה)
                        </span>
                      )}
                    </div>
                    <span
                      className={`sc-badge ${roleBadgeClass(m)} mt-1`}
                      style={{ fontSize: "0.7rem" }}
                    >
                      {roleLabel(m)}
                    </span>
                  </div>

                  {!child && (
                    <div className="d-flex gap-1" style={{ flexShrink: 0 }}>
                      {m.role === "admin" ? (
                        <button
                          className="sc-btn sc-btn-ghost"
                          onClick={() => handleRoleChange(m, "member")}
                          disabled={busy}
                          style={{
                            fontSize: "0.75rem",
                            padding: "5px 10px",
                          }}
                        >
                          <i className="bi bi-arrow-down me-1"></i> הורד לחבר
                        </button>
                      ) : (
                        <button
                          className="sc-btn sc-btn-ghost"
                          onClick={() => handleRoleChange(m, "admin")}
                          disabled={busy}
                          style={{
                            fontSize: "0.75rem",
                            padding: "5px 10px",
                          }}
                        >
                          <i className="bi bi-arrow-up me-1"></i> קדם למנהל
                        </button>
                      )}
                      {!isSelf && (
                        <button
                          className="sc-btn sc-btn-ghost"
                          onClick={() => handleKick(m)}
                          disabled={busy}
                          style={{
                            fontSize: "0.75rem",
                            padding: "5px 10px",
                            color: "var(--sc-danger)",
                          }}
                        >
                          <i className="bi bi-person-x me-1"></i> הסר
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="sc-modal-footer">
          <button className="sc-btn sc-btn-ghost" onClick={onClose}>
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageListModal;
