import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import firebase from './utils/firebase';
import 'firebase/compat/auth';
import Header from "./Header";
import Footer from "./components/Footer";
import Signin from "./pages/Signin";
import BomTables from "./pages/BomTable";
import NewBomTables from "./pages/NewBomTable";
import NewSharedMaterial from './pages/NewSharedMaterial';
import HomePage from "./pages/HomePage";
import SharedMaterial from "./pages/SharedMaterials";
import EditBomTable from "./pages/EditBomTable";
import EditSharedMaterial from "./pages/EditSharedMaterials";
import SharedMaterialHistory from "./pages/SharedMaterialHistory";

function AppContent() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        // 當用戶登入時，設置最後活動時間
        localStorage.setItem('lastActivity', Date.now().toString());

        // 設置每分鐘檢查一次的計時器
        const checkActivityInterval = setInterval(() => {
          const lastActivity = parseInt(localStorage.getItem('lastActivity') || '0');
          const currentTime = Date.now();
          if (currentTime - lastActivity > 10 * 60 * 1000) { // 10分鐘 = 600000毫秒
            clearInterval(checkActivityInterval);
            firebase.auth().signOut().then(() => {
              toast.info('由於長時間未活動，您已被登出', {
                position: "top-center",
                autoClose: 3000,
              });
              navigate('/signin');
            });
          }
        }, 60000); // 每分鐘檢查一次

        // 清理函數
        return () => {
          clearInterval(checkActivityInterval);
        };
      }
    });

    // 添加事件監聽器來更新最後活動時間
    const updateLastActivity = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
    };
    window.addEventListener('mousemove', updateLastActivity);
    window.addEventListener('keydown', updateLastActivity);

    return () => {
      unsubscribe();
      window.removeEventListener('mousemove', updateLastActivity);
      window.removeEventListener('keydown', updateLastActivity);
    };
  }, [navigate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" exact element={<HomePage />} />
          <Route path="/bom-table" exact element={<BomTables />} />
          <Route path="/shared-material" element={<SharedMaterial />} />
          <Route path="/signin" element={<Signin />} />
          <Route path="/new-bomtable" exact element={<NewBomTables />} />
          <Route path="/new-shared-material" element={<NewSharedMaterial />} />
          <Route path="/edit-bom-table/:id" element={<EditBomTable />} />
          <Route path="/edit-shared-material/:id" element={<EditSharedMaterial />} />
          <Route path="/shared-material-history/:id" element={<SharedMaterialHistory />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ToastContainer 
        position="top-center"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <AppContent />
    </BrowserRouter>
  );
}

export default App;