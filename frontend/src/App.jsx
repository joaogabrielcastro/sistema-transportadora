// frontend/src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./Pages/Home.jsx";
import CadastroCaminhao from "./Pages/CadastroCaminhao.jsx";
import CaminhaoDetail from "./Pages/CaminhaoDetail.jsx";
import Pneus from "./Pages/Pneus.jsx";
import EditCaminhao from "./Pages/EditCaminhao.jsx";
import EditPneu from "./Pages/EditPneu.jsx";
import ManutencaoGastos from "./Pages/ManutencaoGastos.jsx";
import EditGasto from "./Pages/EditGasto.jsx";
import Navbar from "./components/Navbar.jsx";
import EditChecklist from "./Pages/EditChecklist.jsx";
import CadastroPneuEmLote from "./Pages/CadastroPneuEmLote.jsx";

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
        <Route path="/checklist/editar/:id" element={<EditChecklist />} />
        <Route
          path="/pneus/cadastro-em-lote"
          element={<CadastroPneuEmLote />}
        />
      </Routes>
    </Router>
  );
}

export default App;
