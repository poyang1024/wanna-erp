import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { SpeedInsights } from "@vercel/speed-insights/react";

import useAuth from './hooks/useAuth';
import { isRestrictedUser, isAllowedPath } from './config/userRoles';
import Header from "./Header";
import Footer from "./components/Footer";
import Signin from "./pages/Signin";
import BomTables from "./pages/BomTable";
import NewBomTables from "./pages/NewBomTable";
import NewSharedMaterial from './pages/NewSharedMaterial';
import HomePage from "./pages/HomePage";
import SharedMaterial from "./pages/SharedMaterials";
import EditBomTable from "./pages/EditBomTable"
import EditSharedMaterial from "./pages/EditSharedMaterials"
import SharedMaterialHistory from "./pages/SharedMaterialHistory"
import ExcelAnalysisPage from './pages/ExcelAnalysisPage';
import SavedAnalysisPage from './components/SavedAnalysisPage';
import ProfilePage from './pages/ProfilePage'
import PricingAnalysisPage from './pages/PricingAnalysis'
import SavedPricingPage from './components/SaviedPrcingPage'
import OrderCostRatePage from './components/OrderCostRatePage';
import ShippingPage from './pages/ShippingPage';

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>載入中...</div>;
  }

  if (!user) {
    return <Navigate to="/signin" />;
  }

  if (isRestrictedUser(user.email) && !isAllowedPath(window.location.pathname)) {
    toast.error('您沒有此頁面的權限', {
      position: "top-center",
      autoClose: 3000
    });
    return <Navigate to="/" />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <SpeedInsights />
        <ToastContainer />
        <Header />
        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/signin" element={<Signin />} />
            <Route path="/" element={<HomePage />} />
            <Route path="/bom-table" element={<ProtectedRoute><BomTables /></ProtectedRoute>} />
            <Route path="/shared-material" element={<ProtectedRoute><SharedMaterial /></ProtectedRoute>} />
            <Route path="/new-bomtable" element={<ProtectedRoute><NewBomTables /></ProtectedRoute>} />
            <Route path="/new-shared-material" element={<ProtectedRoute><NewSharedMaterial /></ProtectedRoute>} />
            <Route path="/edit-bom-table/:id" element={<ProtectedRoute><EditBomTable /></ProtectedRoute>} />
            <Route path="/edit-shared-material/:id" element={<ProtectedRoute><EditSharedMaterial /></ProtectedRoute>} />
            <Route path="/shared-material-history/:id" element={<ProtectedRoute><SharedMaterialHistory /></ProtectedRoute>} />
            <Route path="/excel-analysis" element={<ProtectedRoute><ExcelAnalysisPage /></ProtectedRoute>} />
            <Route path="/saved-analysis" element={<ProtectedRoute><SavedAnalysisPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/dealer-pricing" element={<ProtectedRoute><PricingAnalysisPage /></ProtectedRoute>} />
            <Route path="/saved-pricing" element={<ProtectedRoute><SavedPricingPage /></ProtectedRoute>} />
            <Route path="/order-cost-rate" element={<ProtectedRoute><OrderCostRatePage /></ProtectedRoute>} />
            <Route path="/shipping" element={<ProtectedRoute><ShippingPage /></ProtectedRoute>} />
          </Routes>
        </div>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;