import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import socket from "../socket";

const ItemNoteEditor = ({ item, listId }) => {
  const { user, isLinkedChild } = useContext(AuthContext);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(item.note || "");

  const handleSave = () => {
    socket.emit("update_note", { itemId: item.id, listId, note, userId: user.id });
    setEditing(false);
  };

  if (isLinkedChild) {
    if (!item.note) return null;
    return (
      <small className="text-muted d-block fst-italic">
        {item.note}
        {item.note_by_name && (
          <span style={{ fontSize: "0.75rem", opacity: 0.7 }}> — {item.note_by_name}</span>
        )}
      </small>
    );
  }

  if (editing) {
    return (
      <div className="mt-1">
        <input
          type="text"
          className="form-control form-control-sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="הוסף הערה..."
          autoFocus
        />
      </div>
    );
  }

  return (
    <small
      className="text-muted d-block fst-italic"
      style={{ cursor: "pointer" }}
      onClick={() => setEditing(true)}
    >
      {item.note ? (
        <>
          {item.note}
          {item.note_by_name && (
            <span style={{ fontSize: "0.75rem", opacity: 0.7 }}> — {item.note_by_name}</span>
          )}
        </>
      ) : (
        "לחץ להוספת הערה..."
      )}
    </small>
  );
};

export default ItemNoteEditor;
