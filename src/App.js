import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from "react-router-dom";
import firebase from './utils/firebase';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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

function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // 更新最後活動時間
        const timestamp = Date.now();
        localStorage.setItem('lastActivityTime', timestamp.toString());
        console.log('User logged in, setting lastActivityTime:', timestamp);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return; // 如果沒有用戶登入，不需要執行監控

    const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2小時
    const CHECK_INTERVAL = 3 * 60 * 1000; // 每3分鐘檢查一次

    // 更新最後活動時間的函數
    const updateLastActivityTime = () => {
      if (user) {
        const timestamp = Date.now();
        localStorage.setItem('lastActivityTime', timestamp.toString());
        console.log('Activity detected, updating lastActivityTime:', timestamp);
      }
    };

    // 檢查是否需要登出的函數
    const checkInactivity = () => {
      const lastActivityTime = localStorage.getItem('lastActivityTime');
      if (lastActivityTime && user) {
        const currentTime = Date.now();
        const inactiveTime = currentTime - parseInt(lastActivityTime, 10);
        console.log('Checking inactivity. Time since last activity:', inactiveTime / 1000 / 60, 'minutes');

        if (inactiveTime > INACTIVITY_TIMEOUT) {
          console.log('Inactivity timeout reached, logging out');
          firebase.auth().signOut().then(() => {
            localStorage.removeItem('lastActivityTime');
            toast.info('由於長時間無活動，您已被登出', {
              position: "top-center",
              autoClose: 3000,
            });
            navigate('/signin');
          }).catch(error => {
            console.error('Logout error:', error);
          });
        }
      }
    };

    // 設置活動監聽器
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    activityEvents.forEach(event => {
      document.addEventListener(event, updateLastActivityTime);
    });

    // 設置定期檢查
    const intervalId = setInterval(checkInactivity, CHECK_INTERVAL);

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, updateLastActivityTime);
      });
      clearInterval(intervalId);
    };
  }, [navigate, user]);

  return { user, loading };
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>載入中...</div>;
  }

  if (window.location.pathname === '/') {
    return React.cloneElement(children, { user });
  }

  return user ? children : <Navigate to="/signin" />;
}

function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <ToastContainer />
        <Header />
        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/signin" element={<Signin />} />
            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/bom-table" element={<ProtectedRoute><BomTables /></ProtectedRoute>} />
            <Route path="/shared-material" element={<ProtectedRoute><SharedMaterial /></ProtectedRoute>} />
            <Route path="/new-bomtable" element={<ProtectedRoute><NewBomTables /></ProtectedRoute>} />
            <Route path="/new-shared-material" element={<ProtectedRoute><NewSharedMaterial /></ProtectedRoute>} />
            <Route path="/edit-bom-table/:id" element={<ProtectedRoute><EditBomTable /></ProtectedRoute>} />
            <Route path="/edit-shared-material/:id" element={<ProtectedRoute><EditSharedMaterial /></ProtectedRoute>} />
            <Route path="/shared-material-history/:id" element={<ProtectedRoute><SharedMaterialHistory /></ProtectedRoute>} />
            <Route path="/excel-analysis" element={<ProtectedRoute><ExcelAnalysisPage /></ProtectedRoute>} />
            <Route path="/saved-analysis" element={<ProtectedRoute><SavedAnalysisPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/dealer-pricing" element={<PricingAnalysisPage />} />
            <Route path="/saved-pricing" element={<SavedPricingPage />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;