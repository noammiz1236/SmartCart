import express, { json } from "express";
import morgan from "morgan";
import { config } from "dotenv";
import bcrypt from "bcrypt";
import cors from "cors";
import validator from "validator";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import http from "http";
import pg from "pg";
import nodemailer from "nodemailer";

config();
const port = process.env.PORT;
const app = express();
const server = http.createServer(app);
const saltRounds = 10;

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://100.115.197.11:5173",
      process.env.host_allowed,
    ].filter(Boolean),
    methods: ["GET", "POST"],
    credentials: true,
  },
});
const { Pool } = pg;
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- Middleware לאימות טוקן (מוגדר בחוץ כדי שיהיה זמין לכולם) ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Access token required" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // וידוא שזה access token
    if (payload.type !== "access") {
      return res.status(403).json({ message: "Invalid token type" });
    }

    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

// --- פונקציה ליצירת טוקנים ---
const generateTokens = async (userId) => {
  const accessToken = jwt.sign(
    {
      sub: userId,
      type: "access",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "15m",
    },
  );

  const { rows } = await db.query(
    `INSERT INTO app2.tokens (user_id, type, expires_at, used)
   VALUES ($1, 'refresh', NOW() + interval '7 days', false)
   RETURNING id`,
    [userId],
  );

  const tokenId = rows[0].id;

  const refreshToken = jwt.sign(
    {
      sub: userId,
      jti: tokenId,
      type: "refresh",
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: "7d",
    },
  );

  return { accessToken, refreshToken };
};

const createTransporter = () => {
  return nodemailer.createTransport({
    // creating shaliah (transporter)
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Middleware הגדרות כלליות
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: ["http://localhost:5173", "http://100.115.197.11:5173"],
    credentials: true,
  }),
);

db.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log("PostgreSQL (israel_shopping_db)");
  }
});

// Ensure popularity_points column exists on app.items
// db.query(
//   `ALTER TABLE app.items ADD COLUMN IF NOT EXISTS popularity_points INTEGER DEFAULT 0`,
// ).catch((e) => console.error("popularity_points column check:", e.message));

app.get("/api/search", async (req, res) => {
  const search = req.query.q;
  if (!search) return res.json({ rows: [], hasMore: false, nextOffset: 0 });

  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  const containsTerm = `%${search}%`;
  const startsWithTerm = `${search}%`;

  try {
    const reply = await db.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (i.id)
         i.id as item_id,
         i.name as item_name,
         i.barcode,
         i.item_code,
         p.price,
         c.id as chain_id,
         c.name as chain_name,
         b.branch_name,
         COALESCE(i.popularity_points, 0) as popularity_points
         FROM app.items i
         LEFT JOIN app.prices p ON p.item_id = i.id
         LEFT JOIN app.branches b ON b.id = p.branch_id
         LEFT JOIN app.chains c ON c.id = b.chain_id
         WHERE i.name ILIKE $1
         ORDER BY i.id, p.price DESC NULLS LAST
       ) sub
       ORDER BY CASE WHEN sub.item_name ILIKE $2 THEN 0 ELSE 1 END,
                sub.popularity_points DESC,
                sub.item_name
       LIMIT $3 OFFSET $4`,
      [containsTerm, startsWithTerm, limit + 1, offset],
    );

    const hasMore = reply.rows.length > limit;
    const rows = hasMore ? reply.rows.slice(0, limit) : reply.rows;
    const nextOffset = offset + rows.length;

    res.json({ rows, hasMore, nextOffset });
  } catch (e) {
    console.error("Search error:", e.message);
    return res.status(500).json({ rows: [], hasMore: false, nextOffset: 0 });
  }
});

// GET /api/products/:id — single product detail
app.get("/api/products/:id", async (req, res) => {
  const productId = req.params.id;
  try {
    const reply = await db.query(
      `SELECT DISTINCT ON (i.id)
       i.id as item_id,
       i.name as item_name,
       i.barcode,
       i.item_code,
       p.price,
       c.id as chain_id,
       c.name as chain_name,
       b.branch_name,
       COALESCE(i.popularity_points, 0) as popularity_points
       FROM app.items i
       LEFT JOIN app.prices p ON p.item_id = i.id
       LEFT JOIN app.branches b ON b.id = p.branch_id
       LEFT JOIN app.chains c ON c.id = b.chain_id
       WHERE i.id = $1
       ORDER BY i.id, p.price ASC NULLS LAST`,
      [productId],
    );

    if (reply.rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json({ product: reply.rows[0] });
  } catch (e) {
    console.error("Product fetch error:", e.message);
    return res.status(500).json({ message: "Error fetching product" });
  }
});

// ROUTES
// REGISTER
app.post("/api/register", async (req, res) => {
  const { first_name, last_name, email, password, confirmPassword } = req.body;

  try {
    // בדיקות בסיסיות
    if (!first_name || !last_name || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (!validator.isEmail(email))
      return res.status(400).json({ message: "Invalid email format" });
    if (password.length < 8)
      return res.status(400).json({ message: "Password too short" });
    if (password !== confirmPassword)
      return res.status(400).json({ message: "Passwords do not match" });

    // בדיקה אם המשתמש כבר קיים
    const existingUser = await db.query(
      "SELECT * FROM app2.users WHERE email = $1",
      [email],
    );
    if (existingUser.rows.length > 0)
      return res.status(400).json({ message: "Email already in use" });

    // יצירת hashed password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // יצירת token אימות במערכת ושמירת הנתונים בטבלה
    const tokenData = JSON.stringify({
      first_name,
      last_name,
      email,
      password_hash: hashedPassword,
    });

    const { rows } = await db.query(
      "INSERT INTO app2.tokens (user_id, type, expires_at, used, data) VALUES (NULL, 'email_verify', NOW() + interval '15 minutes', false, $1) RETURNING id",
      [tokenData],
    );
    const tokenId = rows[0].id;

    // יצירת JWT אימות (ללא מידע רגיש!)
    const token = jwt.sign(
      // this token is sent to the client to try to register
      {
        type: "email_verify",
        jti: tokenId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    const verifyLink = `http://localhost:${port}/api/verify-email?token=${encodeURIComponent(token)}`;

    // שליחת מייל למשתמש (רק אם הוגדרו credentials)
    if (
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_HOST
    ) {
      try {
        const transporter = nodemailer.createTransport({
          // creating shaliah (transporter)
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          // sending email to the user
          from: `"SmartCart" <${process.env.SMTP_USER}>`,
          to: email,
          subject: "Verify your email",
          html: `<p>Click <a href="${verifyLink}">here</a> to verify your email</p>`,
        });
      } catch (emailErr) {
        console.error("Email sending error:", emailErr);
        // אם המייל נכשל, מוחקים את הטוקן
        await db.query("DELETE FROM app2.tokens WHERE id = $1", [tokenId]);
        return res
          .status(500)
          .json({ message: "Error sending verification email" });
      }
    } else {
      console.warn("SMTP not configured. Using verification link:", verifyLink);
      // במצב פיתוח, אפשר להחזיר את הלינק בתגובה
      if (process.env.NODE_ENV !== "production") {
        return res.status(201).json({
          message: "Registration successful (DEV MODE)",
          verifyLink, // רק לפיתוח!
        });
      }
    }

    // מחזיר תגובה ללקוח
    return res.status(201).json({
      message:
        "Registration successful, please check your email to verify account",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error registering user" });
  }
});

app.get("/api/verify-email", async (req, res) => {
  const token = req.query.token;
  try {
    // בדיקת JWT
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload.type !== "email_verify") {
      return res.status(400).json({ message: "Invalid token type" });
    }

    // בדיקה בטבלת tokens
    const result = await db.query(
      "SELECT * FROM app2.tokens WHERE id = $1 AND type = 'email_verify' AND expires_at > NOW();",
      [payload.jti],
    );

    if (result.rowCount === 0)
      return res.status(400).json({ message: "Token not found" });

    const tokenRow = result.rows[0];

    if (tokenRow.used)
      return res.status(400).json({ message: "Token already used" });

    // שליפת נתוני המשתמש מהטבלה (במקום מה-JWT)
    if (!tokenRow.data) {
      return res.status(400).json({ message: "Invalid token data" });
    }

    const userData = JSON.parse(tokenRow.data);
    const { first_name, last_name, email, password_hash } = userData;

    // יוצר את המשתמש ב-DB (עם בדיקה למניעת כפילויות)
    const userResult = await db.query(
      `INSERT INTO app2.users 
   (first_name, last_name, email, password_hash, email_verified_at) 
   VALUES ($1, $2, $3, $4, NOW()) 
   ON CONFLICT (email) DO NOTHING
   RETURNING id, first_name, last_name, email`, // הועבר לסוף
      [first_name, last_name, email, password_hash],
    );

    // אם המייל כבר קיים (race condition)
    if (userResult.rowCount === 0) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const user = userResult.rows[0];

    // מסמן את הטוקן כ-used (רק אחרי שהמשתמש נוצר בהצלחה)
    await db.query("UPDATE app2.tokens SET used = true WHERE id = $1", [
      payload.jti,
    ]);

    // יצירת access + refresh tokens
    const { accessToken, refreshToken } = await generateTokens(user.id);

    // הגדרת cookie ל-refresh token
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ימים במילישניות
    });

    return res.redirect("http://localhost:5173/verification-confirmed"); // will need to check for debuggiing
  } catch (err) {
    // לוג שיעזור לך להבין בזמן אמת מה קרה
    console.error("JWT Verification Detail:", err.message);

    if (err.name === "JsonWebTokenError") {
      return res.status(400).json({ message: "Invalid token signature" });
    }
    if (err.name === "TokenExpiredError") {
      return res
        .status(400)
        .json({ message: "Token expired - please register again" });
    }

    return res.status(400).json({ message: "Invalid or expired token" });
  }
});

// LOGIN
app.post("/api/login", async (req, res) => {
  const { email, username, password } = req.body;

  // בדיקות בסיסיות - need either email or username
  if ((!email && !username) || !password) {
    return res
      .status(400)
      .json({ message: "Email/username and password are required" });
  }

  try {
    // Check if logging in with email or username
    let results;
    if (email) {
      // Parent login with email
      results = await db.query("SELECT * FROM app2.users WHERE email = $1", [
        email,
      ]);
    } else {
      // Child login with username
      results = await db.query("SELECT * FROM app2.users WHERE username = $1", [
        username,
      ]);
    }

    if (results.rows.length === 0)
      return res.status(400).json({ message: "Invalid credentials" });

    const user = results.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const { accessToken, refreshToken } = await generateTokens(user.id);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      user: {
        id: user.id,
        first_name: user.first_name,
        email: user.email,
        username: user.username,
      },
      accessToken,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error logging in" });
  }
});

// REFRESH
app.post("/api/refresh", async (req, res) => {
  // Accept refresh token from cookie (web) OR body (mobile app)
  const incomingToken = req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingToken) return res.status(401).json({ message: "Unauthorized" });

  try {
    // אימות מלא של הטוקן
    const payload = jwt.verify(incomingToken, process.env.JWT_REFRESH_SECRET);

    // בדיקה שזה refresh token
    if (payload.type !== "refresh") {
      return res.status(403).json({ message: "Invalid token type" });
    }




    // בדיקה ב-DB
    const { rows } = await db.query(
      "SELECT * FROM app2.tokens WHERE id = $1 AND user_id = $2 AND type = 'refresh'",
      [payload.jti, payload.sub],
    );

    if (rows.length === 0) {
      // Reuse detected — מוחק את כל ה-refresh tokens של המשתמש
      await db.query(
        "DELETE FROM app2.tokens WHERE user_id = $1 AND type = 'refresh'",
        [payload.sub],
      );
      return res.status(403).json({ message: "Token reuse detected" });
    }

    // מחיקת הטוקן הנוכחי מה-DB
    await db.query("DELETE FROM app2.tokens WHERE id = $1", [payload.jti]);

    // יצירת tokens חדשים
    const { accessToken, refreshToken } = await generateTokens(payload.sub);

    // Cookie (for web)
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    });

    // Return both tokens (mobile app needs refreshToken in body)
    return res.json({ accessToken, refreshToken });
  } catch (err) {
    return res.status(403).json({ message: "Invalid refresh token" });
  }
});

// ME (שימוש ב-Middleware החדש)
app.get("/api/me", authenticateToken, async (req, res) => {
  try {
    const results = await db.query(
      "SELECT id, first_name, last_name, email, username, parent_id FROM app2.users WHERE id = $1",
      [req.userId],
    );

    if (results.rows.length === 0) return res.status(404).json({ user: null });

    return res.status(200).json({ user: results.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/family/create-child - create child account
app.post("/api/family/create-child", authenticateToken, async (req, res) => {
  const { firstName, username, password } = req.body;

  try {
    // Validate inputs
    if (!firstName || !username || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (password.length < 4) {
      return res
        .status(400)
        .json({ message: "Password must be at least 4 characters" });
    }

    // Check if requesting user is a child account (prevent grandchildren)
    const requestingUser = await db.query(
      "SELECT parent_id FROM app2.users WHERE id = $1",
      [req.userId],
    );
    if (requestingUser.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    if (requestingUser.rows[0].parent_id !== null) {
      return res
        .status(403)
        .json({ message: "Child accounts cannot create other children" });
    }

    // Check if username already exists
    const existing = await db.query(
      "SELECT id FROM app2.users WHERE username = $1",
      [username],
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Username already taken" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create child account
    const result = await db.query(
      `INSERT INTO app2.users (first_name, username, password_hash, parent_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, first_name, username`,
      [firstName, username, hashedPassword, req.userId],
    );

    return res.status(201).json({ message: "Child account created successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error creating child account" });
  }
});



// DELETE /api/family/delete-child/:childId - delete child account
app.delete(
  "/api/family/delete-child/:childId",
  authenticateToken,
  async (req, res) => {
    const childId = req.params.childId;

    try {
      // Verify the child belongs to this parent
      const child = await db.query(
        "SELECT id FROM app2.users WHERE id = $1 AND parent_id = $2",
        [childId, req.userId],
      );

      if (child.rows.length === 0) {
        return res
          .status(403)
          .json({ message: "Unauthorized or child not found" });
      }

      // Delete the child account (cascade will handle related data)
      await db.query("DELETE FROM app2.users WHERE id = $1", [childId]);

      return res.json({ message: "Child account deleted" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error deleting child account" });
    }
  },
);

// LOGOUT
app.post("/api/logout", async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) {
    try {
      const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      if (payload?.jti && payload?.sub) {
        await db.query(
          "DELETE FROM app2.tokens WHERE id = $1 AND user_id = $2 AND type = 'refresh'",
          [payload.jti, payload.sub],
        );
      }
    } catch (e) {
      console.log(e);
    }
  }
  res.clearCookie("refreshToken", { path: "/" });
  return res.status(200).json({ message: "Logged out" });
});

// Logout מכל המכשירים
app.post("/api/logout-all", authenticateToken, async (req, res) => {
  const userId = req.userId; // מזהה המשתמש מ־JWT

  try {
    // מוחק את כל ה-refresh tokens של המשתמש מה־DB
    await db.query(
      "DELETE FROM app2.tokens WHERE user_id = $1 AND type = 'refresh'",
      [userId],
    );

    // מנקה את ה-cookie בצד הלקוח
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return res.status(200).json({ message: "Logged out from all devices" });
  } catch (err) {
    console.error("Error logging out from all devices:", err);
    return res
      .status(500)
      .json({ message: "Error logging out from all devices" });
  }
});

// password change only if user logged in!!!!
app.put("/api/user/password", authenticateToken, async (req, res) => {
  const userId = req.userId;
  const { currentPassword, newPassword, confirmNewPassword } = req.body;

  //  בדיקות בסיסיות
  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return res.status(400).json({ message: "Missing fields" });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: "Password too weak" });
  }
  if (currentPassword === newPassword) {
    return res
      .status(400)
      .json({ message: "New password must differ from current" });
  }

  try {
    const { rows } = await db.query(
      "SELECT password_hash FROM app2.users WHERE id = $1",
      [userId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const user = rows[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid current password" });
    }
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    await db.query("UPDATE app2.users SET password_hash = $1 WHERE id = $2", [
      hashedPassword,
      userId,
    ]);
    return res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error updating password" });
  }
});

app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  if (!validator.isEmail(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }
  try {
    const results = await db.query(
      "SELECT id FROM app2.users WHERE email = $1",
      [email],
    );
    if (results.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const userId = results.rows[0].id;
    const { rows } = await db.query(
      `INSERT INTO app2.tokens
      (user_id,type,expires_at,used,data)
      VALUES($1,'reset_password',NOW() + interval '15 minutes',false,NULL) RETURNING ID`,
      [userId],
    );
    const tokenId = rows[0].id;
    const token = jwt.sign(
      {
        sub: userId,
        jti: tokenId,
        type: "reset_password",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "15m",
      },
    );
    const resetUrl = `http://localhost:5173/reset-password?token=${token}`;
    // send email
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"SmartCart" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Reset your password",
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password</p>`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error resetting password" });
  }
});

app.post("/api/reset-password", async (req, res) => {
  const { token, newPassword, confirmNewPassword } = req.body;
  console.log(token);
  if (!token || !newPassword || !confirmNewPassword) {
    return res.status(400).json({ message: "Missing fields" });
  }
  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: "Password too weak" });
  }
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decodedToken.sub;
    const { rows } = await db.query(
      `SELECT expires_at, used
   FROM app2.tokens
   WHERE user_id = $1 AND type = 'reset_password' AND id = $2 AND expires_at > NOW()`,
      [userId, decodedToken.jti],
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Token not found" });
    }
    const tokenData = rows[0];

    if (tokenData.used) {
      return res.status(400).json({ message: "Token already used" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    const results = await db.query(
      `SELECT password_hash FROM app2.users WHERE id = $1`,
      [userId],
    );
    if (results.rows.length === 0) {
      return res.status(404).json({ message: "Token not found" });
    }

    const oldPassword = results.rows[0].password_hash;
    if (oldPassword === hashedPassword) {
      return res
        .status(400)
        .json({ message: "New password must differ from current" });
    }

    await db.query(`UPDATE app2.users SET password_hash = $1 WHERE id = $2`, [
      hashedPassword,
      userId,
    ]);

    await db.query(`UPDATE app2.tokens SET used = true WHERE id = $1`, [
      decodedToken.jti,
    ]);

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error resetting password" });
  }
});



// === LIST ROUTES ===

// GET /api/lists — all lists for the authenticated user
app.get("/api/lists", authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT l.id, l.list_name, l.status, l.created_at, l.updated_at, lm.status AS role
       FROM app.list l
       JOIN app.list_members lm ON lm.list_id = l.id
       WHERE lm.user_id = $1
       ORDER BY l.updated_at DESC`,
      [req.userId],
    );
    return res.json({ lists: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error fetching lists" });
  }
});

// GET /api/lists/:id/items — list detail + items + members + user role
app.get("/api/lists/:id/items", authenticateToken, async (req, res) => {
  const listId = req.params.id;
  try {
    // Check membership
    const membership = await db.query(
      "SELECT status FROM app.list_members WHERE list_id = $1 AND user_id = $2",
      [listId, req.userId],
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ message: "Not a member of this list" });
    }

    const listRes = await db.query("SELECT * FROM app.list WHERE id = $1", [
      listId,
    ]); // מקבל רשימה 
    if (listRes.rows.length === 0)
      return res.status(404).json({ message: "List not found" });

    const itemsRes = await db.query(// מקבל מי שילם ומי שם הערה וכל המוצרים והמידע על אותה הרשימה
      `SELECT li.*, u.first_name AS paid_by_name, u2.first_name AS note_by_name
       FROM app.list_items li
       LEFT JOIN app2.users u ON li.paid_by = u.id
       LEFT JOIN app2.users u2 ON li.id = u2.id
       WHERE li.listid = $1
       ORDER BY li.addat DESC`,
      [listId],
    );

    const membersRes = await db.query( // מקבל חברי רשימה ואת הגישות
      `SELECT u.id, u.first_name, u.last_name, lm.status AS role
       FROM app.list_members lm
       JOIN app2.users u ON lm.user_id = u.id
       WHERE lm.list_id = $1`,
      [listId],
    );

    return res.json({
      list: listRes.rows[0],
      items: itemsRes.rows,
      members: membersRes.rows,
      userRole: membership.rows[0].status,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error fetching list details" });
  }
});

// DELETE /api/lists/:id — delete a list (admin only)
app.delete("/api/lists/:id", authenticateToken, async (req, res) => {
  const listId = req.params.id;

  try {
    // Check if user is admin of this list
    const membership = await db.query(
      "SELECT status FROM app.list_members WHERE list_id = $1 AND user_id = $2",
      [listId, req.userId],
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ message: "Not a member of this list" });
    }

    if (membership.rows[0].status !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admin can delete the list" });
    }

    // Delete the list (CASCADE will delete list_items and list_members)
    await db.query("DELETE FROM app.list WHERE id = $1", [listId]);

    return res.json({ success: true, message: "List deleted successfully" });
  } catch (err) {
    console.error("Error deleting list:", err);
    return res.status(500).json({ message: "Error deleting list" });
  }
});

// POST /api/lists/:id/leave — leave a list (members only, not admin)
app.post("/api/lists/:id/leave", authenticateToken, async (req, res) => {
  const listId = req.params.id;

  try {
    // Check if user is a member of this list
    const membership = await db.query(
      "SELECT status FROM app.list_members WHERE list_id = $1 AND user_id = $2",
      [listId, req.userId],
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ message: "Not a member of this list" });
    }

    if (membership.rows[0].status === "admin") {
      return res.status(403).json({
        message:
          "Admin cannot leave the list. Delete it or transfer admin role first.",
      });
    }

    // Remove user from list
    await db.query(
      "DELETE FROM app.list_members WHERE list_id = $1 AND user_id = $2",
      [listId, req.userId],
    );

    return res.json({ success: true, message: "Left list successfully" });
  } catch (err) {
    console.error("Error leaving list:", err);
    return res.status(500).json({ message: "Error leaving list" });
  }
});

// GET /api/lists/:id/compare — price comparison across chains
app.get("/api/lists/:id/compare", authenticateToken, async (req, res) => {
  const listId = req.params.id;
  try {
    // Get list items that have a linked product_id
    const itemsRes = await db.query(
      `SELECT li.id, li.itemname, li.quantity, li.product_id
       FROM app.list_items li
       WHERE li.listid = $1`,
      [listId],
    );
    const allItems = itemsRes.rows;
    const linkedItems = allItems.filter((i) => i.product_id);
    const unlinkedCount = allItems.length - linkedItems.length;

    if (linkedItems.length === 0) {
      return res.json({ chains: [], linkedCount: 0, unlinkedCount });
    }

    const productIds = linkedItems.map((i) => i.product_id);

    // Get best price per product per chain
    const pricesRes = await db.query(
      `SELECT DISTINCT ON (c.id, p.item_id)
              c.id AS chain_id, c.name AS chain_name,
              p.item_id AS product_id, p.price
       FROM app.prices p
       JOIN app.branches b ON p.branch_id = b.id
       JOIN app.chains c ON b.chain_id = c.id
       WHERE p.item_id = ANY($1)
       ORDER BY c.id, p.item_id, p.price ASC`,
      [productIds],
    );

    // Group by chain
    const chainMap = {};
    for (const row of pricesRes.rows) {
      if (!chainMap[row.chain_id]) {
        chainMap[row.chain_id] = {
          chainId: row.chain_id,
          chainName: row.chain_name,
          prices: {},
        };
      }
      chainMap[row.chain_id].prices[row.product_id] = parseFloat(row.price);
    }

    // Build comparison
    const chains = Object.values(chainMap).map((chain) => {
      let total = 0;
      let missingCount = 0;
      const items = linkedItems.map((li) => {
        const price = chain.prices[li.product_id];
        const qty = parseFloat(li.quantity) || 1;
        if (price !== undefined) {
          const subtotal = price * qty;
          total += subtotal;
          return {
            itemName: li.itemname,
            price,
            quantity: qty,
            subtotal,
            available: true,
          };
        } else {
          missingCount++;
          return {
            itemName: li.itemname,
            price: 0,
            quantity: qty,
            subtotal: 0,
            available: false,
          };
        }
      });
      return {
        chainId: chain.chainId,
        chainName: chain.chainName,
        total,
        items,
        missingCount,
        complete: missingCount === 0,
      };
    });

    chains.sort((a, b) => a.total - b.total);

    return res.json({ chains, linkedCount: linkedItems.length, unlinkedCount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error comparing prices" });
  }
});

// POST /api/lists/:id/invite — generate invite link
app.post("/api/lists/:id/invite", authenticateToken, async (req, res) => {
  const listId = req.params.id;
  try {
    const membership = await db.query(
      "SELECT status FROM app.list_members WHERE list_id = $1 AND user_id = $2",
      [listId, req.userId],
    );
    if (membership.rows.length === 0 || membership.rows[0].status !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admins can create invites" });
    }

    const crypto = await import("crypto");
    const inviteCode = crypto.randomBytes(16).toString("hex");

    await db.query(
      `INSERT INTO app.list_invites (list_id, invite_code, created_by, expires_at)
       VALUES ($1, $2, $3, NOW() + interval '7 days')`,
      [listId, inviteCode, req.userId],
    );

    const host =
      process.env.host_allowed?.split(",")[0] || "http://localhost:5173";
    return res.json({ inviteLink: `${host}/invite/${inviteCode}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error creating invite" });
  }
});

// POST /api/lists/:id/items — add item to list
app.post("/api/lists/:id/items", authenticateToken, async (req, res) => {
  const listId = req.params.id;
  console.log("=== ADD ITEM DEBUG ===");
  console.log("Request body:", JSON.stringify(req.body, null, 2));
  const { itemName, price, storeName, quantity, productId } = req.body;

  if (!itemName || itemName.trim() === "") {
    return res.status(400).json({ message: "Item name is required" });
  }

  try {
    // Check user has access to this list
    const membership = await db.query(
      "SELECT id FROM app.list_members WHERE list_id = $1 AND user_id = $2",
      [listId, req.userId],
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ message: "Not a member of this list" });
    }

    // Insert item (Note: table uses camelCase for listId, itemName, storeName!)
    const result = await db.query(
      `INSERT INTO app.list_items (listId, itemName, price, storeName, quantity, addby, addat, updatedat, product_id)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7)
       RETURNING *`,
      [
        listId,
        itemName,
        price || null,
        storeName || null,
        quantity || 1,
        req.userId,
        productId || null,
      ],
    );

    const newItem = result.rows[0];

    // Increment popularity_points for the linked product
    if (productId) {
      db.query(
        `UPDATE app.items SET popularity_points = COALESCE(popularity_points, 0) + 1 WHERE id = $1`,
        [productId],
      ).catch((e) => console.error("Error updating popularity:", e.message));
    }

    // Emit to socket.io room for real-time updates
    io.to(String(listId)).emit("receive_item", newItem);

    return res.status(201).json({ item: newItem });
  } catch (err) {
    console.error("Error adding item to list:", err.message);
    console.error("Stack:", err.stack);
    return res
      .status(500)
      .json({ message: "Error adding item", error: err.message });
  }
});

// GET /api/family/children — get all children for parent
app.get("/api/family/children", authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, first_name, username, created_at
       FROM app2.users
       WHERE parent_id = $1
       ORDER BY created_at DESC`,
      [req.userId],
    );
    return res.json({ children: rows });
  } catch (err) {
    console.error("Error fetching children:", err);
    return res.status(500).json({ message: "Error fetching children" });
  }
});




// GET /api/lists/:id/children — get parent's children with membership status
app.get("/api/lists/:id/children", authenticateToken, async (req, res) => {
  const listId = req.params.id;
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.first_name, u.username,
              CASE WHEN lm.id IS NOT NULL THEN true ELSE false END AS is_member
       FROM app2.users u
       LEFT JOIN app.list_members lm ON lm.list_id = $1 AND lm.user_id = u.id
       WHERE u.parent_id = $2`,
      [listId, req.userId],
    );
    return res.json({ children: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error fetching children" });
  }
});

// POST /api/lists/:id/children/:childId — add child to list
app.post(
  "/api/lists/:id/children/:childId",
  authenticateToken,
  async (req, res) => {
    const { id: listId, childId } = req.params;
    try {
      // Verify child belongs to this parent
      const child = await db.query(
        "SELECT id FROM app2.users WHERE id = $1 AND parent_id = $2",
        [childId, req.userId],
      );
      if (child.rows.length === 0)
        return res.status(403).json({ message: "Not your child" });

      await db.query(
        `INSERT INTO app.list_members (list_id, user_id, status) VALUES ($1, $2, 'member')
       ON CONFLICT (list_id, user_id) DO NOTHING`,
        [listId, childId],
      );
      return res.json({ success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error adding child" });
    }
  },
);

// DELETE /api/lists/:id/children/:childId — remove child from list
app.delete(
  "/api/lists/:id/children/:childId",
  authenticateToken,
  async (req, res) => {
    const { id: listId, childId } = req.params;
    try {
      const child = await db.query(
        "SELECT id FROM app2.users WHERE id = $1 AND parent_id = $2",
        [childId, req.userId],
      );
      if (child.rows.length === 0)
        return res.status(403).json({ message: "Not your child" });

      await db.query(
        "DELETE FROM app.list_members WHERE list_id = $1 AND user_id = $2",
        [listId, childId],
      );
      return res.json({ success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error removing child" });
    }
  },
);

// GET /api/templates — get user's templates
app.get("/api/templates", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.id, t.template_name, t.created_at,
              COUNT(ti.id) AS item_count
       FROM app.list_templates t
       LEFT JOIN app.template_items ti ON ti.template_id = t.id
       WHERE t.user_id = $1
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
      [req.userId],
    );
    return res.json({ templates: result.rows });
  } catch (err) {
    console.error("Error fetching templates:", err);
    return res.status(500).json({ message: "Error fetching templates" });
  }
});

// POST /api/templates — create template from list
app.post("/api/templates", authenticateToken, async (req, res) => {
  const { listId, templateName } = req.body;

  if (!listId || !templateName) {
    return res
      .status(400)
      .json({ message: "listId and templateName required" });
  }

  try {
    // Verify user is admin of the list
    const memberCheck = await db.query(
      "SELECT status FROM app.list_members WHERE list_id = $1 AND user_id = $2",
      [listId, req.userId],
    );

    if (
      memberCheck.rows.length === 0 ||
      memberCheck.rows[0].status !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Only list admin can create templates" });
    }

    // Create template
    const templateResult = await db.query(
      "INSERT INTO app.list_templates (user_id, template_name, created_at) VALUES ($1, $2, NOW()) RETURNING id",
      [req.userId, templateName],
    );
    const templateId = templateResult.rows[0].id;

    // Copy items from list to template
    const itemsRes = await db.query(
      "SELECT itemName, quantity, note, product_id FROM app.list_items WHERE listId = $1 ORDER BY id",
      [listId],
    );

    for (let i = 0; i < itemsRes.rows.length; i++) {
      const item = itemsRes.rows[i];
      await db.query(
        `INSERT INTO app.template_items (template_id, item_name, quantity, note, sort_order, product_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          templateId,
          item.itemname,
          item.quantity || 1,
          item.note,
          i,
          item.product_id || null,
        ],
      );
    }

    return res.json({ templateId, message: "Template created successfully" });
  } catch (err) {
    console.error("Error creating template:", err);
    return res.status(500).json({ message: "Error creating template" });
  }
});

// POST /api/templates/:id/apply — create list from template
app.post("/api/templates/:id/apply", authenticateToken, async (req, res) => {
  const templateId = req.params.id;
  const { listName } = req.body;

  try {
    // Verify template belongs to user
    const templateCheck = await db.query(
      "SELECT id, template_name FROM app.list_templates WHERE id = $1 AND user_id = $2",
      [templateId, req.userId],
    );

    if (templateCheck.rows.length === 0) {
      return res.status(404).json({ message: "Template not found" });
    }

    const template = templateCheck.rows[0];
    const newListName = listName || template.template_name;

    // Create new list
    const listResult = await db.query(
      "INSERT INTO app.list (list_name) VALUES ($1) RETURNING id",
      [newListName],
    );
    const newListId = listResult.rows[0].id;

    // Add user as admin
    await db.query(
      "INSERT INTO app.list_members (list_id, user_id, status) VALUES ($1, $2, 'admin')",
      [newListId, req.userId],
    );

    // Copy template items to new list
    const items = await db.query(
      "SELECT item_name, quantity, note, product_id FROM app.template_items WHERE template_id = $1 ORDER BY sort_order",
      [templateId],
    );

    for (const item of items.rows) {
      await db.query(
        `INSERT INTO app.list_items (listId, itemName, quantity, note, addby, addat, updatedat, product_id)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6)`,
        [
          newListId,
          item.item_name,
          item.quantity || 1,
          item.note,
          req.userId,
          item.product_id || null,
        ],
      );

      // Increment points for template items
      if (item.product_id) {
        db.query(
          `UPDATE app.items SET popularity_points = COALESCE(popularity_points, 0) + 1 WHERE id = $1`,
          [item.product_id],
        ).catch((e) =>
          console.error("Error updating popularity from template:", e.message),
        );
      }
    }

    return res.json({
      listId: newListId,
      message: "List created from template",
    });
  } catch (err) {
    console.error("Error applying template:", err);
    return res
      .status(500)
      .json({ message: "Error creating list from template" });
  }
});

// DELETE /api/templates/:id — delete template
app.delete("/api/templates/:id", authenticateToken, async (req, res) => {
  const templateId = req.params.id;

  try {
    // Verify template belongs to user
    const templateCheck = await db.query(
      "SELECT id FROM app.list_templates WHERE id = $1 AND user_id = $2",
      [templateId, req.userId],
    );

    if (templateCheck.rows.length === 0) {
      return res.status(404).json({ message: "Template not found" });
    }

    // Delete template (CASCADE will delete template_items)
    await db.query("DELETE FROM app.list_templates WHERE id = $1", [
      templateId,
    ]);

    return res.json({ success: true, message: "Template deleted" });
  } catch (err) {
    console.error("Error deleting template:", err);
    return res.status(500).json({ message: "Error deleting template" });
  }
});

// GET /api/kid-requests/pending — get pending requests for parent
app.get("/api/kid-requests/pending", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        kr.id,
        kr.item_name,
        kr.price,
        kr.quantity,
        kr.product_id,
        kr.created_at,
        u.first_name as child_first_name,
        l.list_name
       FROM app2.kid_requests kr
       JOIN app2.users u ON u.id = kr.child_id
       JOIN app.list l ON l.id = kr.list_id
       WHERE kr.parent_id = $1 AND kr.status = 'pending'
       ORDER BY kr.created_at DESC`,
      [req.userId],
    );
    return res.json({ requests: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error fetching requests" });
  }
});

// GET /api/kid-requests/my — get child's own request history
app.get("/api/kid-requests/my", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        kr.id,
        kr.item_name,
        kr.price,
        kr.quantity,
        kr.status,
        kr.created_at,
        kr.product_id,
        l.list_name
       FROM app2.kid_requests kr
       LEFT JOIN app.list l ON l.id = kr.list_id
       WHERE kr.child_id = $1
       ORDER BY kr.created_at DESC`,
      [req.userId],
    );
    return res.json({ requests: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error fetching requests" });
  }
});

// POST /api/kid-requests — child requests to add item
app.post("/api/kid-requests", authenticateToken, async (req, res) => {
  const { listId, itemName, price, storeName, quantity, productId } = req.body;
  try {
    // Get the child's parent and child info
    const userRes = await db.query(
      "SELECT parent_id, first_name FROM app2.users WHERE id = $1",
      [req.userId],
    );
    if (userRes.rows.length === 0 || !userRes.rows[0].parent_id) {
      return res.status(403).json({ message: "Not a child account" });
    }
    const parentId = userRes.rows[0].parent_id;
    const childName = userRes.rows[0].first_name;

    // Get list name
    const listRes = await db.query(
      "SELECT list_name FROM app.list WHERE id = $1",
      [listId],
    );
    const listName = listRes.rows[0]?.list_name || "רשימה";

    const result = await db.query(
      `INSERT INTO app2.kid_requests (child_id, parent_id, list_id, item_name, price, store_name, quantity, product_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        req.userId,
        parentId,
        listId,
        itemName,
        price,
        storeName,
        quantity || 1,
        productId || null,
      ],
    );

    // Emit real-time notification to parent
    const requestId = result.rows[0].id;
    io.to(`user_${parentId}`).emit("new_kid_request", {
      id: requestId,
      requestId: requestId,
      childName: childName,
      child_first_name: childName,
      itemName: itemName,
      item_name: itemName,
      listName: listName,
      list_name: listName,
      quantity: quantity || 1,
      price: price,
      productId: productId,
      product_id: productId,
    });

    return res.status(201).json({ message: "Request sent" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error creating request" });
  }
});

// POST /api/kid-requests/:id/resolve — approve or reject child request
app.post(
  "/api/kid-requests/:id/resolve",
  authenticateToken,
  async (req, res) => {
    const requestId = req.params.id;
    const { action } = req.body; // "approve" or "reject"

    if (action !== "approve" && action !== "reject") {
      return res.status(400).json({ message: "Invalid action" });
    }

    try {
      // Get the request and verify it belongs to this parent
      const requestResult = await db.query(
        `SELECT kr.*, u.first_name as child_first_name
       FROM app2.kid_requests kr
       JOIN app2.users u ON u.id = kr.child_id
       WHERE kr.id = $1 AND kr.parent_id = $2`,
        [requestId, req.userId],
      );

      if (requestResult.rows.length === 0) {
        return res.status(403).json({ message: "Not your child's request" });
      }

      const request = requestResult.rows[0];
      const newStatus = action === "approve" ? "approved" : "rejected";

      // Update request status
      await db.query("UPDATE app2.kid_requests SET status = $1 WHERE id = $2", [
        newStatus,
        requestId,
      ]);

      // If approved, add the item to the list
      if (action === "approve") {
        const itemResult = await db.query(
          `INSERT INTO app.list_items (listId, itemName, price, storeName, quantity, addby, addat, updatedat, product_id)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7)
         RETURNING *`,
          [
            request.list_id,
            request.item_name,
            request.price || null,
            request.store_name || null,
            request.quantity || 1,
            request.child_id, // Item added by the child
            request.product_id || null,
          ],
        );

        // Emit to list room so all members see the new item
        io.to(String(request.list_id)).emit("receive_item", itemResult.rows[0]);

        // Increment popularity_points for approved request
        if (request.product_id) {
          db.query(
            `UPDATE app.items SET popularity_points = COALESCE(popularity_points, 0) + 1 WHERE id = $1`,
            [request.product_id],
          ).catch((e) =>
            console.error("Error updating popularity from request:", e.message),
          );
        }
      }

      // Notify the child that their request was resolved
      io.to(`user_${request.child_id}`).emit("request_resolved", {
        requestId: requestId,
        status: newStatus,
      });

      return res.json({
        success: true,
        message: action === "approve" ? "Request approved" : "Request rejected",
      });
    } catch (err) {
      console.error("Error resolving request:", err);
      return res.status(500).json({ message: "Error resolving request" });
    }
  },
);

// GET comments for an item
app.get(
  "/api/lists/:listId/items/:itemId/comments",
  authenticateToken,
  async (req, res) => {
    const { listId, itemId } = req.params;

    try {
      const result = await db.query(
        `SELECT c.id, c.item_id, c.user_id, c.comment, c.created_at, u.first_name
       FROM app.list_item_comments c
       JOIN app2.users u ON c.user_id = u.id
       WHERE c.item_id = $1
       ORDER BY c.created_at ASC`,
        [itemId],
      );

      res.json({ comments: result.rows });
    } catch (err) {
      console.error("Error fetching comments:", err);
      res.status(500).json({ message: "Error fetching comments" });
    }
  },
);

// Socket.io handlers
io.on("connection", (socket) => {
  socket.on("register_user", (userId) => {
    socket.join(`user_${userId}`);
    console.log(`משתמש ${userId} נרשם לחדר האישי שלו לקבלת התראות`);
  });
  socket.on("join_list", (listId) => {
    socket.join(listId);
    console.log(`משתמש הצטרף לרשימה מספר: ${listId}`);
  });
  socket.on("send_item", async (data) => {
    const {
      listId,
      itemName,
      price,
      storeName,
      quantity,
      addby,
      addat,
      updatedat,
      productId,
    } = data;
    try {
      const query = `INSERT INTO app.list_items (listId, itemName, price, storeName, quantity, addby, addat, updatedat, product_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`;

      const values = [
        listId,
        itemName,
        price,
        storeName,
        quantity,
        addby,
        addat,
        updatedat,
        productId || null,
      ];
      const result = await db.query(query, values);
      const newItem = result.rows[0];

      // Increment popularity_points for socket add
      if (productId) {
        db.query(
          `UPDATE app.items SET popularity_points = COALESCE(popularity_points, 0) + 1 WHERE id = $1`,
          [productId],
        ).catch((e) =>
          console.error("Error updating popularity from socket:", e.message),
        );
      }

      io.to(String(listId)).emit("receive_item", newItem);
    } catch (e) {
      console.error("שגיאה בשמירה ל-DB:", e);
      console.error("Error details:", e.message);
    }
  });


  socket.on("delete_item", async (data) => {
    const { itemId, listId } = data;
    try {
      await db.query("DELETE FROM app.list_items WHERE id = $1", [itemId]);
      io.to(String(listId)).emit("item_deleted", { itemId });
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  });

  socket.on("mark_paid", async (data) => {
    const { itemId, listId, userId } = data;
    try {
      const result = await db.query(
        "UPDATE app.list_items SET paid_by = $1, paid_at = NOW() WHERE id = $2 RETURNING paid_at",
        [userId, itemId],
      );
      const paid_at = result.rows[0]?.paid_at;

      // Get user name
      const userResult = await db.query(
        "SELECT first_name FROM app2.users WHERE id = $1",
        [userId],
      );
      const paid_by_name = userResult.rows[0]?.first_name;

      io.to(String(listId)).emit("item_paid", {
        itemId,
        paid_by: userId,
        paid_by_name,
        paid_at,
      });
    } catch (err) {
      console.error("Error marking paid:", err);
    }
  });

  socket.on("unmark_paid", async (data) => {
    const { itemId, listId } = data;
    try {
      await db.query(
        "UPDATE app.list_items SET paid_by = NULL, paid_at = NULL WHERE id = $1",
        [itemId],
      );
      io.to(String(listId)).emit("item_unpaid", { itemId });
    } catch (err) {
      console.error("Error unmarking paid:", err);
    }
  });

  socket.on("update_note", async (data) => {
    const { itemId, listId, note, userId } = data;
    try {
      await db.query(
        "UPDATE app.list_items SET note = $1, note_by = $2 WHERE id = $3",
        [note || null, userId, itemId],
      );

      // Get user name
      const userResult = await db.query(
        "SELECT first_name FROM app2.users WHERE id = $1",
        [userId],
      );
      const note_by_name = userResult.rows[0]?.first_name;

      io.to(String(listId)).emit("note_updated", {
        itemId,
        note,
        note_by: userId,
        note_by_name,
      });
    } catch (err) {
      console.error("Error updating note:", err);
    }
  });

  socket.on("create_list", async (list, callback) => {
    const { list_name, userId } = list;
    if (!list_name || !userId)
      return callback({ success: false, error: `missing data` });
    try {
      // Check if user is a child account (prevent children from creating lists)
      const userCheck = await db.query(
        "SELECT parent_id FROM app2.users WHERE id = $1",
        [userId],
      );
      if (userCheck.rows.length === 0) {
        return callback({ success: false, error: "User not found" });
      }
      if (userCheck.rows[0].parent_id !== null) {
        return callback({
          success: false,
          error: "Child accounts cannot create lists",
        });
      }

      const listRes = await db.query(
        `INSERT INTO app.list (list_name) VALUES ($1) RETURNING id`,
        [list_name],
      );
      const newListId = listRes.rows[0].id;
      await db.query(
        `INSERT INTO app.list_members (list_id, user_id, status) VALUES ($1, $2, $3)`,
        [newListId, userId, "admin"],
      );
      callback({ success: true, listId: newListId });
    } catch (e) {
      console.error(e);
      callback({ success: false, msg: `db eror` });
    }
    socket.on("user_joined", async (data, callback) => {
      const listId = data.listid;
      const userId = data.user_id;
      try {
        const checkQuery = await db.query(
          `SELECT * FROM app.list_users WHERE list_id = $1 AND user_id = $2`,
          [listId, userId],
        );
        if (checkQuery.rows.length === 0) {
          await db.query(
            `INSERT INTO app.list_users (list_id, user_id) VALUES ($1, $2)`,
            [listId, userId],
          );
        }
        socket.join(listId);
        socket.to(listId).emit("notification", {
          message: `משתמש חדש הצטרף לרשימה!`,
          userId: userId,
        });
      } catch (e) {
        callback({ success: false, msg: `db eror` });
      }
    });
  });

  // DELETE ITEM
  socket.on("delete_item", async (data) => {
    const { itemId, listId } = data;
    try {
      await db.query("DELETE FROM app.list_items WHERE id = $1", [itemId]);
      io.to(listId).emit("item_deleted", { itemId });
    } catch (err) {
      console.error("Error deleting item:", err);
    }
  });

  // MARK PAID
  socket.on("mark_paid", async (data) => {
    const { itemId, listId, userId } = data;
    try {
      await db.query("UPDATE app.list_items SET paid_by = $1 WHERE id = $2", [
        userId,
        itemId,
      ]);
      const userRes = await db.query(
        "SELECT first_name FROM app2.users WHERE id = $1",
        [userId],
      );
      const userName = userRes.rows[0]?.first_name || "User";

      io.to(listId).emit("item_paid", {
        itemId,
        paidBy: userId,
        paidByName: userName,
      });
    } catch (err) {
      console.error("Error marking paid:", err);
    }
  });

  // UNMARK PAID
  socket.on("unmark_paid", async (data) => {
    const { itemId, listId } = data;
    try {
      await db.query("UPDATE app.list_items SET paid_by = NULL WHERE id = $1", [
        itemId,
      ]);
      io.to(listId).emit("item_paid_status", { itemId, paidBy: null });
    } catch (err) {
      console.error("Error unmarking paid:", err);
    }
  });

  // ADD COMMENT
  socket.on("add_comment", async (data) => {
    const { itemId, listId, userId, comment } = data;
    try {
      // Check if user already has a comment on this item
      const existingComment = await db.query(
        `SELECT id FROM app.list_item_comments WHERE item_id = $1 AND user_id = $2`,
        [itemId, userId],
      );

      if (existingComment.rows.length > 0) {
        console.log(`User ${userId} already has a comment on item ${itemId}`);
        return;
      }

      const result = await db.query(
        `INSERT INTO app.list_item_comments (item_id, user_id, comment, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, created_at`,
        [itemId, userId, comment],
      );

      const userRes = await db.query(
        "SELECT first_name FROM app2.users WHERE id = $1",
        [userId],
      );
      const userName = userRes.rows[0]?.first_name || "User";

      const newComment = {
        id: result.rows[0].id,
        item_id: itemId,
        user_id: userId,
        first_name: userName,
        comment: comment,
        created_at: result.rows[0].created_at,
      };

      io.to(String(listId)).emit("receive_comment", {
        itemId,
        comment: newComment,
      });
    } catch (err) {
      console.error("Error adding comment:", err);
    }
  });
});

server.listen(port, () => {
  console.log(`SmartCart Server running on port : ${port}`);
});
