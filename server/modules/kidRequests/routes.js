import { Router } from "express";
import db from "../../shared/db.js";
import { authenticateToken } from "../../shared/auth.js";

export default function kidRequestsRoutes(io) {
  const router = Router();

  // GET /api/kid-requests/pending — pending requests across every list this user admins
  router.get("/kid-requests/pending", authenticateToken, async (req, res) => {
    try {
      const result = await db.query(
        `SELECT
          kr.id,
          kr.item_name,
          kr.price,
          kr.quantity,
          kr.product_id,
          kr.list_id,
          kr.created_at,
          u.first_name as child_first_name,
          l.list_name
         FROM app2.kid_requests kr
         JOIN app2.users u ON u.id = kr.child_id
         JOIN app.list l ON l.id = kr.list_id
         WHERE kr.status = 'pending'
           AND EXISTS (
             SELECT 1 FROM app.list_members lm
              WHERE lm.list_id = kr.list_id
                AND lm.user_id = $1
                AND lm.status = 'admin'
           )
         ORDER BY kr.created_at DESC`,
        [req.userId],
      );
      return res.json({ requests: result.rows });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error fetching requests" });
    }
  });

  // GET /api/kid-requests/my — child's own request history
  router.get("/kid-requests/my", authenticateToken, async (req, res) => {
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
  router.post("/kid-requests", authenticateToken, async (req, res) => {
    const { listId, itemName, price, storeName, quantity, productId } =
      req.body;
    try {
      const userRes = await db.query(
        "SELECT parent_id, first_name FROM app2.users WHERE id = $1",
        [req.userId],
      );
      if (userRes.rows.length === 0 || !userRes.rows[0].parent_id) {
        return res.status(403).json({ message: "Not a child account" });
      }
      const parentId = userRes.rows[0].parent_id;
      const childName = userRes.rows[0].first_name;

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

      const requestId = result.rows[0].id;
      const adminsRes = await db.query(
        `SELECT user_id FROM app.list_members
          WHERE list_id = $1 AND status = 'admin'`,
        [listId],
      );
      const payload = {
        id: requestId,
        requestId: requestId,
        childName: childName,
        child_first_name: childName,
        itemName: itemName,
        item_name: itemName,
        listName: listName,
        list_name: listName,
        list_id: parseInt(listId, 10),
        quantity: quantity || 1,
        price: price,
        productId: productId,
        product_id: productId,
      };
      for (const row of adminsRes.rows) {
        io.to(`user_${row.user_id}`).emit("new_kid_request", payload);
      }

      return res.status(201).json({ message: "Request sent" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error creating request" });
    }
  });

  // POST /api/kid-requests/:id/resolve — approve or reject child request
  router.post(
    "/kid-requests/:id/resolve",
    authenticateToken,
    async (req, res) => {
      const requestId = req.params.id;
      const { action } = req.body;

      if (action !== "approve" && action !== "reject") {
        return res.status(400).json({ message: "Invalid action" });
      }

      try {
        const requestResult = await db.query(
          `SELECT kr.*, u.first_name as child_first_name
         FROM app2.kid_requests kr
         JOIN app2.users u ON u.id = kr.child_id
         WHERE kr.id = $1`,
          [requestId],
        );

        if (requestResult.rows.length === 0) {
          return res.status(404).json({ message: "הבקשה לא נמצאה" });
        }

        const request = requestResult.rows[0];

        const adminCheck = await db.query(
          `SELECT 1 FROM app.list_members
            WHERE list_id = $1 AND user_id = $2 AND status = 'admin'`,
          [request.list_id, req.userId],
        );
        if (adminCheck.rows.length === 0) {
          return res
            .status(403)
            .json({ message: "רק מנהל הרשימה יכול לאשר/לדחות בקשות" });
        }

        const newStatus = action === "approve" ? "approved" : "rejected";
        const updateRes = await db.query(
          `UPDATE app2.kid_requests
              SET status = $1
            WHERE id = $2 AND status = 'pending'
          RETURNING id`,
          [newStatus, requestId],
        );
        if (updateRes.rows.length === 0) {
          return res.status(409).json({ message: "הבקשה כבר טופלה" });
        }

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
              request.child_id,
              request.product_id || null,
            ],
          );

          io.to(String(request.list_id)).emit(
            "receive_item",
            itemResult.rows[0],
          );

          if (request.product_id) {
            db.query(
              `UPDATE app.items SET popularity_points = COALESCE(popularity_points, 0) + 1 WHERE id = $1`,
              [request.product_id],
            ).catch((e) =>
              console.error(
                "Error updating popularity from request:",
                e.message,
              ),
            );
          }
        }

        io.to(`user_${request.child_id}`).emit("request_resolved", {
          requestId: requestId,
          status: newStatus,
        });

        const listAdminsRes = await db.query(
          `SELECT user_id FROM app.list_members
            WHERE list_id = $1 AND status = 'admin'`,
          [request.list_id],
        );
        for (const row of listAdminsRes.rows) {
          io.to(`user_${row.user_id}`).emit("kid_request_resolved", {
            requestId: requestId,
            status: newStatus,
          });
        }

        return res.json({
          success: true,
          message:
            action === "approve" ? "Request approved" : "Request rejected",
        });
      } catch (err) {
        console.error("Error resolving request:", err);
        return res.status(500).json({ message: "Error resolving request" });
      }
    },
  );

  return router;
}
