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
import { PermissionRoute } from "./components/PermissionRoute.jsx";
import { BillingGate } from "./components/BillingGate.jsx";
import { LoadingSpinner } from "./components/ui";
import AppUpdateBanner from "./components/AppUpdateBanner.jsx";
import { PERMISSIONS } from "./utils/permissions.js";
import { useAuth } from "./context/AuthContext.jsx";

const Home = lazy(() => import("./Pages/Home.jsx"));
const Login = lazy(() => import("./Pages/Login.jsx"));
const Register = lazy(() => import("./Pages/Register.jsx"));
const ForgotPassword = lazy(() => import("./Pages/ForgotPassword.jsx"));
const ResetPassword = lazy(() => import("./Pages/ResetPassword.jsx"));
const AcceptInvite = lazy(() => import("./Pages/AcceptInvite.jsx"));
const Termos = lazy(() => import("./Pages/Termos.jsx"));
const Privacidade = lazy(() => import("./Pages/Privacidade.jsx"));
const Conta = lazy(() => import("./Pages/Conta.jsx"));
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
const Usuarios = lazy(() => import("./Pages/Usuarios.jsx"));
const Assinatura = lazy(() => import("./Pages/Assinatura.jsx"));
const Empresa = lazy(() => import("./Pages/Empresa.jsx"));
const Motoristas = lazy(() => import("./Pages/Motoristas.jsx"));
const Documentos = lazy(() => import("./Pages/Documentos.jsx"));
const Alertas = lazy(() => import("./Pages/Alertas.jsx"));
const Auditoria = lazy(() => import("./Pages/Auditoria.jsx"));
const Landing = lazy(() => import("./Pages/Landing.jsx"));
const NotFound = lazy(() => import("./Pages/NotFound.jsx"));

function RedirectCadastroLote() {
  const location = useLocation();
  return <Navigate to="/pneus/atribuir" replace state={location.state} />;
}

function GuardedRoute({
  permission,
  feature,
  billing = true,
  children,
}) {
  let node = children;
  if (permission) {
    node = <PermissionRoute permission={permission}>{node}</PermissionRoute>;
  }
  if (feature) {
    node = <FeatureRoute feature={feature}>{node}</FeatureRoute>;
  }
  if (billing) {
    node = <BillingGate>{node}</BillingGate>;
  }
  return <ProtectedRoute>{node}</ProtectedRoute>;
}

function HomeOrLanding() {
  const { isAuthenticated } = useAuth();
  const authRequired = import.meta.env.VITE_AUTH_REQUIRED !== "false";
  if (!authRequired || isAuthenticated) {
    return (
      <GuardedRoute>
        <Home />
      </GuardedRoute>
    );
  }
  return <Landing />;
}

function AppRoutes() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const authRequired = import.meta.env.VITE_AUTH_REQUIRED !== "false";
  const isPublicHome =
    location.pathname === "/" && authRequired && !isAuthenticated;
  const hideChrome = isPublicHome || [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-senha",
    "/convite",
    "/termos",
    "/privacidade",
  ].includes(location.pathname);

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
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-senha" element={<ResetPassword />} />
        <Route path="/convite" element={<AcceptInvite />} />
        <Route path="/termos" element={<Termos />} />
        <Route path="/privacidade" element={<Privacidade />} />
        <Route path="/precos" element={<Navigate to="/#precos" replace />} />
        <Route path="/" element={<HomeOrLanding />} />
        <Route
          path="/conta"
          element={
            <GuardedRoute billing={false}>
              <Conta />
            </GuardedRoute>
          }
        />
        <Route
          path="/assinatura"
          element={
            <GuardedRoute billing={false}>
              <Assinatura />
            </GuardedRoute>
          }
        />
        <Route
          path="/empresa"
          element={
            <GuardedRoute
              billing={false}
              permission={PERMISSIONS.SETTINGS_WRITE}
            >
              <Empresa />
            </GuardedRoute>
          }
        />
        <Route
          path="/motoristas"
          element={
            <GuardedRoute>
              <Motoristas />
            </GuardedRoute>
          }
        />
        <Route
          path="/documentos"
          element={
            <GuardedRoute>
              <Documentos />
            </GuardedRoute>
          }
        />
        <Route
          path="/alertas"
          element={
            <GuardedRoute>
              <Alertas />
            </GuardedRoute>
          }
        />
        <Route
          path="/auditoria"
          element={
            <GuardedRoute permission={PERMISSIONS.AUDIT_READ}>
              <Auditoria />
            </GuardedRoute>
          }
        />
        <Route
          path="/cadastro-caminhao"
          element={
            <GuardedRoute permission={PERMISSIONS.FROTA_WRITE}>
              <CadastroCaminhao />
            </GuardedRoute>
          }
        />
        <Route
          path="/pneus"
          element={
            <GuardedRoute>
              <Pneus />
            </GuardedRoute>
          }
        />
        <Route
          path="/pneus/estoque"
          element={
            <GuardedRoute>
              <PneusEstoque />
            </GuardedRoute>
          }
        />
        <Route
          path="/pneus/atribuir"
          element={
            <GuardedRoute permission={PERMISSIONS.PNEUS_WRITE}>
              <PneuAtribuir />
            </GuardedRoute>
          }
        />
        <Route
          path="/caminhao/:placa"
          element={
            <GuardedRoute>
              <CaminhaoDetail />
            </GuardedRoute>
          }
        />
        <Route
          path="/caminhao/editar/:placa"
          element={
            <GuardedRoute permission={PERMISSIONS.FROTA_WRITE}>
              <EditCaminhao />
            </GuardedRoute>
          }
        />
        <Route
          path="/pneu/editar/:id"
          element={
            <GuardedRoute permission={PERMISSIONS.PNEUS_WRITE}>
              <EditPneu />
            </GuardedRoute>
          }
        />
        <Route
          path="/manutencao-gastos"
          element={
            <GuardedRoute>
              <ManutencaoGastos />
            </GuardedRoute>
          }
        />
        <Route
          path="/gasto/editar/:id"
          element={
            <GuardedRoute permission={PERMISSIONS.GASTOS_WRITE}>
              <EditGasto />
            </GuardedRoute>
          }
        />
        <Route
          path="/checklist/editar/:id"
          element={
            <GuardedRoute permission={PERMISSIONS.GASTOS_WRITE}>
              <EditChecklist />
            </GuardedRoute>
          }
        />
        <Route
          path="/pneus/cadastro-em-lote"
          element={
            <GuardedRoute permission={PERMISSIONS.PNEUS_WRITE}>
              <RedirectCadastroLote />
            </GuardedRoute>
          }
        />
        <Route
          path="/relatorios"
          element={
            <GuardedRoute permission={PERMISSIONS.REPORTS_READ}>
              <Relatorios />
            </GuardedRoute>
          }
        />
        <Route
          path="/ordem-coleta"
          element={
            <GuardedRoute
              feature="ordem_coleta"
              permission={PERMISSIONS.ORDEM_SEND}
            >
              <OrdensColeta />
            </GuardedRoute>
          }
        />
        <Route
          path="/notas-estoque"
          element={
            <GuardedRoute
              feature="notas_estoque"
              permission={PERMISSIONS.NOTAS_READ}
            >
              <NotasEstoque />
            </GuardedRoute>
          }
        />
        <Route
          path="/usuarios"
          element={
            <GuardedRoute permission={PERMISSIONS.USERS_MANAGE}>
              <Usuarios />
            </GuardedRoute>
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
