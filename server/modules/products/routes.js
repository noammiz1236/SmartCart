import { Router } from "express";
import db from "../../shared/db.js";

const router = Router();

// GET /api/search
router.get("/search", async (req, res) => {
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
router.get("/products/:id", async (req, res) => {
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

export default router;
