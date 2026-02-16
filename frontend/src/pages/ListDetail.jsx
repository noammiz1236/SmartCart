import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import socket from "../socket";
import ListItemRow from "../components/ListItemRow";
import InviteLinkModal from "../components/InviteLinkModal";
import SaveAsTemplateModal from "../components/SaveAsTemplateModal";
import BarcodeScanner from "../components/BarcodeScanner";

const ListDetail = () => {
  const { listId } = useParams();
  const { user, isLinkedChild } = useContext(AuthContext);
  const navigate = useNavigate();

  const [list, setList] = useState(null);
  const [items, setItems] = useState([]);
  const [members, setMembers] = useState([]);
  const [userRole, setUserRole] = useState("member");
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const searchOffsetRef = useRef(0);
  const searchQueryRef = useRef("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [itemQty, setItemQty] = useState(1);
  const searchTimerRef = useRef(null);
  const searchWrapperRef = useRef(null);
  const searchDropdownRef = useRef(null);
  const searchLimit = 15;

  const [showInvite, setShowInvite] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Comparison modal state
  const [showCompare, setShowCompare] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Child management modal state
  const [showChildrenModal, setShowChildrenModal] = useState(false);
  const [childrenList, setChildrenList] = useState([]);
  const [childrenLoading, setChildrenLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await api.get(`/api/lists/${listId}/items`);
        setList(data.list);
        setItems(data.items);
        setMembers(data.members);
        setUserRole(data.userRole);
      } catch (err) {
        console.error(err);
        if (err.response?.status === 403) navigate("/list");
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    socket.emit("join_list", listId);

    const onReceiveItem = (newItem) => {
      setItems((prev) => [newItem, ...prev]);
    };
    const onItemStatusChanged = ({ itemId, isChecked }) => {
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId ? { ...i, is_checked: isChecked } : i,
        ),
      );
    };
    const onItemDeleted = ({ itemId }) => {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    };
    const onNoteUpdated = ({ itemId, note, note_by, note_by_name }) => {
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId ? { ...i, note, note_by, note_by_name } : i,
        ),
      );
    };
    const onItemPaid = ({ itemId, paid_by, paid_by_name, paid_at }) => {
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId ? { ...i, paid_by, paid_by_name, paid_at } : i,
        ),
      );
    };
    const onItemUnpaid = ({ itemId }) => {
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? { ...i, paid_by: null, paid_by_name: null, paid_at: null }
            : i,
        ),
      );
    };

    socket.on("receive_item", onReceiveItem);
    socket.on("item_status_changed", onItemStatusChanged);
    socket.on("item_deleted", onItemDeleted);
    socket.on("note_updated", onNoteUpdated);
    socket.on("item_paid", onItemPaid);
    socket.on("item_unpaid", onItemUnpaid);

    return () => {
      socket.off("receive_item", onReceiveItem);
      socket.off("item_status_changed", onItemStatusChanged);
      socket.off("item_deleted", onItemDeleted);
      socket.off("note_updated", onNoteUpdated);
      socket.off("item_paid", onItemPaid);
      socket.off("item_unpaid", onItemUnpaid);
    };
  }, [listId, navigate]);

  const [requestMsg, setRequestMsg] = useState("");

  // Fetch search results with pagination
  const fetchSearchResults = async (query, offset, reset) => {
    setSearchLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        limit: searchLimit,
        offset,
      });
      const { data } = await api.get(`/api/search?${params.toString()}`);
      const rows = Array.isArray(data.rows) ? data.rows : [];
      if (reset) setSearchResults(rows);
      else setSearchResults((prev) => [...prev, ...rows]);
      searchOffsetRef.current = data.nextOffset ?? offset + rows.length;
      setSearchHasMore(data.hasMore ?? false);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  // Debounced product search
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    searchQueryRef.current = value;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      setSearchHasMore(false);
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      searchOffsetRef.current = 0;
      fetchSearchResults(value.trim(), 0, true);
    }, 350);
  };

  // Load more search results on scroll
  const loadMoreSearch = useCallback(() => {
    if (!searchLoading && searchHasMore) {
      fetchSearchResults(
        searchQueryRef.current.trim(),
        searchOffsetRef.current,
        false,
      );
    }
  }, [searchLoading, searchHasMore]);

  // Scroll handler for search dropdown infinite scroll
  const handleSearchScroll = useCallback(() => {
    const el = searchDropdownRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 30) {
      loadMoreSearch();
    }
  }, [loadMoreSearch]);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        searchWrapperRef.current &&
        !searchWrapperRef.current.contains(e.target)
      ) {
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setSearchQuery("");
    setSearchResults([]);
  };

  const clearSelectedProduct = () => {
    setSelectedProduct(null);
    setItemQty(1);
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    if (isLinkedChild) {
      try {
        await api.post("/api/family/kid-requests", {
          listId: parseInt(listId),
          itemName: selectedProduct.item_name,
          price: selectedProduct.price || null,
          storeName: selectedProduct.chain_name || null,
          quantity: itemQty,
          productId: selectedProduct.item_id || null,
        });
        setRequestMsg("הבקשה נשלחה לאישור ההורה");
        setTimeout(() => setRequestMsg(""), 3000);
      } catch (err) {
        setRequestMsg("שגיאה בשליחת הבקשה");
        setTimeout(() => setRequestMsg(""), 3000);
      }
    } else {
      socket.emit("send_item", {
        listId: parseInt(listId),
        itemName: selectedProduct.item_name,
        price: selectedProduct.price || null,
        storeName: selectedProduct.chain_name || null,
        quantity: itemQty,
        addby: user.id,
        addat: new Date(),
        updatedat: new Date(),
        productId: selectedProduct.item_id || null,
      });
    }

    setSelectedProduct(null);
    setItemQty(1);
  };

  const handleBarcodeResult = (product) => {
    setSelectedProduct({
      item_name: product.name,
      item_id: product.id || null,
      price: product.prices?.[0]?.price || null,
      chain_name: product.prices?.[0]?.chain_name || null,
    });
    setShowScanner(false);
  };

  const handleCompare = async () => {
    setShowCompare(true);
    setCompareLoading(true);
    try {
      const { data } = await api.get(`/api/lists/${listId}/compare`);
      setCompareData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setCompareLoading(false);
    }
  };

  const handleOpenChildren = async () => {
    setShowChildrenModal(true);
    setChildrenLoading(true);
    try {
      const { data } = await api.get(`/api/family/lists/${listId}/children`);
      setChildrenList(data.children);
    } catch (err) {
      console.error(err);
    } finally {
      setChildrenLoading(false);
    }
  };

  const handleToggleChild = async (childId, currentlyMember) => {
    try {
      if (currentlyMember) {
        await api.delete(`/api/family/lists/${listId}/children/${childId}`);
      } else {
        await api.post(`/api/family/lists/${listId}/children/${childId}`);
      }
      setChildrenList((prev) =>
        prev.map((c) =>
          c.id === childId ? { ...c, is_member: !currentlyMember } : c,
        ),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteList = async () => {
    if (
      !confirm(
        `האם למחוק את הרשימה "${list?.list_name}"? פעולה זו תמחק את כל הפריטים והחברים.`,
      )
    ) {
      return;
    }

    try {
      await api.delete(`/api/lists/${listId}`);
      navigate("/list");
    } catch (err) {
      console.error("Error deleting list:", err);
      alert(err.response?.data?.message || "שגיאה במחיקת הרשימה");
    }
  };

  const handleLeaveList = async () => {
    if (!confirm(`האם לעזוב את הרשימה "${list?.list_name}"?`)) {
      return;
    }

    try {
      await api.post(`/api/lists/${listId}/leave`);
      navigate("/list");
    } catch (err) {
      console.error("Error leaving list:", err);
      alert(err.response?.data?.message || "שגיאה ביציאה מהרשימה");
    }
  };

  if (loading) {
    return (
      <div className="sc-loading-page">
        <div className="sc-spinner"></div>
      </div>
    );
  }

  const checkedCount = items.filter((i) => i.is_checked || i.paid_by).length;
  const basketTotal = items.reduce((sum, item) => {
    return (
      sum + (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 1)
    );
  }, 0);

  return (
    <div className="page-fade-in" dir="rtl">
      <div className="container py-4" style={{ maxWidth: "720px" }}>
        {/* Header */}
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <button
              className="sc-btn sc-btn-ghost mb-2"
              onClick={() => navigate("/list")}
              style={{ fontSize: "0.8rem", padding: "4px 12px" }}
            >
              <i className="bi bi-arrow-right me-1"></i> חזרה
            </button>
            <h3 className="fw-bold mb-1">{list?.list_name}</h3>
            <div
              className="d-flex align-items-center gap-3"
              style={{ color: "var(--sc-text-muted)", fontSize: "0.85rem" }}
            >
              <span>
                <i className="bi bi-people me-1"></i>
                {members.map((m) => m.first_name).join(", ")}
              </span>
            </div>
          </div>
          {!isLinkedChild && (
            <div className="d-flex gap-2">
              {userRole === "admin" && (
                <>
                  <button
                    className="sc-btn sc-btn-ghost"
                    onClick={() => setShowInvite(true)}
                    style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                  >
                    <i className="bi bi-person-plus me-1"></i> הזמן
                  </button>
                  <button
                    className="sc-btn sc-btn-ghost"
                    onClick={handleOpenChildren}
                    style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                  >
                    <i className="bi bi-people me-1"></i> ילדים
                  </button>
                  <button
                    className="sc-btn sc-btn-ghost"
                    onClick={handleDeleteList}
                    style={{
                      fontSize: "0.8rem",
                      padding: "6px 12px",
                      color: "var(--sc-danger)",
                    }}
                  >
                    <i className="bi bi-trash me-1"></i> מחק
                  </button>
                </>
              )}
              {userRole === "member" && (
                <button
                  className="sc-btn sc-btn-ghost"
                  onClick={handleLeaveList}
                  style={{
                    fontSize: "0.8rem",
                    padding: "6px 12px",
                    color: "var(--sc-danger)",
                  }}
                >
                  <i className="bi bi-box-arrow-left me-1"></i> עזוב
                </button>
              )}
              <button
                className="sc-btn sc-btn-ghost"
                onClick={() => setShowSaveTemplate(true)}
                style={{ fontSize: "0.8rem", padding: "6px 12px" }}
              >
                <i className="bi bi-bookmark me-1"></i> תבנית
              </button>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {items.length > 0 && (
          <div className="mb-3">
            <div
              className="d-flex justify-content-between mb-1"
              style={{ fontSize: "0.8rem", color: "var(--sc-text-muted)" }}
            >
              <span>
                {checkedCount} מתוך {items.length} הושלמו
              </span>
              <span>{Math.round((checkedCount / items.length) * 100)}%</span>
            </div>
            <div
              style={{
                height: "6px",
                background: "var(--sc-border)",
                borderRadius: "3px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(checkedCount / items.length) * 100}%`,
                  background: "var(--sc-gradient-warm)",
                  borderRadius: "3px",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* Basket Total + Compare */}
        {items.length > 0 && (
          <div className="sc-card p-3 mb-3 d-flex justify-content-between align-items-center">
            <div>
              <span
                style={{ fontSize: "0.85rem", color: "var(--sc-text-muted)" }}
              >
                סה"כ סל:{" "}
              </span>
              <span
                className="fw-bold"
                style={{ fontSize: "1.1rem", color: "var(--sc-primary)" }}
              >
                ₪{basketTotal.toFixed(2)}
              </span>
            </div>
            <button
              className="sc-btn sc-btn-ghost"
              onClick={handleCompare}
              style={{ fontSize: "0.8rem", padding: "6px 14px" }}
            >
              <i className="bi bi-bar-chart me-1"></i> השוואת מחירים
            </button>
          </div>
        )}

        {/* Add Item */}
        <div className="sc-card p-3 mb-3">
          {selectedProduct ? (
            /* Selected product - show details + add button */
            <form onSubmit={handleAddItem}>
              <div className="d-flex align-items-center gap-3">
                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "10px",
                    flexShrink: 0,
                    background:
                      "linear-gradient(135deg, rgba(79,70,229,0.1), rgba(6,182,212,0.08))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <i
                    className="bi bi-box-seam"
                    style={{ color: "var(--sc-primary)", fontSize: "0.9rem" }}
                  ></i>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fw-bold" style={{ fontSize: "0.9rem" }}>
                    {selectedProduct.item_name}
                  </div>
                  <small style={{ color: "var(--sc-text-muted)" }}>
                    {selectedProduct.price ? `₪${selectedProduct.price}` : ""}
                    {selectedProduct.chain_name
                      ? ` · ${selectedProduct.chain_name}`
                      : ""}
                  </small>
                </div>
                <div
                  className="d-flex align-items-center gap-2"
                  style={{
                    background: "var(--sc-bg)",
                    borderRadius: "10px",
                    padding: "4px 8px",
                  }}
                >
                  <button
                    type="button"
                    className="sc-icon-btn"
                    onClick={() => setItemQty(Math.max(1, itemQty - 1))}
                    style={{ width: "26px", height: "26px" }}
                  >
                    <i
                      className="bi bi-dash"
                      style={{ fontSize: "0.8rem" }}
                    ></i>
                  </button>
                  <span
                    className="fw-bold"
                    style={{
                      fontSize: "0.9rem",
                      minWidth: "18px",
                      textAlign: "center",
                    }}
                  >
                    {itemQty}
                  </span>
                  <button
                    type="button"
                    className="sc-icon-btn"
                    onClick={() => setItemQty(itemQty + 1)}
                    style={{ width: "26px", height: "26px" }}
                  >
                    <i
                      className="bi bi-plus"
                      style={{ fontSize: "0.8rem" }}
                    ></i>
                  </button>
                </div>
                <button
                  type="submit"
                  className={`sc-btn ${isLinkedChild ? "sc-btn-ghost" : "sc-btn-primary"}`}
                  style={{ padding: "8px 16px", whiteSpace: "nowrap" }}
                >
                  {isLinkedChild ? (
                    <>
                      <i className="bi bi-send me-1"></i> בקש
                    </>
                  ) : (
                    <i className="bi bi-plus-lg"></i>
                  )}
                </button>
                <button
                  type="button"
                  className="sc-icon-btn"
                  onClick={clearSelectedProduct}
                  title="בטל"
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            </form>
          ) : (
            /* Search input */
            <div ref={searchWrapperRef} style={{ position: "relative" }}>
              <div className="d-flex gap-2 align-items-center">
                <div className="position-relative flex-grow-1">
                  <i
                    className="bi bi-search"
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--sc-text-muted)",
                      fontSize: "0.85rem",
                      pointerEvents: "none",
                    }}
                  ></i>
                  <input
                    type="text"
                    className="form-control sc-input"
                    placeholder="חפש מוצר להוספה..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    style={{ fontSize: "0.9rem", paddingRight: "36px" }}
                  />
                </div>
                <button
                  type="button"
                  className="sc-icon-btn"
                  onClick={() => setShowScanner(true)}
                  title="סרוק ברקוד"
                >
                  <i className="bi bi-upc-scan"></i>
                </button>
              </div>

              {/* Search loading */}
              {searchLoading && (
                <div className="text-center py-2">
                  <small style={{ color: "var(--sc-text-muted)" }}>
                    מחפש...
                  </small>
                </div>
              )}

              {/* Search results dropdown */}
              {searchResults.length > 0 && (
                <div
                  ref={searchDropdownRef}
                  onScroll={handleSearchScroll}
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    zIndex: 1050,
                    marginTop: "6px",
                    border: "1px solid var(--sc-border)",
                    borderRadius: "var(--sc-radius)",
                    background: "var(--sc-surface)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                    maxHeight: "260px",
                    overflowY: "auto",
                  }}
                >
                  {searchResults.map((item, i) => (
                    <div
                      key={`${item.item_id}-${item.chain_id}-${i}`}
                      onClick={() => handleSelectProduct(item)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 14px",
                        cursor: "pointer",
                        borderBottom:
                          i < searchResults.length - 1
                            ? "1px solid var(--sc-border)"
                            : "none",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(79,70,229,0.04)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <div
                        style={{
                          width: "34px",
                          height: "34px",
                          borderRadius: "8px",
                          flexShrink: 0,
                          background:
                            "linear-gradient(135deg, rgba(79,70,229,0.08), rgba(6,182,212,0.06))",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <i
                          className="bi bi-box-seam"
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--sc-primary)",
                          }}
                        ></i>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          className="fw-bold"
                          style={{ fontSize: "0.85rem", lineHeight: 1.3 }}
                        >
                          {item.item_name}
                          {item.popularity_points > 0 && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                                marginRight: "6px",
                                padding: "2px 6px",
                                borderRadius: "10px",
                                background:
                                  "linear-gradient(135deg, rgba(251,146,60,0.12), rgba(251,113,133,0.12))",
                                color: "#f97316",
                                fontSize: "0.65rem",
                                fontWeight: 600,
                                verticalAlign: "middle",
                              }}
                            >
                              <i
                                className="bi bi-fire"
                                style={{ fontSize: "0.6rem" }}
                              ></i>
                              {item.popularity_points}
                            </span>
                          )}
                        </div>
                        {item.chain_name && (
                          <small
                            style={{
                              color: "var(--sc-text-muted)",
                              fontSize: "0.75rem",
                            }}
                          >
                            <i className="bi bi-shop me-1"></i>
                            {item.chain_name}
                          </small>
                        )}
                      </div>
                      {item.price && (
                        <span
                          style={{
                            fontWeight: 700,
                            color: "var(--sc-primary)",
                            fontSize: "0.9rem",
                            flexShrink: 0,
                          }}
                        >
                          ₪{item.price}
                        </span>
                      )}
                    </div>
                  ))}
                  {searchLoading && searchResults.length > 0 && (
                    <div className="text-center py-2">
                      <small style={{ color: "var(--sc-text-muted)" }}>
                        טוען עוד...
                      </small>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {requestMsg && (
            <div
              className="mt-2"
              style={{
                fontSize: "0.85rem",
                color: "var(--sc-primary)",
                fontWeight: 500,
              }}
            >
              <i className="bi bi-info-circle me-1"></i>
              {requestMsg}
            </div>
          )}
        </div>

        {/* Items List */}
        {items.length === 0 ? (
          <div className="sc-card">
            <div className="sc-empty" style={{ padding: "2rem" }}>
              <div className="sc-empty-icon">
                <i className="bi bi-basket"></i>
              </div>
              <h4>הרשימה ריקה</h4>
              <p>הוסף פריטים למעלה כדי להתחיל</p>
            </div>
          </div>
        ) : (
          <div>
            {items.map((item) => (
              <ListItemRow key={item.id} item={item} listId={listId} />
            ))}
          </div>
        )}

        {/* Modals */}
        <InviteLinkModal
          show={showInvite}
          onClose={() => setShowInvite(false)}
          listId={listId}
        />
        <SaveAsTemplateModal
          show={showSaveTemplate}
          onClose={() => setShowSaveTemplate(false)}
          listId={listId}
        />
        {showScanner && (
          <BarcodeScanner
            onResult={handleBarcodeResult}
            onClose={() => setShowScanner(false)}
          />
        )}

        {/* Price Comparison Modal */}
        {showCompare && (
          <div
            className="sc-modal-overlay"
            onClick={() => setShowCompare(false)}
            dir="rtl"
          >
            <div
              className="sc-modal"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "560px" }}
            >
              <div className="sc-modal-header">
                <h5>
                  <i className="bi bi-bar-chart me-2"></i>השוואת מחירים
                </h5>
                <button
                  className="sc-icon-btn"
                  onClick={() => setShowCompare(false)}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              <div
                className="sc-modal-body"
                style={{ maxHeight: "70vh", overflowY: "auto" }}
              >
                {compareLoading ? (
                  <div className="text-center py-5">
                    <div
                      className="sc-spinner"
                      style={{ margin: "0 auto" }}
                    ></div>
                    <p
                      className="mt-3"
                      style={{ color: "var(--sc-text-muted)" }}
                    >
                      מחשב מחירים...
                    </p>
                  </div>
                ) : !compareData ? (
                  <div
                    className="text-center py-4"
                    style={{ color: "var(--sc-text-muted)" }}
                  >
                    שגיאה בטעינת ההשוואה
                  </div>
                ) : (
                  <>
                    {/* Unlinked items warning */}
                    {compareData.unlinkedCount > 0 && (
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: "var(--sc-radius)",
                          marginBottom: "12px",
                          background: "rgba(245, 158, 11, 0.08)",
                          border: "1px solid rgba(245, 158, 11, 0.2)",
                          fontSize: "0.82rem",
                          color: "#b45309",
                        }}
                      >
                        <i className="bi bi-info-circle me-1"></i>
                        {compareData.unlinkedCount} פריטים הוזנו ידנית ולא
                        נכללים בהשוואה
                      </div>
                    )}

                    {compareData.linkedCount === 0 ? (
                      <div
                        className="text-center py-4"
                        style={{ color: "var(--sc-text-muted)" }}
                      >
                        <i
                          className="bi bi-link-45deg"
                          style={{ fontSize: "2rem", opacity: 0.4 }}
                        ></i>
                        <p className="mt-2 mb-0">
                          אין פריטים מקושרים למוצרים בחנות. הוסף פריטים מדף
                          החנות כדי להשוות מחירים.
                        </p>
                      </div>
                    ) : compareData.chains.length === 0 ? (
                      <div
                        className="text-center py-4"
                        style={{ color: "var(--sc-text-muted)" }}
                      >
                        <p className="mb-0">
                          לא נמצאו מחירים עבור הפריטים ברשימה
                        </p>
                      </div>
                    ) : (
                      <div className="d-flex flex-column gap-3">
                        {compareData.chains.map((chain, idx) => (
                          <div
                            key={chain.chainId}
                            style={{
                              border:
                                idx === 0
                                  ? "2px solid var(--sc-success)"
                                  : "1px solid var(--sc-border)",
                              borderRadius: "var(--sc-radius)",
                              overflow: "hidden",
                            }}
                          >
                            {/* Chain header */}
                            <div
                              style={{
                                padding: "12px 16px",
                                background:
                                  idx === 0
                                    ? "rgba(16, 185, 129, 0.06)"
                                    : "var(--sc-bg)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <div className="d-flex align-items-center gap-2">
                                <i
                                  className="bi bi-shop"
                                  style={{
                                    color:
                                      idx === 0
                                        ? "var(--sc-success)"
                                        : "var(--sc-text-muted)",
                                  }}
                                ></i>
                                <span
                                  className="fw-bold"
                                  style={{ fontSize: "0.95rem" }}
                                >
                                  {chain.chainName}
                                </span>
                                {idx === 0 && (
                                  <span
                                    className="sc-badge"
                                    style={{
                                      background: "var(--sc-success)",
                                      color: "#fff",
                                      fontSize: "0.7rem",
                                      padding: "2px 8px",
                                    }}
                                  >
                                    הכי זול
                                  </span>
                                )}
                              </div>
                              <div className="d-flex align-items-center gap-2">
                                {!chain.complete && (
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "#b45309",
                                    }}
                                  >
                                    <i className="bi bi-exclamation-triangle me-1"></i>
                                    חסרים {chain.missingCount}
                                  </span>
                                )}
                                <span
                                  className="fw-bold"
                                  style={{
                                    fontSize: "1.1rem",
                                    color:
                                      idx === 0
                                        ? "var(--sc-success)"
                                        : "var(--sc-text)",
                                  }}
                                >
                                  ₪{chain.total.toFixed(2)}
                                </span>
                              </div>
                            </div>

                            {/* Expandable item breakdown */}
                            <details
                              style={{
                                borderTop: "1px solid var(--sc-border)",
                              }}
                            >
                              <summary
                                style={{
                                  padding: "8px 16px",
                                  cursor: "pointer",
                                  fontSize: "0.8rem",
                                  color: "var(--sc-text-muted)",
                                  userSelect: "none",
                                }}
                              >
                                פירוט פריטים ({chain.items.length})
                              </summary>
                              <div style={{ padding: "0 16px 12px" }}>
                                {chain.items.map((ci, i) => (
                                  <div
                                    key={i}
                                    className="d-flex justify-content-between align-items-center"
                                    style={{
                                      padding: "6px 0",
                                      borderBottom:
                                        i < chain.items.length - 1
                                          ? "1px solid var(--sc-border)"
                                          : "none",
                                      fontSize: "0.82rem",
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: ci.available
                                          ? "var(--sc-text)"
                                          : "#dc2626",
                                      }}
                                    >
                                      {ci.itemName}
                                      {ci.quantity > 1 && (
                                        <span
                                          style={{
                                            color: "var(--sc-text-muted)",
                                          }}
                                        >
                                          {" "}
                                          x{ci.quantity}
                                        </span>
                                      )}
                                    </span>
                                    {ci.available ? (
                                      <span
                                        style={{
                                          color: "var(--sc-text-muted)",
                                        }}
                                      >
                                        ₪{ci.price.toFixed(2)}
                                        {ci.quantity > 1 &&
                                          ` = ₪${ci.subtotal.toFixed(2)}`}
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          color: "#dc2626",
                                          fontWeight: 600,
                                        }}
                                      >
                                        לא זמין
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="sc-modal-footer">
                <button
                  className="sc-btn sc-btn-ghost"
                  onClick={() => setShowCompare(false)}
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Children Management Modal */}
        {showChildrenModal && (
          <div
            className="sc-modal-overlay"
            onClick={() => setShowChildrenModal(false)}
            dir="rtl"
          >
            <div
              className="sc-modal"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "440px" }}
            >
              <div className="sc-modal-header">
                <h5>
                  <i className="bi bi-people me-2"></i>ניהול גישת ילדים
                </h5>
                <button
                  className="sc-icon-btn"
                  onClick={() => setShowChildrenModal(false)}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              <div className="sc-modal-body">
                {childrenLoading ? (
                  <div className="text-center py-4">
                    <div
                      className="sc-spinner"
                      style={{ margin: "0 auto" }}
                    ></div>
                  </div>
                ) : childrenList.length === 0 ? (
                  <div
                    className="text-center py-4"
                    style={{ color: "var(--sc-text-muted)" }}
                  >
                    <i
                      className="bi bi-person-x"
                      style={{ fontSize: "2rem", opacity: 0.4 }}
                    ></i>
                    <p className="mt-2 mb-0">אין חשבונות ילדים מקושרים</p>
                    <small>צור חשבון ילד בהגדרות הפרופיל</small>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {childrenList.map((child) => (
                      <div
                        key={child.id}
                        className="d-flex justify-content-between align-items-center"
                        style={{
                          padding: "12px 16px",
                          borderRadius: "var(--sc-radius)",
                          background: child.is_member
                            ? "rgba(16, 185, 129, 0.06)"
                            : "var(--sc-bg)",
                          border: child.is_member
                            ? "1px solid rgba(16, 185, 129, 0.2)"
                            : "1px solid var(--sc-border)",
                        }}
                      >
                        <div className="d-flex align-items-center gap-2">
                          <div
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "50%",
                              background:
                                "linear-gradient(135deg, rgba(79,70,229,0.1), rgba(6,182,212,0.08))",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <i
                              className="bi bi-person"
                              style={{
                                color: "var(--sc-primary)",
                                fontSize: "0.9rem",
                              }}
                            ></i>
                          </div>
                          <div>
                            <div
                              className="fw-bold"
                              style={{ fontSize: "0.9rem" }}
                            >
                              {child.first_name}
                            </div>
                            {child.username && (
                              <small style={{ color: "var(--sc-text-muted)" }}>
                                @{child.username}
                              </small>
                            )}
                          </div>
                        </div>
                        <div
                          onClick={() =>
                            handleToggleChild(child.id, child.is_member)
                          }
                          style={{
                            width: "44px",
                            height: "24px",
                            borderRadius: "12px",
                            cursor: "pointer",
                            background: child.is_member
                              ? "var(--sc-success)"
                              : "var(--sc-border)",
                            position: "relative",
                            transition: "background 0.2s ease",
                          }}
                        >
                          <div
                            style={{
                              width: "20px",
                              height: "20px",
                              borderRadius: "50%",
                              background: "#fff",
                              position: "absolute",
                              top: "2px",
                              right: child.is_member ? "2px" : "22px",
                              transition: "right 0.2s ease",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="sc-modal-footer">
                <button
                  className="sc-btn sc-btn-ghost"
                  onClick={() => setShowChildrenModal(false)}
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ListDetail;
