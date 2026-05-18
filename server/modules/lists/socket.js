import db from "../../shared/db.js";

export default function registerListSocketHandlers(io) {
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
      const { itemId, listId, userId } = data;
      try {
        if (userId) {
          const userCheck = await db.query(
            "SELECT parent_id FROM app2.users WHERE id = $1",
            [userId],
          );
          if (
            userCheck.rows.length === 0 ||
            userCheck.rows[0].parent_id !== null
          ) {
            return;
          }
        }

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
        const userCheck = await db.query(
          "SELECT parent_id FROM app2.users WHERE id = $1",
          [userId],
        );
        if (
          userCheck.rows.length === 0 ||
          userCheck.rows[0].parent_id !== null
        ) {
          return;
        }

        await db.query(
          "UPDATE app.list_items SET note = $1, note_by = $2 WHERE id = $3",
          [note || null, userId, itemId],
        );

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

    socket.on("add_comment", async (data) => {
      const { itemId, listId, userId, comment } = data;
      try {
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

    socket.on("update_comment", async (data) => {
      const { commentId, itemId, listId, userId, comment } = data;
      try {
        const existing = await db.query(
          `SELECT user_id FROM app.list_item_comments WHERE id = $1`,
          [commentId],
        );
        if (existing.rows.length === 0 || existing.rows[0].user_id !== userId) {
          return;
        }

        await db.query(
          `UPDATE app.list_item_comments SET comment = $1 WHERE id = $2`,
          [comment, commentId],
        );

        io.to(String(listId)).emit("comment_updated", {
          itemId,
          commentId,
          comment,
        });
      } catch (err) {
        console.error("Error updating comment:", err);
      }
    });

    socket.on("delete_comment", async (data) => {
      const { commentId, itemId, listId, userId } = data;
      try {
        const existing = await db.query(
          `SELECT user_id FROM app.list_item_comments WHERE id = $1`,
          [commentId],
        );
        if (existing.rows.length === 0 || existing.rows[0].user_id !== userId) {
          return;
        }

        await db.query(`DELETE FROM app.list_item_comments WHERE id = $1`, [
          commentId,
        ]);

        io.to(String(listId)).emit("comment_deleted", {
          itemId,
          commentId,
        });
      } catch (err) {
        console.error("Error deleting comment:", err);
      }
    });
  });
}
