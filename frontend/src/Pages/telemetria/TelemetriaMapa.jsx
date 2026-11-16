import { Navigate } from "react-router-dom";

/** Rota legada: o monitoramento é a home da telemetria. */
export default function TelemetriaMapa() {
  return <Navigate to="/telemetria" replace />;
}
