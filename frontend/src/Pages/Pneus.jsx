// src/pages/Pneus.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

const Pneus = () => {
  const [caminhoes, setCaminhoes] = useState([]);
  const [posicoes, setPosicoes] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [pneus, setPneus] = useState([]);
  const [form, setForm] = useState({
    caminhao_id: "",
    posicao_id: "",
    status_id: "",
    vida_util_km: "",
    marca: "",
    modelo: "",
    data_instalacao: "",
    km_instalacao: "",
    observacao: "",
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [caminhoesRes, posicoesRes, statusRes, pneusRes] =
          await Promise.all([
            axios.get("http://localhost:3000/api/caminhoes"),
            axios.get("http://localhost:3000/api/posicoes-pneus"),
            axios.get("http://localhost:3000/api/status-pneus"),
            axios.get("http://localhost:3000/api/pneus"),
          ]);
        setCaminhoes(caminhoesRes.data);
        setPosicoes(posicoesRes.data);
        setStatusList(statusRes.data);
        setPneus(pneusRes.data);
      } catch (err) {
        setError("Erro ao carregar dados. Verifique a conexão com o backend.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...form,
        caminhao_id: parseInt(form.caminhao_id),
        posicao_id: parseInt(form.posicao_id),
        status_id: parseInt(form.status_id),
        vida_util_km: parseInt(form.vida_util_km),
        km_instalacao: parseInt(form.km_instalacao),
      };
      await axios.post("http://localhost:3000/api/pneus", dataToSend);
      const res = await axios.get("http://localhost:3000/api/pneus");
      setPneus(res.data);
      setForm({
        caminhao_id: "",
        posicao_id: "",
        status_id: "",
        vida_util_km: "",
        marca: "",
        modelo: "",
        data_instalacao: "",
        km_instalacao: "",
        observacao: "",
      });
      setError(null);
    } catch (err) {
      setError("Erro ao cadastrar pneu.");
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja deletar este pneu?")) {
      try {
        await axios.delete(`http://localhost:3000/api/pneus/${id}`);
        setPneus(pneus.filter((p) => p.id !== id));
      } catch (err) {
        setError("Erro ao deletar pneu.");
        console.error(err);
      }
    }
  };

  if (loading) return <div className="text-center mt-10">Carregando...</div>;
  if (error)
    return <div className="text-center mt-10 text-accent">{error}</div>;

  return (
    <div className="p-8 bg-neutral min-h-screen">
      <div className="card max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center text-text-dark">
          Controle de Pneus
        </h1>

        {/* Formulário de Cadastro */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-4">Adicionar Novo Pneu</h2>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div>
              <label className="label">Caminhão</label>
              <select
                name="caminhao_id"
                value={form.caminhao_id}
                onChange={handleChange}
                required
                className="input"
              >
                <option value="">Selecione o Caminhão</option>
                {caminhoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.placa}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Posição</label>
              <select
                name="posicao_id"
                value={form.posicao_id}
                onChange={handleChange}
                required
                className="input"
              >
                <option value="">Selecione a Posição</option>
                {posicoes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome_posicao}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                name="status_id"
                value={form.status_id}
                onChange={handleChange}
                required
                className="input"
              >
                <option value="">Selecione o Status</option>
                {statusList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome_status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Marca</label>
              <input
                type="text"
                name="marca"
                value={form.marca}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Modelo</label>
              <input
                type="text"
                name="modelo"
                value={form.modelo}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Vida Útil (KM)</label>
              <input
                type="number"
                name="vida_util_km"
                value={form.vida_util_km}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Data de Instalação</label>
              <input
                type="date"
                name="data_instalacao"
                value={form.data_instalacao}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">KM na Instalação</label>
              <input
                type="number"
                name="km_instalacao"
                value={form.km_instalacao}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            <div className="col-span-1 md:col-span-2 lg:col-span-3">
              <label className="label">Observação</label>
              <textarea
                name="observacao"
                value={form.observacao}
                onChange={handleChange}
                className="input"
              ></textarea>
            </div>
            <button
              type="submit"
              className="col-span-1 md:col-span-2 lg:col-span-3 btn-primary"
            >
              Cadastrar Pneu
            </button>
          </form>
        </div>

        {/* Tabela de Pneus */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Pneus Cadastrados</h2>
          {pneus.length === 0 ? (
            <p className="text-gray-500">Nenhum pneu cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-neutral">
                    <th className="py-2 px-4 border-b">Placa</th>
                    <th className="py-2 px-4 border-b">Posição</th>
                    <th className="py-2 px-4 border-b">Status</th>
                    <th className="py-2 px-4 border-b">Marca</th>
                    <th className="py-2 px-4 border-b">KM na Inst.</th>
                    <th className="py-2 px-4 border-b">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pneus.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b hover:bg-neutral transition-colors duration-200"
                    >
                      <td className="py-2 px-4 text-center">
                        {p.caminhoes?.placa || "N/A"}
                      </td>
                      <td className="py-2 px-4 text-center">
                        {p.posicoes_pneus?.nome_posicao || "N/A"}
                      </td>
                      <td className="py-2 px-4 text-center">
                        {p.status_pneus?.nome_status || "N/A"}
                      </td>
                      <td className="py-2 px-4 text-center">{p.marca}</td>
                      <td className="py-2 px-4 text-center">
                        {p.km_instalacao}
                      </td>
                      <td className="py-2 px-4 text-center">
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-accent hover:underline"
                        >
                          Deletar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Pneus;
