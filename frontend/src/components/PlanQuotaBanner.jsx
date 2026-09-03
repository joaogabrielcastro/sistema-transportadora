import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Alert } from "./ui";
import {
  isUserQuotaReached,
  isVehicleQuotaReached,
} from "../utils/billing.js";

export default function PlanQuotaBanner({ user, resource = "vehicles" }) {
  const reached =
    resource === "users"
      ? isUserQuotaReached(user)
      : isVehicleQuotaReached(user);
  if (!reached) return null;

  const part =
    resource === "users" ? user?.quota?.users : user?.quota?.vehicles;
  const label = resource === "users" ? "usuários" : "veículos";
  const used = part?.used ?? "—";
  const limit = part?.limit ?? "—";

  return (
    <Alert type="warning">
      Limite de {label} do plano atingido ({used}/{limit}).{" "}
      <Link to="/assinatura" className="font-semibold underline">
        Fazer upgrade
      </Link>{" "}
      para cadastrar mais.
    </Alert>
  );
}

PlanQuotaBanner.propTypes = {
  user: PropTypes.object,
  resource: PropTypes.oneOf(["vehicles", "users"]),
};
