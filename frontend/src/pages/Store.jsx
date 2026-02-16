import React, {
  useState,
  useRef,
  useContext,
  useEffect,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import api from "../api";

const Store = () => {
  const { user, isLinkedChild } = useContext(AuthContext);
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const searchTimeoutRef = useRef(null);
  const limit = 20;
  const offsetRef = useRef(0);
  const searchRef = useRef("");

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);
  const [addingToList, setAddingToList] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [quantity, setQuantity] = useState(1);

  // Load recent searches on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('smartcart-recent-searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent searches', e);
      }
    }
  }, []);

  // Save search to recent
  const saveRecentSearch = (query) => {
    if (!query.trim()) return;
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('smartcart-recent-searches', JSON.stringify(updated));
  };

  const fetchProducts = async (reset = false) => {
    const q = searchRef.current.trim();
    if (!q) {
      if (reset) setProducts([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    const currentOffset = reset ? 0 : offsetRef.current;
    try {
      const params = new URLSearchParams({ limit, offset: currentOffset, q });
      const response = await api.get(`/api/search?${params.toString()}`);
      const data = response.data;
      const newProducts = Array.isArray(data.rows) ? data.rows : [];
      if (reset) setProducts(newProducts);
      else setProducts((prev) => [...prev, ...newProducts]);
      offsetRef.current = data.nextOffset ?? currentOffset + newProducts.length;
      setHasMore(data.hasMore ?? false);
    } catch (err) {
      console.error("Error fetching products:", err);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    searchRef.current = value;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!value.trim()) {
      setProducts([]);
      setSearched(false);
      setHasMore(false);
      setShowSuggestions(true);
      return;
    }
    setShowSuggestions(false);
    searchTimeoutRef.current = setTimeout(() => {
      offsetRef.current = 0;
      setLoading(true);
      setSearched(true);
      saveRecentSearch(value);
      fetchProducts(true);
    }, 300);
  };

  const selectRecentSearch = (query) => {
    setSearchQuery(query);
    searchRef.current = query;
    setShowSuggestions(false);
    offsetRef.current = 0;
    setLoading(true);
    setSearched(true);
    fetchProducts(true);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('smartcart-recent-searches');
  };

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setLoading(true);
      fetchProducts(false);
    }
  }, [loading, hasMore]);

  // IntersectionObserver for infinite scroll
  const sentinelRef = useRef(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleAddToList = async (product) => {
    if (!user) return;
    setSelectedProduct(product);
    setQuantity(1);
    setSelectedListId(null);
    try {
      const { data } = await api.get("/api/lists");
      setLists(data.lists);
    } catch (err) {
      console.error(err);
    }
  };

  const confirmAddToList = async () => {
    if (!selectedListId || !selectedProduct) return;
    setAddingToList(true);
    try {
      const selectedList = lists.find((l) => l.id === selectedListId);
      if (isLinkedChild) {
        await api.post("/api/kid-requests", {
          listId: selectedListId,
          itemName: selectedProduct.item_name,
          price: selectedProduct.price || null,
          storeName: selectedProduct.chain_name || null,
          quantity,
          productId: selectedProduct.item_id || null,
        });
        setSuccessMsg("הבקשה נשלחה לאישור ההורה!");
      } else {
        await api.post(`/api/lists/${selectedListId}/items`, {
          itemName: selectedProduct.item_name,
          price: selectedProduct.price || null,
          storeName: selectedProduct.chain_name || null,
          quantity,
          productId: selectedProduct.item_id || null,
        });
        setSuccessMsg(
          `"${selectedProduct.item_name}" נוסף לרשימה "${selectedList?.list_name}"!`,
        );
      }
      setSelectedProduct(null);
      setSelectedListId(null);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error(err);
      alert("שגיאה בהוספת המוצר");
    } finally {
      setAddingToList(false);
    }
  };

  return (
    <div className="page-fade-in" dir="rtl">
      <div className="container py-4">
        {/* Header */}
        <div className="text-center mb-4">
          <h2 className="fw-bold mb-2">חיפוש מוצרים</h2>
          <p
            style={{
              color: "var(--sc-text-muted)",
              fontSize: "0.9rem",
              margin: 0,
            }}
          >
            חפש מוצרים והוסף ישירות לרשימת הקניות
          </p>
        </div>

        {/* Search bar */}
        <div className="sc-store-search mb-4" style={{ position: 'relative' }}>
          <i className="bi bi-search search-icon"></i>
          <input
            type="text"
            placeholder="חפש מוצר..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => !searchQuery && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            autoFocus
          />
          {searchQuery && (
            <button
              className="sc-icon-btn clear-btn"
              onClick={() => handleSearchChange("")}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          )}
          {loading && !products.length && (
            <div style={{ position: 'absolute', left: searchQuery ? '50px' : '18px', top: '50%', transform: 'translateY(-50%)' }}>
              <div className="spinner-border spinner-border-sm" style={{ color: 'var(--sc-primary)', width: '18px', height: '18px' }}></div>
            </div>
          )}

          {/* Recent Searches Dropdown */}
          {showSuggestions && !searchQuery && recentSearches.length > 0 && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              background: 'var(--sc-surface)',
              border: '1px solid var(--sc-border)',
              borderRadius: 'var(--sc-radius)',
              boxShadow: 'var(--sc-shadow-lg)',
              padding: '8px 0',
              zIndex: 100,
              maxWidth: '640px',
              margin: '0 auto'
            }}>
              <div style={{
                padding: '8px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--sc-border)'
              }}>
                <small style={{ color: 'var(--sc-text-muted)', fontWeight: 600 }}>חיפושים אחרונים</small>
                <button
                  onClick={clearRecentSearches}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--sc-danger)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    padding: '2px 8px'
                  }}
                >
                  נקה
                </button>
              </div>
              {recentSearches.map((query, idx) => (
                <div
                  key={idx}
                  onClick={() => selectRecentSearch(query)}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sc-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <i className="bi bi-clock-history" style={{ color: 'var(--sc-text-muted)', fontSize: '0.9rem' }}></i>
                  <span style={{ fontSize: '0.9rem' }}>{query}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Success */}
        {successMsg && (
          <div
            style={{
              maxWidth: "640px",
              margin: "0 auto 16px",
              padding: "12px 20px",
              borderRadius: "var(--sc-radius)",
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.2)",
              color: "var(--sc-success)",
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <i className="bi bi-check-circle-fill"></i>
            {successMsg}
          </div>
        )}

        {/* Loading */}
        {loading && products.length === 0 && (
          <div className="text-center py-5">
            <div className="sc-spinner" style={{ margin: "0 auto" }}></div>
          </div>
        )}

        {/* Before search */}
        {!searched && !loading && products.length === 0 && (
          <div className="text-center py-5" style={{ opacity: 0.5 }}>
            <i
              className="bi bi-basket3"
              style={{ fontSize: "3.5rem", color: "var(--sc-primary)" }}
            ></i>
            <p
              className="mt-3 mb-0"
              style={{ color: "var(--sc-text-muted)", fontSize: "1rem" }}
            >
              הקלד שם מוצר כדי לחפש
            </p>
          </div>
        )}

        {/* No results */}
        {searched && !loading && products.length === 0 && (
          <div className="text-center py-5">
            <i
              className="bi bi-emoji-frown"
              style={{
                fontSize: "2.5rem",
                color: "var(--sc-text-muted)",
                opacity: 0.4,
              }}
            ></i>
            <h5 className="mt-3 fw-bold">לא נמצאו תוצאות</h5>
            <p style={{ color: "var(--sc-text-muted)" }}>
              נסה לחפש עם מילים אחרות
            </p>
          </div>
        )}

        {/* Results */}
        {products.length > 0 && (
          <div>
            <div
              className="d-flex align-items-center gap-2 mb-3"
              style={{ color: "var(--sc-text-muted)", fontSize: "0.85rem" }}
            >
              <i className="bi bi-list-ul"></i>
              <span>
                תוצאות עבור "
                <strong style={{ color: "var(--sc-text)" }}>
                  {searchQuery}
                </strong>
                "
              </span>
            </div>

            <div className="d-flex flex-column gap-3">
              {products.map((product, index) => (
                <div
                  key={`${product.item_id}-${product.chain_id}-${index}`}
                  className="sc-product-row"
                >
                  <div
                    className="d-flex align-items-center gap-3 flex-grow-1"
                    style={{ cursor: "pointer", minWidth: 0 }}
                    onClick={() =>
                      navigate(`/product/${product.item_id}`, {
                        state: { product },
                      })
                    }
                  >
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.item_name} className="sc-product-icon" style={{ objectFit: "contain", background: "#fff" }} />
                    ) : (
                      <div className="sc-product-icon">
                        <i className="bi bi-box-seam"></i>
                      </div>
                    )}
                    <div className="sc-product-info">
                      <p className="sc-product-name">
                        {product.item_name}
                        {product.popularity_points > 0 && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                              marginRight: "6px",
                              padding: "2px 7px",
                              borderRadius: "10px",
                              background:
                                "linear-gradient(135deg, rgba(251,146,60,0.12), rgba(251,113,133,0.12))",
                              color: "#f97316",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              verticalAlign: "middle",
                            }}
                          >
                            <i
                              className="bi bi-fire"
                              style={{ fontSize: "0.65rem" }}
                            ></i>
                            {product.popularity_points}
                          </span>
                        )}
                      </p>
                      {product.chain_name && (
                        <div className="sc-product-chain">
                          <i className="bi bi-shop me-1"></i>
                          {product.chain_name}
                        </div>
                      )}
                    </div>
                    <div className="sc-product-price">
                      ₪{product.price}
                    </div>
                  </div>
                  {user && (
                    <button
                      className={`sc-product-add-btn ${isLinkedChild ? "child" : ""}`}
                      onClick={() => handleAddToList(product)}
                    >
                      <i
                        className={`bi ${isLinkedChild ? "bi-send" : "bi-plus-circle"}`}
                      ></i>
                      {isLinkedChild ? "בקש" : "הוסף"}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} style={{ height: "1px" }} />
            {loading && products.length > 0 && (
              <div className="text-center py-3">
                <div
                  className="sc-spinner"
                  style={{ margin: "0 auto", width: "24px", height: "24px" }}
                ></div>
              </div>
            )}

            {!hasMore && products.length > 0 && (
              <p
                className="text-center mt-3 mb-0"
                style={{ color: "var(--sc-text-muted)", fontSize: "0.85rem" }}
              >
                סוף התוצאות
              </p>
            )}
          </div>
        )}
      </div>

      {/* List selection modal */}
      {selectedProduct && (
        <div
          className="sc-modal-overlay"
          onClick={() => setSelectedProduct(null)}
          dir="rtl"
        >
          <div
            className="sc-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "440px" }}
          >
            <div className="sc-modal-header">
              <h5>{isLinkedChild ? "בחר רשימה לבקשה" : "הוסף לרשימה"}</h5>
              <button
                className="sc-icon-btn"
                onClick={() => setSelectedProduct(null)}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--sc-border)",
                background: "rgba(79,70,229,0.03)",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  flexShrink: 0,
                  background:
                    "linear-gradient(135deg, rgba(79,70,229,0.1), rgba(6,182,212,0.08))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {selectedProduct.image_url ? (
                  <img src={selectedProduct.image_url} alt="" style={{ width: "28px", height: "28px", objectFit: "contain" }} />
                ) : (
                  <i className="bi bi-box-seam" style={{ color: "var(--sc-primary)", fontSize: "1.1rem" }}></i>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div className="fw-bold" style={{ fontSize: "0.9rem" }}>
                  {selectedProduct.item_name}
                </div>
                <small style={{ color: "var(--sc-text-muted)" }}>
                  ₪{selectedProduct.price ?? "—"}
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
                  className="sc-icon-btn"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  style={{ width: "26px", height: "26px" }}
                >
                  <i className="bi bi-dash" style={{ fontSize: "0.8rem" }}></i>
                </button>
                <span
                  className="fw-bold"
                  style={{
                    fontSize: "0.9rem",
                    minWidth: "18px",
                    textAlign: "center",
                  }}
                >
                  {quantity}
                </span>
                <button
                  className="sc-icon-btn"
                  onClick={() => setQuantity(quantity + 1)}
                  style={{ width: "26px", height: "26px" }}
                >
                  <i className="bi bi-plus" style={{ fontSize: "0.8rem" }}></i>
                </button>
              </div>
            </div>

            <div
              className="sc-modal-body"
              style={{ maxHeight: "280px", overflowY: "auto" }}
            >
              {lists.length === 0 ? (
                <div
                  className="text-center py-4"
                  style={{ color: "var(--sc-text-muted)" }}
                >
                  <i
                    className="bi bi-list-check"
                    style={{ fontSize: "2rem", opacity: 0.4 }}
                  ></i>
                  <p className="mt-2 mb-0">אין רשימות. צור רשימה חדשה תחילה.</p>
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {lists.map((list) => (
                    <div
                      key={list.id}
                      style={{
                        padding: "12px 16px",
                        borderRadius: "var(--sc-radius)",
                        cursor: "pointer",
                        background:
                          selectedListId === list.id
                            ? "rgba(79,70,229,0.06)"
                            : "var(--sc-bg)",
                        border:
                          selectedListId === list.id
                            ? "2px solid var(--sc-primary)"
                            : "2px solid transparent",
                        transition: "all 0.15s ease",
                      }}
                      onClick={() => setSelectedListId(list.id)}
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <h6
                            className="mb-0 fw-bold"
                            style={{ fontSize: "0.95rem" }}
                          >
                            {list.list_name}
                          </h6>
                          <small style={{ color: "var(--sc-text-muted)" }}>
                            {list.item_count} פריטים · {list.member_count} חברים
                          </small>
                        </div>
                        {selectedListId === list.id && (
                          <i
                            className="bi bi-check-circle-fill"
                            style={{
                              color: "var(--sc-primary)",
                              fontSize: "1.2rem",
                            }}
                          ></i>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="sc-modal-footer">
              <button
                className="sc-btn sc-btn-ghost"
                onClick={() => setSelectedProduct(null)}
              >
                ביטול
              </button>
              <button
                className={`sc-btn ${isLinkedChild ? "sc-btn-ghost" : "sc-btn-primary"}`}
                onClick={confirmAddToList}
                disabled={!selectedListId || addingToList}
                style={{ minWidth: "120px" }}
              >
                {addingToList ? (
                  <span className="spinner-border spinner-border-sm"></span>
                ) : isLinkedChild ? (
                  <>
                    <i className="bi bi-send me-1"></i> שלח בקשה
                  </>
                ) : (
                  <>
                    <i className="bi bi-plus-lg me-1"></i> הוסף
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Store;
