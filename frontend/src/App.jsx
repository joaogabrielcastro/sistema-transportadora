// frontend/src/App.jsx
import React, { Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { LoadingSpinner } from "./components/ui";

const Home = lazy(() => import("./Pages/Home.jsx"));
const Login = lazy(() => import("./Pages/Login.jsx"));
const CadastroCaminhao = lazy(() => import("./Pages/CadastroCaminhao.jsx"));
const CaminhaoDetail = lazy(() => import("./Pages/CaminhaoDetail.jsx"));
const Pneus = lazy(() => import("./Pages/Pneus.jsx"));
const PneusEstoque = lazy(() => import("./Pages/PneusEstoque.jsx"));
const PneuAtribuir = lazy(() => import("./Pages/PneuAtribuir.jsx"));
const EditCaminhao = lazy(() => import("./Pages/EditCaminhao.jsx"));
const EditPneu = lazy(() => import("./Pages/EditPneu.jsx"));
const ManutencaoGastos = lazy(() => import("./Pages/ManutencaoGastos.jsx"));
const EditGasto = lazy(() => import("./Pages/EditGasto.jsx"));
const EditChecklist = lazy(() => import("./Pages/EditChecklist.jsx"));
const Relatorios = lazy(() => import("./Pages/Relatorios.jsx"));
const OrdensColeta = lazy(() => import("./Pages/OrdensColeta.jsx"));

function RedirectCadastroLote() {
  const location = useLocation();
  return <Navigate to="/pneus/atribuir" replace state={location.state} />;
}

function AppRoutes() {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";

  return (
    <>
      {!isLoginPage && <Navbar />}
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <LoadingSpinner size="lg" />
          </div>
        }
      >
        <Routes>
          <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cadastro-caminhao"
              element={
                <ProtectedRoute>
                  <CadastroCaminhao />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pneus"
              element={
                <ProtectedRoute>
                  <Pneus />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pneus/estoque"
              element={
                <ProtectedRoute>
                  <PneusEstoque />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pneus/atribuir"
              element={
                <ProtectedRoute>
                  <PneuAtribuir />
                </ProtectedRoute>
              }
            />
            <Route
              path="/caminhao/:placa"
              element={
                <ProtectedRoute>
                  <CaminhaoDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/caminhao/editar/:placa"
              element={
                <ProtectedRoute>
                  <EditCaminhao />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pneu/editar/:id"
              element={
                <ProtectedRoute>
                  <EditPneu />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manutencao-gastos"
              element={
                <ProtectedRoute>
                  <ManutencaoGastos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gasto/editar/:id"
              element={
                <ProtectedRoute>
                  <EditGasto />
                </ProtectedRoute>
              }
            />
            <Route
              path="/checklist/editar/:id"
              element={
                <ProtectedRoute>
                  <EditChecklist />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pneus/cadastro-em-lote"
              element={
                <ProtectedRoute>
                  <RedirectCadastroLote />
                </ProtectedRoute>
              }
            />
            <Route
              path="/relatorios"
              element={
                <ProtectedRoute>
                  <Relatorios />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ordem-coleta"
              element={
                <ProtectedRoute>
                  <OrdensColeta />
                </ProtectedRoute>
              }
            />
          </Routes>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AppRoutes />
      </Router>
    </ErrorBoundary>
  );
}

export default App;
