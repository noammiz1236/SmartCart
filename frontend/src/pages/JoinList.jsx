import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";

const JoinList = () => {
  const { inviteCode } = useParams();

  const navigate = useNavigate();

  const [status, setStatus] = useState("joining");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const joinList = async () => {
      try {
        const { data } = await api.post(`/api/join/${inviteCode}`);
        setStatus("success");
        setMessage(`הצטרפת בהצלחה לרשימה "${data.listName}"`);
        setTimeout(() => navigate(`/list/${data.listId}`), 2000);
      } catch (err) {
        setStatus("error");
        setMessage(err.response?.data?.message || "שגיאה בהצטרפות לרשימה");
      }
    };
    joinList();
  }, [inviteCode, navigate]);

  return (
    <div className="container mt-5 text-center" dir="rtl">
      {status === "joining" && (
        <>
          <div className="spinner-border text-primary mb-3" role="status"></div>
          <p>מצטרף לרשימה...</p>
        </>
      )}
      {status === "success" && (
        <div className="alert alert-success">
          <h4>{message}</h4>
          <p>מעביר אותך לרשימה...</p>
        </div>
      )}
      {status === "error" && (
        <div className="alert alert-danger">
          <h4>{message}</h4>
          <button className="btn btn-primary mt-2" onClick={() => navigate("/list")}>
            חזרה לרשימות
          </button>
        </div>
      )}
    </div>
  );
};

export default JoinList;
