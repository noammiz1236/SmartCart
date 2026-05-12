import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import socket from "../socket";

const ItemComments = ({ itemId, listId }) => {
  const { user } = useContext(AuthContext);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const { data } = await api.get(`/api/lists/${listId}/items/${itemId}/comments`);
        setComments(data.comments);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchComments();

    const handleNewComment = (data) => {
      if (data.itemId === itemId) {
        setComments((prev) => [...prev, data.comment]);
      }
    };
    const handleUpdated = (data) => {
      if (data.itemId !== itemId) return;
      setComments((prev) =>
        prev.map((c) =>
          c.id === data.commentId ? { ...c, comment: data.comment } : c,
        ),
      );
    };
    const handleDeleted = (data) => {
      if (data.itemId !== itemId) return;
      setComments((prev) => prev.filter((c) => c.id !== data.commentId));
    };

    socket.on("receive_comment", handleNewComment);
    socket.on("comment_updated", handleUpdated);
    socket.on("comment_deleted", handleDeleted);
    return () => {
      socket.off("receive_comment", handleNewComment);
      socket.off("comment_updated", handleUpdated);
      socket.off("comment_deleted", handleDeleted);
    };
  }, [itemId, listId]);

  const userComment = comments.find((c) => c.user_id === user.id);
  const hasCommented = !!userComment;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    if (hasCommented) {
      alert("כבר הוספת הערה לפריט זה");
      return;
    }
    socket.emit("add_comment", {
      itemId,
      listId,
      userId: user.id,
      comment: newComment,
    });
    setNewComment("");
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditingText(c.comment);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const saveEdit = (c) => {
    const trimmed = editingText.trim();
    if (!trimmed || trimmed === c.comment) {
      cancelEdit();
      return;
    }
    socket.emit("update_comment", {
      commentId: c.id,
      itemId,
      listId,
      userId: user.id,
      comment: trimmed,
    });
    cancelEdit();
  };

  const handleDelete = (c) => {
    if (!confirm("למחוק את ההערה?")) return;
    socket.emit("delete_comment", {
      commentId: c.id,
      itemId,
      listId,
      userId: user.id,
    });
    if (editingId === c.id) cancelEdit();
  };

  return (
    <div className="mt-2 border-top pt-2" dir="rtl">
      {loading ? (
        <small className="text-muted">טוען הערות...</small>
      ) : (
        <>
          {comments.map((c) => {
            const isMine = c.user_id === user.id;
            const isEditing = editingId === c.id;
            return (
              <div
                key={c.id}
                className="mb-1 d-flex align-items-center gap-2"
              >
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(c);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="sc-icon-btn sc-icon-btn-success"
                      onClick={() => saveEdit(c)}
                      title="שמור"
                      style={{ width: "28px", height: "28px" }}
                    >
                      <i className="bi bi-check-lg" style={{ fontSize: "0.8rem" }}></i>
                    </button>
                    <button
                      type="button"
                      className="sc-icon-btn"
                      onClick={cancelEdit}
                      title="בטל"
                      style={{ width: "28px", height: "28px" }}
                    >
                      <i className="bi bi-x-lg" style={{ fontSize: "0.8rem" }}></i>
                    </button>
                  </>
                ) : (
                  <>
                    <small className="flex-grow-1" style={{ minWidth: 0 }}>
                      <strong>{c.first_name}</strong>: {c.comment}
                      {isMine && (
                        <span
                          className="badge bg-primary ms-1"
                          style={{ fontSize: "0.65rem" }}
                        >
                          שלך
                        </span>
                      )}
                    </small>
                    {isMine && (
                      <div className="d-flex gap-1" style={{ flexShrink: 0 }}>
                        <button
                          type="button"
                          className="sc-icon-btn"
                          onClick={() => startEdit(c)}
                          title="ערוך"
                          style={{ width: "26px", height: "26px" }}
                        >
                          <i className="bi bi-pencil" style={{ fontSize: "0.75rem" }}></i>
                        </button>
                        <button
                          type="button"
                          className="sc-icon-btn sc-icon-btn-danger"
                          onClick={() => handleDelete(c)}
                          title="מחק"
                          style={{ width: "26px", height: "26px" }}
                        >
                          <i className="bi bi-trash" style={{ fontSize: "0.75rem" }}></i>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
          {comments.length === 0 && (
            <small className="text-muted">אין הערות עדיין</small>
          )}
        </>
      )}
      {!hasCommented && (
        <form onSubmit={handleSubmit} className="d-flex gap-1 mt-1">
          <input
            type="text"
            className="form-control form-control-sm"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="הוסף הערה..."
          />
          <button className="btn btn-sm btn-primary" type="submit">
            שלח
          </button>
        </form>
      )}
    </div>
  );
};

export default ItemComments;
