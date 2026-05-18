import { Router } from "express";
import crypto from "crypto";
import db from "../../shared/db.js";
import { authenticateToken } from "../../shared/auth.js";

export default function listsRoutes(io) {
  const router = Router();

  // GET /api/lists — all lists for the authenticated user
  router.get("/lists", authenticateToken, async (req, res) => {
    try {
      const { rows } = await db.query(
        `SELECT l.id, l.list_name, l.status, l.created_at, l.updated_at, lm.status AS role,
                (SELECT COUNT(*)::int FROM app.list_items   li WHERE li.listid  = l.id) AS item_count,
                (SELECT COUNT(*)::int FROM app.list_members mm WHERE mm.list_id = l.id) AS member_count
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
  router.get("/lists/:id/items", authenticateToken, async (req, res) => {
    const listId = req.params.id;
    try {
      const membership = await db.query(
        "SELECT status FROM app.list_members WHERE list_id = $1 AND user_id = $2",
        [listId, req.userId],
      );
      if (membership.rows.length === 0) {
        return res.status(403).json({ message: "Not a member of this list" });
      }

      const listRes = await db.query("SELECT * FROM app.list WHERE id = $1", [
        listId,
      ]);
      if (listRes.rows.length === 0)
        return res.status(404).json({ message: "List not found" });

      const itemsRes = await db.query(
        `SELECT li.*, u.first_name AS paid_by_name, u2.first_name AS note_by_name
         FROM app.list_items li
         LEFT JOIN app2.users u ON li.paid_by = u.id
         LEFT JOIN app2.users u2 ON li.id = u2.id
         WHERE li.listid = $1
         ORDER BY li.addat DESC`,
        [listId],
      );

      const membersRes = await db.query(
        `SELECT u.id, u.first_name, u.last_name, u.parent_id, lm.status AS role
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
  router.delete("/lists/:id", authenticateToken, async (req, res) => {
    const listId = req.params.id;

    try {
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

      await db.query("DELETE FROM app.list WHERE id = $1", [listId]);

      return res.json({ success: true, message: "List deleted successfully" });
    } catch (err) {
      console.error("Error deleting list:", err);
      return res.status(500).json({ message: "Error deleting list" });
    }
  });

  // DELETE /api/lists/:id/leave — leave a list (members only, not admin)
  router.delete("/lists/:id/leave", authenticateToken, async (req, res) => {
    const listId = req.params.id;

    try {
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

  // PUT /api/lists/:id/members/:userId/role — change a member's role (admin only)
  router.put(
    "/lists/:id/members/:userId/role",
    authenticateToken,
    async (req, res) => {
      const listId = req.params.id;
      const targetUserId = parseInt(req.params.userId, 10);
      const { role } = req.body;

      if (role !== "admin" && role !== "member") {
        return res.status(400).json({ message: "תפקיד לא חוקי" });
      }

      try {
        const adminCheck = await db.query(
          "SELECT status FROM app.list_members WHERE list_id = $1 AND user_id = $2",
          [listId, req.userId],
        );
        if (
          adminCheck.rows.length === 0 ||
          adminCheck.rows[0].status !== "admin"
        ) {
          return res.status(403).json({ message: "רק מנהל יכול לשנות תפקידים" });
        }

        const targetRes = await db.query(
          `SELECT lm.status AS role, u.parent_id
             FROM app.list_members lm
             JOIN app2.users u ON u.id = lm.user_id
            WHERE lm.list_id = $1 AND lm.user_id = $2`,
          [listId, targetUserId],
        );
        if (targetRes.rows.length === 0) {
          return res.status(404).json({ message: "המשתמש אינו חבר ברשימה" });
        }
        const target = targetRes.rows[0];

        if (target.parent_id !== null) {
          return res
            .status(403)
            .json({ message: "לא ניתן לשנות את תפקידו של ילד" });
        }

        if (target.role === role) {
          return res.json({ success: true, role });
        }

        if (
          targetUserId === req.userId &&
          target.role === "admin" &&
          role === "member"
        ) {
          const adminCount = await db.query(
            `SELECT COUNT(*)::int AS c
               FROM app.list_members
              WHERE list_id = $1 AND status = 'admin'`,
            [listId],
          );
          if (adminCount.rows[0].c <= 1) {
            return res.status(400).json({
              message: "לא ניתן להוריד את עצמך כשאתה המנהל היחיד ברשימה",
            });
          }
        }

        await db.query(
          `UPDATE app.list_members SET status = $1
            WHERE list_id = $2 AND user_id = $3`,
          [role, listId, targetUserId],
        );

        return res.json({ success: true, role });
      } catch (err) {
        console.error("Error updating member role:", err);
        return res.status(500).json({ message: "שגיאה בעדכון התפקיד" });
      }
    },
  );

  // DELETE /api/lists/:id/members/:userId — kick a member (admin only)
  router.delete(
    "/lists/:id/members/:userId",
    authenticateToken,
    async (req, res) => {
      const listId = req.params.id;
      const targetUserId = parseInt(req.params.userId, 10);

      if (targetUserId === req.userId) {
        return res
          .status(400)
          .json({ message: "אינך יכול להסיר את עצמך — השתמש בעזיבת הרשימה" });
      }

      try {
        const adminCheck = await db.query(
          "SELECT status FROM app.list_members WHERE list_id = $1 AND user_id = $2",
          [listId, req.userId],
        );
        if (
          adminCheck.rows.length === 0 ||
          adminCheck.rows[0].status !== "admin"
        ) {
          return res.status(403).json({ message: "רק מנהל יכול להסיר חברים" });
        }

        const targetRes = await db.query(
          "SELECT id FROM app.list_members WHERE list_id = $1 AND user_id = $2",
          [listId, targetUserId],
        );
        if (targetRes.rows.length === 0) {
          return res.status(404).json({ message: "המשתמש אינו חבר ברשימה" });
        }

        await db.query(
          "DELETE FROM app.list_members WHERE list_id = $1 AND user_id = $2",
          [listId, targetUserId],
        );

        return res.json({ success: true });
      } catch (err) {
        console.error("Error removing member:", err);
        return res.status(500).json({ message: "שגיאה בהסרת חבר" });
      }
    },
  );

  // GET /api/lists/:id/compare — price comparison across chains
  router.get("/lists/:id/compare", authenticateToken, async (req, res) => {
    const listId = req.params.id;
    try {
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
  router.post("/lists/:id/invite", authenticateToken, async (req, res) => {
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

      const inviteCode = crypto.randomBytes(16).toString("hex");

      await db.query(
        `INSERT INTO app.list_invites (list_id, invite_code, created_by, expires_at)
         VALUES ($1, $2, $3, NOW() + interval '7 days')`,
        [listId, inviteCode, req.userId],
      );

      const host =
        process.env.host_allowed?.split(",")[0] || "http://localhost:5173";
      return res.json({ inviteLink: `${host}/join/${inviteCode}` });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error creating invite" });
    }
  });

  // POST /api/join/:inviteCode — accept an invite (parent accounts only)
  router.post("/join/:inviteCode", authenticateToken, async (req, res) => {
    const { inviteCode } = req.params;
    try {
      const userCheck = await db.query(
        "SELECT parent_id FROM app2.users WHERE id = $1",
        [req.userId],
      );
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      if (userCheck.rows[0].parent_id !== null) {
        return res
          .status(403)
          .json({ message: "רק משתמשים הורים יכולים להצטרף לרשימה" });
      }

      const inviteRes = await db.query(
        `SELECT i.list_id, l.list_name
           FROM app.list_invites i
           JOIN app.list l ON l.id = i.list_id
          WHERE i.invite_code = $1
            AND (i.expires_at IS NULL OR i.expires_at > NOW())`,
        [inviteCode],
      );
      if (inviteRes.rows.length === 0) {
        return res
          .status(404)
          .json({ message: "קישור ההזמנה אינו תקין או פג תוקף" });
      }
      const { list_id: listId, list_name: listName } = inviteRes.rows[0];

      const existing = await db.query(
        "SELECT status FROM app.list_members WHERE list_id = $1 AND user_id = $2",
        [listId, req.userId],
      );
      if (existing.rows.length > 0) {
        return res.json({ listId, listName, alreadyMember: true });
      }

      await db.query(
        "INSERT INTO app.list_members (list_id, user_id, status) VALUES ($1, $2, 'member')",
        [listId, req.userId],
      );

      return res.json({ listId, listName, alreadyMember: false });
    } catch (err) {
      console.error("Error joining list:", err);
      return res.status(500).json({ message: "שגיאה בהצטרפות לרשימה" });
    }
  });

  // POST /api/lists/:id/items — add item to list
  router.post("/lists/:id/items", authenticateToken, async (req, res) => {
    const listId = req.params.id;
    console.log("=== ADD ITEM DEBUG ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    const { itemName, price, storeName, quantity, productId } = req.body;

    if (!itemName || itemName.trim() === "") {
      return res.status(400).json({ message: "Item name is required" });
    }

    try {
      const membership = await db.query(
        "SELECT id FROM app.list_members WHERE list_id = $1 AND user_id = $2",
        [listId, req.userId],
      );
      if (membership.rows.length === 0) {
        return res.status(403).json({ message: "Not a member of this list" });
      }

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

      if (productId) {
        db.query(
          `UPDATE app.items SET popularity_points = COALESCE(popularity_points, 0) + 1 WHERE id = $1`,
          [productId],
        ).catch((e) => console.error("Error updating popularity:", e.message));
      }

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

  // GET /api/lists/:id/children — get parent's children with membership status
  router.get("/lists/:id/children", authenticateToken, async (req, res) => {
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
  router.post(
    "/lists/:id/children/:childId",
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

  // GET /api/lists/:listId/items/:itemId/comments — fetch comments for an item
  router.get(
    "/lists/:listId/items/:itemId/comments",
    authenticateToken,
    async (req, res) => {
      const { itemId } = req.params;

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

  // DELETE /api/lists/:id/children/:childId — remove child from list
  router.delete(
    "/lists/:id/children/:childId",
    authenticateToken,
    async (req, res) => {
      const { id: listId, childId } = req.params;
      try {
        const child = await db.query(
          "SELECT id FROM app2.users WHERE id = $1 AND parent_id = $2",
          [childId, req.userId],
        );
        if (child.rows.length === 0)
          return res.status(403).json({ message: "no childrens" });

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

  return router;
}
