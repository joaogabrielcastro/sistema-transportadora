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
import { FeatureRoute } from "./components/FeatureRoute.jsx";
import { BillingGate } from "./components/BillingGate.jsx";
import { LoadingSpinner } from "./components/ui";
import AppUpdateBanner from "./components/AppUpdateBanner.jsx";

const Home = lazy(() => import("./Pages/Home.jsx"));
const Login = lazy(() => import("./Pages/Login.jsx"));
const Register = lazy(() => import("./Pages/Register.jsx"));
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
const NotasEstoque = lazy(() => import("./Pages/NotasEstoque.jsx"));
const FiscalCte = lazy(() => import("./Pages/FiscalCte.jsx"));
const FiscalMdfe = lazy(() => import("./Pages/FiscalMdfe.jsx"));
const Usuarios = lazy(() => import("./Pages/Usuarios.jsx"));
const Assinatura = lazy(() => import("./Pages/Assinatura.jsx"));
const Motoristas = lazy(() => import("./Pages/Motoristas.jsx"));
const Documentos = lazy(() => import("./Pages/Documentos.jsx"));
const Alertas = lazy(() => import("./Pages/Alertas.jsx"));
const Auditoria = lazy(() => import("./Pages/Auditoria.jsx"));
const NotFound = lazy(() => import("./Pages/NotFound.jsx"));

function RedirectCadastroLote() {
  const location = useLocation();
  return <Navigate to="/pneus/atribuir" replace state={location.state} />;
}

function AppRoutes() {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";
  const isRegisterPage = location.pathname === "/register";
  const hideChrome = isLoginPage || isRegisterPage;

  const routes = (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/assinatura"
          element={
            <ProtectedRoute>
              <Assinatura />
            </ProtectedRoute>
          }
        />
        <Route
          path="/motoristas"
          element={
            <ProtectedRoute>
              <BillingGate>
                <Motoristas />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documentos"
          element={
            <ProtectedRoute>
              <BillingGate>
                <Documentos />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/alertas"
          element={
            <ProtectedRoute>
              <BillingGate>
                <Alertas />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/auditoria"
          element={
            <ProtectedRoute>
              <BillingGate>
                <Auditoria />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <BillingGate>
                <Home />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro-caminhao"
          element={
            <ProtectedRoute>
              <BillingGate>
                <CadastroCaminhao />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pneus"
          element={
            <ProtectedRoute>
              <BillingGate>
                <Pneus />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pneus/estoque"
          element={
            <ProtectedRoute>
              <BillingGate>
                <PneusEstoque />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pneus/atribuir"
          element={
            <ProtectedRoute>
              <BillingGate>
                <PneuAtribuir />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/caminhao/:placa"
          element={
            <ProtectedRoute>
              <BillingGate>
                <CaminhaoDetail />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/caminhao/editar/:placa"
          element={
            <ProtectedRoute>
              <BillingGate>
                <EditCaminhao />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pneu/editar/:id"
          element={
            <ProtectedRoute>
              <BillingGate>
                <EditPneu />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/manutencao-gastos"
          element={
            <ProtectedRoute>
              <BillingGate>
                <ManutencaoGastos />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/gasto/editar/:id"
          element={
            <ProtectedRoute>
              <BillingGate>
                <EditGasto />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/checklist/editar/:id"
          element={
            <ProtectedRoute>
              <BillingGate>
                <EditChecklist />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pneus/cadastro-em-lote"
          element={
            <ProtectedRoute>
              <BillingGate>
                <RedirectCadastroLote />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/relatorios"
          element={
            <ProtectedRoute>
              <BillingGate>
                <Relatorios />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ordem-coleta"
          element={
            <ProtectedRoute>
              <BillingGate>
                <FeatureRoute feature="ordem_coleta">
                  <OrdensColeta />
                </FeatureRoute>
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/notas-estoque"
          element={
            <ProtectedRoute>
              <BillingGate>
                <FeatureRoute feature="notas_estoque">
                  <NotasEstoque />
                </FeatureRoute>
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/fiscal/cte"
          element={
            <ProtectedRoute>
              <BillingGate>
                {/* TODO: reativar gate por feature flag depois da demo */}
                <FiscalCte />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/fiscal/mdfe"
          element={
            <ProtectedRoute>
              <BillingGate>
                {/* TODO: reativar gate por feature flag depois da demo */}
                <FiscalMdfe />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute>
              <BillingGate>
                <Usuarios />
              </BillingGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <NotFound />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );

  if (hideChrome) return routes;
  return <Navbar>{routes}</Navbar>;
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AppUpdateBanner />
        <AppRoutes />
      </Router>
    </ErrorBoundary>
  );
}

export default App;
