import { createContext, useEffect, useState, useRef } from "react";
import axios from "axios";
import api, { setAccessToken, API_URL } from "../api";
import socket from "../socket";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLinkedChild, setIsLinkedChild] = useState(false);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initAuth = async () => {
      console.log("Checking for existing session...");
      try {
        // ניסיון שקט לחידוש טוקן בעזרת העוגייה
        const res = await axios.post(
          `${API_URL}/api/refresh`,
          {}, // body ריק
          { withCredentials: true } // ← כאן צריך להיות
        );


        // אם הצלחנו (סטטוס 200)
        const token = res.data.accessToken;
        setAccessToken(token);

        // משיכת פרטי המשתמש
        const userRes = await api.get("/api/me");
        const userData = userRes.data.user;
        setUser(userData);

        console.log("Session restored successfully");
      } catch (err) {
        // --- התיקון מרכזי כאן ---
        // אם הסטטוס הוא 401 או 403, זה פשוט אומר שהמשתמש לא מחובר (אין עוגייה)
        // אנחנו לא מדפיסים שגיאה (error) אלא רק הודעה רגילה ללוג
        if (err.response?.status === 401 || err.response?.status === 403) {
          console.log("No active session found. User is guest.");
        } else {
          // רק שגיאות לא צפויות (כמו שרת כבוי) יודפסו כשגיאה
          console.error("Auth initialization failed:", err.message);
        }
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Derive isLinkedChild and register socket room whenever user changes
  useEffect(() => {
    if (user) {
      setIsLinkedChild(!!user.parent_id); // isLinkedChild = user.parent_id ? true : false
      socket.emit("register_user", user.id);
    } else {
      setIsLinkedChild(false);
    }
  }, [user]);

  // הצגת ספינר בזמן הבדיקה הראשונית כדי למנוע "קפיצות" במסך
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, isLinkedChild }}>
      {children}
    </AuthContext.Provider>
  );
};
