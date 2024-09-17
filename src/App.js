import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
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

function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
      const unsubscribe = firebase.auth().onAuthStateChanged((currentUser) => {
          console.log("Auth state changed:", currentUser ? "User logged in" : "User logged out");
          setUser(currentUser);
          setLoading(false);

          if (currentUser) {
              console.log("Updating last activity time on login");
              localStorage.setItem('lastActivityTime', Date.now().toString());
          }
      });

      return unsubscribe;
  }, []);

  useEffect(() => {
      const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 小時
      const CHECK_INTERVAL = 5 * 60 * 1000; // 5 分鐘

      const checkInactivity = () => {
          const lastActivityTime = localStorage.getItem('lastActivityTime');
          if (lastActivityTime && user) {
              const currentTime = Date.now();
              const inactiveTime = currentTime - parseInt(lastActivityTime, 10);
              
              if (inactiveTime > INACTIVITY_TIMEOUT) {
                  console.log("Inactivity threshold reached, logging out");
                  firebase.auth().signOut().then(() => {
                      console.log("User signed out due to inactivity");
                      toast.info('由於長時間無活動，您已被登出', {
                          position: "top-center",
                          autoClose: 3000,
                      });
                      navigate('/signin');
                  });
              }
          }
      };

      const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
      const handleUserActivity = () => {
          localStorage.setItem('lastActivityTime', Date.now().toString());
      };

      activityEvents.forEach(event => {
          document.addEventListener(event, handleUserActivity);
      });

      const intervalId = setInterval(checkInactivity, CHECK_INTERVAL);

      return () => {
          clearInterval(intervalId);
          activityEvents.forEach(event => {
              document.removeEventListener(event, handleUserActivity);
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

  // 如果是首頁，無論用戶是否登入都顯示內容
  if (window.location.pathname === '/') {
      return React.cloneElement(children, { user });
  }

  // 對於其他頁面，保持原有的保護邏輯
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
                    </Routes>
                </div>
                <Footer />
            </div>
        </BrowserRouter>
    );
}

export default App;