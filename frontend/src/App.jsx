// frontend/src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./Pages/Home";
import CadastroCaminhao from "./pages/CadastroCaminhao";
import CaminhaoDetail from "./pages/CaminhaoDetail";
import Pneus from "./Pages/Pneus";
import EditCaminhao from "./pages/EditCaminhao";
import EditPneu from "./Pages/EditPneu";
import ManutencaoGastos from "./Pages/ManutencaoGastos";
import EditGasto from "./Pages/EditGasto";
import Navbar from "./components/Navbar";

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cadastro-caminhao" element={<CadastroCaminhao />} />
        <Route path="/pneus" element={<Pneus />} />
        <Route path="/caminhao/:placa" element={<CaminhaoDetail />} />
        <Route path="/caminhao/editar/:placa" element={<EditCaminhao />} />
        <Route path="/pneu/editar/:id" element={<EditPneu />} />
        <Route path="/manutencao-gastos" element={<ManutencaoGastos />} />
        <Route path="/gasto/editar/:id" element={<EditGasto />} />
      </Routes>
    </Router>
  );
}

export default App;
