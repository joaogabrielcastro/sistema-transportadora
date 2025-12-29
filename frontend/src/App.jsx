// frontend/src/App.jsx
import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import LoadingSpinner from "./components/LoadingSpinner.jsx";

// Lazy loading das páginas
const Home = lazy(() => import("./Pages/Home.jsx"));
const CadastroCaminhao = lazy(() => import("./Pages/CadastroCaminhao.jsx"));
const CaminhaoDetail = lazy(() => import("./Pages/CaminhaoDetail.jsx"));
const Pneus = lazy(() => import("./Pages/Pneus.jsx"));
const EditCaminhao = lazy(() => import("./Pages/EditCaminhao.jsx"));
const EditPneu = lazy(() => import("./Pages/EditPneu.jsx"));
const ManutencaoGastos = lazy(() => import("./Pages/ManutencaoGastos.jsx"));
const EditGasto = lazy(() => import("./Pages/EditGasto.jsx"));
const EditChecklist = lazy(() => import("./Pages/EditChecklist.jsx"));
const CadastroPneuEmLote = lazy(() => import("./Pages/CadastroPneuEmLote.jsx"));

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Navbar />
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-screen">
              <LoadingSpinner size="large" />
            </div>
          }
        >
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
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
