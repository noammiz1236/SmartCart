import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import PrivateRoute from "./components/PrivateRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Store from "./pages/Store";
import ProductPage from "./pages/ProductPage";
import Profile from "./pages/Profile";
import { AuthProvider } from "./context/AuthContext";
import VerificationConfirmed from "./pages/VerificationConfirmed";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import MyLists from "./pages/MyLists";
import ListDetail from "./pages/ListDetail";
import JoinList from "./pages/JoinList";
import Templates from "./pages/Templates";
import FamilySettings from "./pages/FamilySettings";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NavBar />

        <main className="sc-main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/register" element={<Register />} />
          <Route path="/store" element={<Store />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            }
          />
          <Route path="/verification-confirmed"
            element={
              <PrivateRoute >
                <VerificationConfirmed />
              </PrivateRoute>}
          />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/list" element={<PrivateRoute><MyLists /></PrivateRoute>} />
          <Route path="/list/:listId" element={<PrivateRoute><ListDetail /></PrivateRoute>} />
          <Route path="/join/:inviteCode" element={<PrivateRoute><JoinList /></PrivateRoute>} />
          <Route path="/templates" element={<PrivateRoute parentOnly><Templates /></PrivateRoute>} />
          <Route path="/family" element={<PrivateRoute parentOnly><FamilySettings /></PrivateRoute>} />
        </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
