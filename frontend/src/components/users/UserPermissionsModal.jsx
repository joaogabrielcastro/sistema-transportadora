import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Modal } from "../ui";
import { apiFetch, parseApiError } from "../../lib/apiClient.js";
import { extractApiData } from "../../utils/extractApiArray.js";
import { PERMISSION_GROUPS } from "../../utils/permissions.js";

const ROLE_LABEL = { admin: "Administrador", operator: "Operador", viewer: "Somente leitura" };

/** Atalhos para perfis comuns (só marcam as caixas; o admin revisa antes de salvar). */
const PRESETS = [
  {
    id: "motorista",
    label: "Motorista",
    perms: ["viagens.read", "viagens.create", "viagens.start", "viagens.finish", "viagens.despesas.read", "viagens.despesas.create"],
  },
  {
    id: "lancador",
    label: "Lança despesas",
    perms: ["viagens.read", "viagens.despesas.read", "viagens.despesas.create"],
  },
  {
    id: "gestor",
    label: "Gestor",
    perms: PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key)),
  },
];

/**
 * Permissões por usuário (somente administradores). O servidor grava apenas o
 * que difere do perfil e valida tudo de novo em cada requisição.
 */
export default function UserPermissionsModal({ target, isOpen, onClose, onSaved }) {
  const catalog = useQuery({
    queryKey: ["users", "permissions-catalog"],
    enabled: isOpen,
    staleTime: 10 * 60_000,
    queryFn: async () => extractApiData(await apiFetch({ method: "GET", url: "/users/permissions-catalog" })),
  });
  const configurable = useMemo(() => new Set(catalog.data?.configurable || []), [catalog.data]);
  const roleDefaults = useMemo(
    () => new Set(catalog.data?.roles?.[target?.role] || []),
    [catalog.data, target?.role],
  );
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && target) {
      setSelected(new Set((target.permissions || []).filter((p) => configurable.has(p))));
      setError("");
    }
  }, [isOpen, target, configurable]);

  if (!target) return null;
  const toggle = (key) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      // Sem ver viagens, as demais permissões do módulo não têm efeito.
      if (key === "viagens.read" && !next.has(key)) {
        for (const g of PERMISSION_GROUPS) for (const i of g.items) if (i.key.startsWith("viagens.")) next.delete(i.key);
      }
      if (key !== "viagens.read" && key.startsWith("viagens.") && next.has(key)) next.add("viagens.read");
      return next;
    });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await apiFetch({ method: "PATCH", url: `/users/${target.id}`, data: { permissions: [...selected] } });
      onSaved?.();
      onClose();
    } catch (err) {
      setError((await parseApiError(err)).message || "Falha ao salvar permissões");
    } finally {
      setSaving(false);
    }
  };

  const differs = [...configurable].some((p) => selected.has(p) !== roleDefaults.has(p));

  return (
    <Modal isOpen={isOpen} onClose={saving ? undefined : onClose} title={`Permissões de ${target.nome}`} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Perfil <b className="text-text-primary">{ROLE_LABEL[target.role] || target.role}</b>. Marque o que esta pessoa pode
          fazer. As regras valem também para a API: o que estiver desmarcado é bloqueado no servidor.
        </p>
        {error ? <Alert type="error" message={error} /> : null}
        {catalog.isError ? <Alert type="error" message="Não foi possível carregar as permissões." /> : null}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-text-secondary">Atalhos:</span>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(new Set(p.perms))}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-primary hover:bg-slate-50"
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelected(new Set(roleDefaults))}
            className="rounded-full px-3 py-1 text-xs font-medium text-secondary-dark hover:underline"
          >
            Padrão do perfil
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {PERMISSION_GROUPS.map((g) => (
            <fieldset key={g.id} className="rounded-xl border border-border p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">{g.label}</legend>
              <ul className="space-y-2">
                {g.items.map((i) => (
                  <li key={i.key}>
                    <label className="flex cursor-pointer items-start gap-2 text-sm text-text-primary">
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-border"
                        checked={selected.has(i.key)}
                        onChange={() => toggle(i.key)}
                        disabled={catalog.isLoading}
                      />
                      <span>
                        {i.label}
                        {roleDefaults.has(i.key) !== selected.has(i.key) ? (
                          <span className="ml-1 text-[10px] font-semibold uppercase text-amber-700">alterado</span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          ))}
        </div>
        <p className="text-xs text-text-secondary">
          Sem “Ver valores das viagens”, a pessoa vê viagens e despesas, mas não os valores em R$, o total nem o custo por km.
          Para fechar também os gastos da frota, desmarque “Ver gastos da frota” e “Relatórios gerais de custo”.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={save} loading={saving} disabled={catalog.isLoading || catalog.isError}>
            {differs ? "Salvar permissões" : "Salvar (padrão do perfil)"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

UserPermissionsModal.propTypes = {
  target: PropTypes.object,
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func,
};
