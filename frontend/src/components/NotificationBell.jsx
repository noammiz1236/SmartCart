import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import socket from "../socket";

const NotificationBell = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [open, setOpen] = useState(false);

  const panelRef = useRef(null);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const { data } = await api.get("/api/kid-requests/pending");
        setRequests(data.requests);
      } catch (err) {
        console.error(err);
      }
    };
    fetchPending();

    const onNewRequest = (req) => {
      setRequests((prev) => [req, ...prev]);
    };
    socket.on("new_kid_request", onNewRequest);
    return () => socket.off("new_kid_request", onNewRequest);
  }, []);

  // Close panel on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleResolve = async (requestId, action) => {
    try {
      await api.post(`/api/kid-requests/${requestId}/resolve`, { action });
      setRequests((prev) => prev.filter((r) => r.id !== requestId && r.requestId !== requestId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleItemClick = (req) => {
    const productId = req.product_id || req.productId;
    if (productId) {
      setOpen(false);
      navigate(`/product/${productId}`);
    }
  };

  const count = requests.length;

  return (
    <div className="position-relative" ref={panelRef} dir="rtl">
      <button
        className="sc-icon-btn"
        onClick={() => setOpen(!open)}
        title="התראות"
        style={{ position: "relative" }}
      >
        <i className="bi bi-bell"></i>
        {count > 0 && <span className="sc-notification-badge">{count}</span>}
      </button>

      {open && (
        <div className="sc-notification-panel">
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--sc-border)", fontWeight: 600, fontSize: "0.9rem" }}>
            בקשות ממתינות ({count})
          </div>
          {requests.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--sc-text-muted)", fontSize: "0.85rem" }}>
              <i className="bi bi-bell-slash" style={{ fontSize: "1.5rem", display: "block", marginBottom: "8px", opacity: 0.4 }}></i>
              אין בקשות ממתינות
            </div>
          ) : (
            requests.map((req) => {
              const id = req.id || req.requestId;
              const childName = req.child_first_name || req.childName;
              const listName = req.list_name || req.listName;
              const itemName = req.item_name || req.itemName;
              const qty = req.quantity;
              const price = req.price;
              const productId = req.product_id || req.productId;

              return (
                <div className="sc-notification-item" key={id}>
                  <div
                    style={{
                      flex: 1, fontSize: "0.85rem",
                      cursor: productId ? "pointer" : "default",
                      borderRadius: "8px", padding: "4px 6px", margin: "-4px -6px",
                      transition: "background 0.15s ease",
                    }}
                    onClick={() => handleItemClick(req)}
                    onMouseEnter={(e) => { if (productId) e.currentTarget.style.background = "rgba(99,102,241,0.04)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <strong>{childName}</strong>
                      {productId && (
                        <span className="sc-badge sc-badge-primary" style={{ fontSize: "0.65rem", padding: "2px 6px" }}>
                          <i className="bi bi-box-seam me-1"></i>פרטי מוצר
                        </span>
                      )}
                    </div>
                    <div>
                      רוצה להוסיף <strong>{itemName}</strong>
                      {qty > 1 && <span> (x{qty})</span>} לרשימה <strong>{listName}</strong>
                    </div>
                    {price && (
                      <div style={{ color: "var(--sc-text-muted)", fontSize: "0.75rem", marginTop: "2px" }}>
                        <i className="bi bi-tag me-1"></i>₪{price}
                      </div>
                    )}
                  </div>
                  <div className="d-flex gap-1" style={{ flexShrink: 0 }}>
                    <button
                      className="sc-icon-btn"
                      onClick={(e) => { e.stopPropagation(); handleResolve(id, "approve"); }}
                      title="אשר"
                      style={{ color: "var(--sc-success)", background: "rgba(16,185,129,0.1)" }}
                    >
                      <i className="bi bi-check-lg"></i>
                    </button>
                    <button
                      className="sc-icon-btn"
                      onClick={(e) => { e.stopPropagation(); handleResolve(id, "reject"); }}
                      title="דחה"
                      style={{ color: "var(--sc-danger)", background: "rgba(239,68,68,0.1)" }}
                    >
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
