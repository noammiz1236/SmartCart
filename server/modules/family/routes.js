import { Router } from "express";
import bcrypt from "bcrypt";
import db from "../../shared/db.js";
import { authenticateToken } from "../../shared/auth.js";

const router = Router();
const saltRounds = 10;

// POST /api/family/create-child - create child account
router.post("/family/create-child", authenticateToken, async (req, res) => {
  const { firstName, username, password } = req.body;

  try {
    if (!firstName || !username || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (password.length < 4) {
      return res
        .status(400)
        .json({ message: "Password must be at least 4 characters" });
    }

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

    const existing = await db.query(
      "SELECT id FROM app2.users WHERE username = $1",
      [username],
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await db.query(
      `INSERT INTO app2.users (first_name, username, password_hash, parent_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, first_name, username`,
      [firstName, username, hashedPassword, req.userId],
    );

    return res
      .status(201)
      .json({ message: "Child account created successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error creating child account" });
  }
});

// DELETE /api/family/delete-child/:childId - delete child account
router.delete(
  "/family/delete-child/:childId",
  authenticateToken,
  async (req, res) => {
    const childId = req.params.childId;

    try {
      const child = await db.query(
        "SELECT id FROM app2.users WHERE id = $1 AND parent_id = $2",
        [childId, req.userId],
      );

      if (child.rows.length === 0) {
        return res
          .status(403)
          .json({ message: "Unauthorized or child not found" });
      }

      await db.query("DELETE FROM app2.users WHERE id = $1", [childId]);

      return res.json({ message: "Child account deleted" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error deleting child account" });
    }
  },
);

// GET /api/family/children — get all children for parent
router.get("/family/children", authenticateToken, async (req, res) => {
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

export default router;
