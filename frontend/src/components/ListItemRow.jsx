import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import socket from "../socket";
import ItemNoteEditor from "./ItemNoteEditor";
import ItemComments from "./ItemComments";

const ListItemRow = ({ item, listId }) => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showComments, setShowComments] = useState(false);

  const handleDelete = () => {
    socket.emit("delete_item", { itemId: item.id, listId });
  };

  const handleMarkPaid = () => {
    if (item.paid_by) {
      socket.emit("unmark_paid", { itemId: item.id, listId });
    } else {
      socket.emit("mark_paid", { itemId: item.id, listId, userId: user.id });
    }
  };

  const isPaid = !!item.paid_by;
  const isChecked = item.is_checked;

  return (
    <div
      className={`sc-item-row ${isPaid ? "sc-item-paid" : ""} ${isChecked && !isPaid ? "sc-item-checked" : ""}`}
      dir="rtl"
    >
      <div className="d-flex align-items-center gap-3">
        {/* Item info */}
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span
              className="fw-bold"
              style={{
                textDecoration: isChecked || isPaid ? "line-through" : "none",
                color: isChecked || isPaid ? "var(--sc-text-muted)" : "var(--sc-text)",
                fontSize: "0.95rem",
                cursor: item.product_id ? "pointer" : "default",
              }}
              onClick={() => item.product_id && navigate(`/product/${item.product_id}`)}
            >
              {item.itemname}
              {item.product_id && (
                <i className="bi bi-box-arrow-up-right ms-1" style={{ fontSize: "0.7rem", opacity: 0.5 }}></i>
              )}
            </span>
            {item.quantity > 1 && (
              <span className="sc-badge sc-badge-muted">x{item.quantity}</span>
            )}
            {item.price && (
              <span className="sc-badge sc-badge-primary">
                ₪{Number(item.price).toFixed(2)}
              </span>
            )}
          </div>

          <div className="d-flex flex-wrap gap-2 mt-1" style={{ fontSize: "0.78rem" }}>
            {item.added_by_name && (
              <span style={{ color: "var(--sc-text-muted)" }}>
                <i className="bi bi-person me-1"></i>{item.added_by_name}
              </span>
            )}
            {isPaid && (
              <span style={{ color: "var(--sc-success)", fontWeight: 600 }}>
                <i className="bi bi-check-circle me-1"></i>שולם ע"י {item.paid_by_name}
              </span>
            )}
            {item.storename && (
              <span style={{ color: "var(--sc-text-muted)" }}>
                <i className="bi bi-shop me-1"></i>{item.storename}
              </span>
            )}
          </div>

          <ItemNoteEditor item={item} listId={listId} />
        </div>

        {/* Action buttons */}
        <div className="d-flex gap-1" style={{ flexShrink: 0 }}>
          <button
            className={`sc-icon-btn sc-icon-btn-success ${isPaid ? "active" : ""}`}
            onClick={handleMarkPaid}
            title={isPaid ? "בטל תשלום" : "סמן כשולם"}
          >
            <i className="bi bi-currency-exchange"></i>
          </button>
          <button
            className="sc-icon-btn"
            onClick={() => setShowComments(!showComments)}
            title="הערות"
          >
            <i className="bi bi-chat-dots"></i>
          </button>
          <button
            className="sc-icon-btn sc-icon-btn-danger"
            onClick={handleDelete}
            title="מחק"
          >
            <i className="bi bi-trash"></i>
          </button>
        </div>
      </div>

      {showComments && <ItemComments itemId={item.id} listId={listId} />}
    </div>
  );
};

export default ListItemRow;
