import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import socket from "../socket";
import CreateListModal from "../components/CreateListModal";
import ApplyTemplateModal from "../components/ApplyTemplateModal";

const MyLists = () => {
  const { isLinkedChild } = useContext(AuthContext);
  const [lists, setLists] = useState([]);

  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const navigate = useNavigate();

  // Kid request history
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("lists"); // "lists" or "requests"

  const fetchLists = async () => {
    try {
      const { data } = await api.get("/api/lists");
      setLists(data.lists);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const { data } = await api.get("/api/kid-requests/my");
      setRequests(data.requests);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLists();
    if (isLinkedChild) {
      fetchRequests();
      // Listen for request resolution in real-time
      const onResolved = (data) => {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === data.requestId ? { ...r, status: data.status } : r,
          ),
        );
      };
      socket.on("request_resolved", onResolved);
      return () => socket.off("request_resolved", onResolved);
    }
  }, [isLinkedChild]);

  const handleCreated = (listId) => {
    navigate(`/list/${listId}`);
  };

  const statusLabel = (status) => {
    switch (status) {
      case "pending":
        return "ממתין";
      case "approved":
        return "אושר";
      case "rejected":
        return "נדחה";
      default:
        return status;
    }
  };

  const statusBadgeClass = (status) => {
    switch (status) {
      case "pending":
        return "sc-badge-muted";
      case "approved":
        return "sc-badge-primary";
      case "rejected":
        return "sc-badge-danger";
      default:
        return "sc-badge-muted";
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="page-fade-in" dir="rtl">
      <div className="container py-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="fw-bold mb-1">
              {isLinkedChild ? "הרשימות של ההורים" : "הרשימות שלי"}
            </h2>
            <p
              className="mb-0"
              style={{ color: "var(--sc-text-muted)", fontSize: "0.9rem" }}
            >
              {isLinkedChild
                ? "בחר רשימה כדי לבקש הוספת מוצרים"
                : "נהל את רשימות הקניות שלך"}
            </p>
          </div>
          {!isLinkedChild && (
            <div className="d-flex gap-2">
              <button
                className="sc-btn sc-btn-primary"
                onClick={() => setShowCreate(true)}
              >
                <i className="bi bi-plus-lg"></i> רשימה חדשה
              </button>
              <button
                className="sc-btn sc-btn-ghost"
                onClick={() => setShowTemplate(true)}
              >
                <i className="bi bi-files"></i> מתבנית
              </button>
            </div>
          )}
        </div>

        {/* Tabs for children */}
        {isLinkedChild && (
          <div className="d-flex gap-2 mb-3">
            <button
              className={`sc-btn ${activeTab === "lists" ? "sc-btn-primary" : "sc-btn-ghost"}`}
              onClick={() => setActiveTab("lists")}
              style={{ fontSize: "0.85rem", padding: "6px 16px" }}
            >
              <i className="bi bi-list-ul me-1"></i> רשימות
            </button>
            <button
              className={`sc-btn ${activeTab === "requests" ? "sc-btn-primary" : "sc-btn-ghost"}`}
              onClick={() => setActiveTab("requests")}
              style={{
                fontSize: "0.85rem",
                padding: "6px 16px",
                position: "relative",
              }}
            >
              <i className="bi bi-clock-history me-1"></i> הבקשות שלי
              {pendingCount > 0 && (
                <span
                  className="sc-notification-badge"
                  style={{
                    position: "relative",
                    top: "-1px",
                    marginRight: "6px",
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        )}

        {activeTab === "lists" && (
          <>
            {loading ? (
              <div className="sc-loading-page" style={{ minHeight: "40vh" }}>
                <div className="sc-spinner"></div>
              </div>
            ) : lists.length === 0 ? (
              <div className="sc-card">
                <div className="sc-empty">
                  <div className="sc-empty-icon">
                    <i className="bi bi-clipboard-plus"></i>
                  </div>
                  <h4>
                    {isLinkedChild ? "אין רשימות עדיין" : "אין רשימות עדיין"}
                  </h4>
                  <p>
                    {isLinkedChild
                      ? "ההורים עוד לא יצרו רשימות"
                      : "צור רשימה חדשה כדי להתחיל"}
                  </p>
                  {!isLinkedChild && (
                    <button
                      className="sc-btn sc-btn-primary"
                      onClick={() => setShowCreate(true)}
                    >
                      <i className="bi bi-plus-lg me-1"></i> צור רשימה ראשונה
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="row g-3">
                {lists.map((list) => (
                  <div key={list.id} className="col-md-6 col-lg-4">
                    <div
                      className="sc-card sc-card-interactive p-3"
                      onClick={() => navigate(`/list/${list.id}`)}
                    >
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <h5
                          className="fw-bold mb-0"
                          style={{ fontSize: "1.05rem" }}
                        >
                          {list.list_name}
                        </h5>
                        {!isLinkedChild && (
                          <span
                            className={`sc-badge ${list.role === "admin" ? "sc-badge-primary" : "sc-badge-muted"}`}
                          >
                            {list.role === "admin" ? "מנהל" : "חבר"}
                          </span>
                        )}
                      </div>
                      <div
                        className="d-flex gap-3"
                        style={{
                          color: "var(--sc-text-muted)",
                          fontSize: "0.85rem",
                        }}
                      >
                        <span>
                          <i className="bi bi-box-seam me-1"></i>
                          {list.item_count} פריטים
                        </span>
                        <span>
                          <i className="bi bi-people me-1"></i>
                          {list.member_count} חברים
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Request history for kids */}
        {activeTab === "requests" && isLinkedChild && (
          <>
            {requests.length === 0 ? (
              <div className="sc-card">
                <div className="sc-empty" style={{ padding: "2rem" }}>
                  <div className="sc-empty-icon">
                    <i className="bi bi-send"></i>
                  </div>
                  <h4>אין בקשות עדיין</h4>
                  <p>כשתבקש להוסיף מוצרים, הבקשות יופיעו כאן</p>
                </div>
              </div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className="sc-card p-3"
                    style={{
                      opacity: req.status === "rejected" ? 0.7 : 1,
                      borderRight:
                        req.status === "approved"
                          ? "3px solid var(--sc-success)"
                          : req.status === "rejected"
                            ? "3px solid var(--sc-danger)"
                            : "3px solid var(--sc-text-muted)",
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <strong style={{ fontSize: "0.95rem" }}>
                          {req.item_name}
                        </strong>
                        {req.quantity > 1 && (
                          <span
                            style={{
                              color: "var(--sc-text-muted)",
                              fontSize: "0.85rem",
                            }}
                          >
                            {" "}
                            x{req.quantity}
                          </span>
                        )}
                        <div
                          style={{
                            color: "var(--sc-text-muted)",
                            fontSize: "0.8rem",
                            marginTop: "2px",
                          }}
                        >
                          <i className="bi bi-list-ul me-1"></i>
                          {req.list_name}
                          {req.price && (
                            <span className="me-2"> | ₪{req.price}</span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`sc-badge ${statusBadgeClass(req.status)}`}
                      >
                        {req.status === "approved" && (
                          <i className="bi bi-check-circle me-1"></i>
                        )}
                        {req.status === "rejected" && (
                          <i className="bi bi-x-circle me-1"></i>
                        )}
                        {req.status === "pending" && (
                          <i className="bi bi-hourglass-split me-1"></i>
                        )}
                        {statusLabel(req.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!isLinkedChild && (
          <>
            <CreateListModal
              show={showCreate}
              onClose={() => setShowCreate(false)}
              onCreated={handleCreated}
            />
            <ApplyTemplateModal
              show={showTemplate}
              onClose={() => setShowTemplate(false)}
              onApplied={handleCreated}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default MyLists;
