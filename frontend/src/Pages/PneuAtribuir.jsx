import React, { useState, useEffect } from "react";
import { useApi } from "../hooks/useApi.js";
import { Card, Button, Alert, LoadingSpinner, FormField } from "../components/ui";
import { useSearchParams, useNavigate } from "react-router-dom";

const PneuAtribuir = () => {
  const { get, post, loading, error } = useApi();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialPneuId = searchParams.get("pneu_id") || "";

  const [pneus, setPneus] = useState([]);
  const [caminhoes, setCaminhoes] = useState([]);
  const [posicoes, setPosicoes] = useState([]);
  const [form, setForm] = useState({ stock_pneu_id: initialPneuId, caminhao_id: "", posicao_id: "", status_id: "", data_instalacao: "", km_instalacao: "" });
  const [success, setSuccess] = useState("");

  const fetchData = async () => {
    try {
      const [pRes, cRes, posRes] = await Promise.all([get("/pneus/in-stock"), get("/caminhoes"), get("/posicoes-pneus")]);
      setPneus(pRes.data || []);
      setCaminhoes(cRes.data || []);
      setPosicoes(posRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        stock_pneu_id: form.stock_pneu_id ? parseInt(form.stock_pneu_id) : undefined,
        caminhao_id: parseInt(form.caminhao_id),
        posicao_id: parseInt(form.posicao_id),
        status_id: parseInt(form.status_id),
        data_instalacao: form.data_instalacao || undefined,
        km_instalacao: form.km_instalacao ? parseInt(form.km_instalacao) : undefined,
      };

      await post("/pneus", payload);
      setSuccess("Pneu atribuído ao caminhão com sucesso");
      setTimeout(() => setSuccess(""), 4000);
      navigate("/pneus/estoque");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Atribuir Pneu do Estoque</h1>
        {error && <Alert type="error" message={error} />}
        {success && <Alert type="success" message={success} />}

        <Card>
          <form onSubmit={handleSubmit}>
            <FormField label="Pneu (em estoque)" name="stock_pneu_id" as="select" value={form.stock_pneu_id} onChange={handleChange}>
              <option value="">-- selecionar --</option>
              {pneus.map((p) => (
                <option key={p.id} value={p.id}>{p.marca} {p.modelo} (ID: {p.id})</option>
              ))}
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Caminhão" name="caminhao_id" as="select" value={form.caminhao_id} onChange={handleChange}>
                <option value="">-- selecionar --</option>
                {caminhoes.map((c) => (
                  <option key={c.id} value={c.id}>{c.placa}</option>
                ))}
              </FormField>

              <FormField label="Posição" name="posicao_id" as="select" value={form.posicao_id} onChange={handleChange}>
                <option value="">-- selecionar --</option>
                {posicoes.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome_posicao}</option>
                ))}
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <FormField label="Status (ID)" name="status_id" value={form.status_id} onChange={handleChange} placeholder="ID do status para Em uso" />
              <FormField label="KM instalação" name="km_instalacao" type="number" value={form.km_instalacao} onChange={handleChange} />
            </div>

            <FormField label="Data de instalação" name="data_instalacao" type="date" value={form.data_instalacao} onChange={handleChange} />

            <div className="flex justify-end mt-4">
              <Button type="submit" loading={loading}>Atribuir Pneu</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default PneuAtribuir;
