import XmlStream from "xml-stream-saxjs";
import fs from "fs";
import { config } from "dotenv";
import pg from "pg";
import iconv from "iconv-lite";
import { movetoprocess } from "./organizefiles.js";
config();

const { Pool } = pg;
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const getText = (node) =>
  (typeof node === "string" ? node : node?.$text || "").trim();

// Helper: get a field from an object trying multiple casings
const getField = (obj, ...keys) => {
  for (const key of keys) {
    if (obj[key] !== undefined) return getText(obj[key]);
  }
  return "";
};

function detectEncoding(filePath) {
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(2);
  fs.readSync(fd, buf, 0, 2, 0);
  fs.closeSync(fd);
  return buf[0] === 0xff && buf[1] === 0xfe ? "utf16le" : "utf8";
}

function createDecodedStream(filePath) {
  const encoding = detectEncoding(filePath);
  const fileStream = fs.createReadStream(filePath);
  if (encoding === "utf16le") {
    return fileStream.pipe(iconv.decodeStream("utf16le"));
  }
  return fileStream;
}

export async function ParceStoreFile(xmlpath) {
  return new Promise((resolve, reject) => {
    const rawStream = createDecodedStream(xmlpath);
    const xmlStream = new XmlStream(rawStream);

    let currentChainId = null;
    let currentChainName = null;
    let currentSubChainId = null;
    let chainInserted = false;

    console.log(` Starting store file parsing: ${xmlpath}`);

    // Helper to insert chain once we have both id and name
    const tryInsertChain = async () => {
      if (currentChainId && currentChainName && !chainInserted) {
        chainInserted = true;
        try {
          await db.query(
            "INSERT INTO app.chains (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name",
            [currentChainId, currentChainName],
          );
          console.log(` Inserted chain: ${currentChainId} - ${currentChainName}`);
        } catch (e) {
          console.error("Error updating chain:", e.message);
        }
      }
    };

    // Listen for ChainID in all casings: ChainID, ChainId, CHAINID
    for (const tag of ["ChainID", "ChainId", "CHAINID"]) {
      xmlStream.on(`endElement: ${tag}`, async (node) => {
        const val = getText(node);
        if (val && !currentChainId) {
          currentChainId = val;
          console.log(` Captured ChainID: ${currentChainId}`);
          rawStream.pause();
          await tryInsertChain();
          rawStream.resume();
        }
      });
    }

    // Listen for ChainName in all casings
    for (const tag of ["ChainName", "CHAINNAME"]) {
      xmlStream.on(`endElement: ${tag}`, async (node) => {
        const val = getText(node);
        if (val && !currentChainName) {
          currentChainName = val;
          console.log(` Captured ChainName: ${currentChainName}`);
          rawStream.pause();
          await tryInsertChain();
          rawStream.resume();
        }
      });
    }

    // Listen for SubChainID/SubChainId/SUBCHAINID
    for (const tag of ["SubChainID", "SubChainId", "SUBCHAINID"]) {
      xmlStream.on(`endElement: ${tag}`, (node) => {
        const val = getText(node);
        if (val) currentSubChainId = val;
      });
    }

    // Listen for SubChainName/SUBCHAINNAME
    for (const tag of ["SubChainName", "SUBCHAINNAME"]) {
      xmlStream.on(`endElement: ${tag}`, async (node) => {
        rawStream.pause();
        const subChainName = getText(node);
        if (currentSubChainId && currentChainId) {
          try {
            await db.query(
              "INSERT INTO app.sub_chains (id, chain_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name",
              [currentSubChainId, currentChainId, subChainName],
            );
          } catch (e) {
            console.error("Error inserting sub-chain:", e.message);
          }
        }
        rawStream.resume();
      });
    }

    // Listen for Store/STORE elements
    for (const tag of ["Store", "STORE"]) {
      xmlStream.on(`endElement: ${tag}`, async (store) => {
        rawStream.pause();
        try {
          const storeId = getField(store, "StoreID", "StoreId", "STOREID");
          const storeName = getField(store, "StoreName", "STORENAME");
          const address = getField(store, "Address", "ADDRESS");
          const city = getField(store, "City", "CITY");
          const subChainId = getField(store, "SubChainID", "SubChainId", "SUBCHAINID") || currentSubChainId;

          // Some formats put ChainName inside Store (Shufersal)
          const storeChainName = getField(store, "ChainName", "CHAINNAME");
          if (storeChainName && !currentChainName) {
            currentChainName = storeChainName;
            await tryInsertChain();
          }

          if (storeId && currentChainId) {
            await db.query(
              "INSERT INTO app.branches (id, chain_id, sub_chain_id, branch_name, address, city) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING",
              [storeId, currentChainId, subChainId || null, storeName, address, city],
            );
          }
        } catch (e) {
          console.error(`Error inserting branch:`, e.message);
        } finally {
          rawStream.resume();
        }
      });
    }

    xmlStream.on("end", async () => {
      console.log(" Finished processing branches file.");
      await movetoprocess(xmlpath);
      resolve();
    });

    xmlStream.on("error", (err) => reject(err));
  });
}

export async function parsePriceFile(xmlPath, branchId) {
  // Check if branch exists in the database to prevent foreign key errors
  try {
    const branchCheck = await db.query(
      "SELECT 1 FROM app.branches WHERE id = $1",
      [branchId],
    );
    if (branchCheck.rowCount === 0) {
      console.warn(
        `Branch ${branchId} does not exist in database. Skipping price file ${xmlPath}`,
      );
      await movetoprocess(xmlPath);
      return;
    }
  } catch (e) {
    console.error(
      `Error checking branch existence for ${branchId}:`,
      e.message,
    );
    return;
  }

  return new Promise((resolve, reject) => {
    const rawStream = createDecodedStream(xmlPath);
    const xmlStream = new XmlStream(rawStream);
    console.log(` Starting price extraction for branch ${branchId}`);

    // Listen for Item/ITEM elements
    for (const tag of ["Item", "ITEM"]) {
      xmlStream.on(`endElement: ${tag}`, async (item) => {
        rawStream.pause();
        try {
          const itemCode = getField(item, "ItemCode", "ITEMCODE");
          const itemName = getField(item, "ItemName", "ITEMNAME", "ItemNm", "ITEMNM");
          const priceVal = item.ItemPrice || item.ITEMPRICE || item.itemPrice;
          const price = parseFloat(typeof priceVal === "string" ? priceVal : getText(priceVal));
          const manufacturer = getField(item, "ManufacturerName", "MANUFACTURERNAME") || "לא ידוע";
          const unitQty = getField(item, "UnitQty", "UNITQTY") || "1";

          if (!itemCode || !itemName || isNaN(price)) {
            rawStream.resume();
            return;
          }

          const sqlQuery = `
            WITH ins_item AS (
              INSERT INTO app.items (barcode, item_code, name, manufacturer, unit_qty)
              VALUES ($1, $1, $2, $3, $4)
              ON CONFLICT (item_code, manufacturer, is_weighted) DO UPDATE SET
                name = EXCLUDED.name,
                unit_qty = EXCLUDED.unit_qty
              RETURNING id
            )
            INSERT INTO app.prices (item_id, branch_id, price, price_update_time)
            SELECT id, $5, $6, NOW() FROM ins_item
            ON CONFLICT (item_id, branch_id) DO UPDATE SET
              price = EXCLUDED.price,
              price_update_time = NOW();
          `;
          await db.query(sqlQuery, [
            itemCode,
            itemName,
            manufacturer,
            unitQty,
            branchId,
            price,
          ]);
        } catch (err) {
          // Only log first few errors to avoid flooding
          console.error(` Error in item:`, err.message);
        } finally {
          rawStream.resume();
        }
      });
    }

    xmlStream.on("end", async () => {
      console.log(
        ` Price update for branch ${branchId} completed successfully!`,
      );
      await movetoprocess(xmlPath);
      resolve();
    });

    xmlStream.on("error", (err) => {
      console.error("Critical error in Parser:", err);
      reject(err);
    });
  });
}
