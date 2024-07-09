import React from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./Header";
import Footer from "./components/Footer"; // 導入 Footer
import Sighin from "./pages/Signin";
import BomTables from "./pages/BomTable";
import NewBomTables from "./pages/NewBomTable";
import NewSharedMaterial from './pages/NewSharedMaterial';
import HomePage from "./pages/HomePage";
import SharedMaterial from "./pages/SharedMaterials";
import EditBomTable from "./pages/EditBomTable"

function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/" exact element={<HomePage />} />
            <Route path="/bom-table" exact element={<BomTables />} />
            <Route path="/shared-material" element={<SharedMaterial />} />
            <Route path="/signin" element={<Sighin />} />
            <Route path="/new-bomtable" exact element={<NewBomTables />} />
            <Route path="/new-shared-material" element={<NewSharedMaterial />} />
            <Route path="/edit-bom-table/:id" element={<EditBomTable />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;