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
import OrderCostRatePage from './components/OrderCostRatePage';

function useAuth() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
  
    useEffect(() => {
      const unsubscribe = firebase.auth().onAuthStateChanged((currentUser) => {
        setUser(currentUser);
        setLoading(false);
  
        if (currentUser) {
          const timestamp = Date.now();
          localStorage.setItem('lastActivityTime', timestamp.toString());
        }
      });
  
      return unsubscribe;
    }, []);
  
    useEffect(() => {
      if (!user) return;
  
      // 縮短超時時間為 30 分鐘
      const INACTIVITY_TIMEOUT = 30 * 60 * 1000; 
      // 縮短檢查間隔為 1 分鐘
      const CHECK_INTERVAL = 60 * 1000; 
  
      let lastActivity = Date.now();
      let timeoutId = null;
  
      const resetTimer = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        lastActivity = Date.now();
        localStorage.setItem('lastActivityTime', lastActivity.toString());
        
        timeoutId = setTimeout(checkAndLogout, INACTIVITY_TIMEOUT);
      };
  
      const checkAndLogout = () => {
        const currentTime = Date.now();
        const inactiveTime = currentTime - lastActivity;
  
        if (inactiveTime >= INACTIVITY_TIMEOUT) {
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
      };
  
      // 增加更多活動事件監聽
      const activityEvents = [
        'mousedown',
        'mousemove',
        'keydown',
        'scroll',
        'touchstart',
        'click',
        'input',
        'change',
        'submit',
        'focus',
        'blur'
      ];
  
      // 添加節流函數避免過於頻繁的更新
      let throttleTimeout;
      const throttledResetTimer = () => {
        if (!throttleTimeout) {
          throttleTimeout = setTimeout(() => {
            resetTimer();
            throttleTimeout = null;
          }, 1000); // 1秒內只觸發一次
        }
      };
  
      activityEvents.forEach(event => {
        window.addEventListener(event, throttledResetTimer);
      });
  
      // 初始化定時器
      resetTimer();
  
      // 定期檢查
      const intervalId = setInterval(checkAndLogout, CHECK_INTERVAL);
  
      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        clearInterval(intervalId);
        activityEvents.forEach(event => {
          window.removeEventListener(event, throttledResetTimer);
        });
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
            <Route path="/order-cost-rate" element={<OrderCostRatePage />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;