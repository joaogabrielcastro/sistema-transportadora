// src/pages/ManutencaoGastos.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

const ManutencaoGastos = () => {
  const [caminhoes, setCaminhoes] = useState([]);
  const [itensChecklist, setItensChecklist] = useState([]);
  const [tiposGastos, setTiposGastos] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [form, setForm] = useState({
    tipo: "gasto",
    caminhao_id: "",
    tipo_id: "",
    valor: "",
    data: "",
    observacao: "",
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // ID do tipo de gasto "Manutenção" no banco de dados.
  // VERIFIQUE SE ESTE ID ESTÁ CORRETO NO SEU SUPABASE!
  const ID_TIPO_GASTO_MANUTENCAO = 2;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [caminhoesRes, itensRes, tiposRes, gastosRes, checklistRes] =
          await Promise.all([
            axios.get("http://localhost:3000/api/caminhoes"),
            axios.get("http://localhost:3000/api/itens-checklist"),
            axios.get("http://localhost:3000/api/tipos-gastos"),
            axios.get("http://localhost:3000/api/gastos"),
            axios.get("http://localhost:3000/api/checklist"),
          ]);

        const gastosFormatados = gastosRes.data.map((g) => ({
          ...g,
          tipo_registro: "Gasto",
          nome_tipo: g.tipos_gastos?.nome_tipo,
          placa: g.caminhoes?.placa,
          data: g.data_gasto,
          observacao: g.descricao,
        }));

        const checklistFormatados = checklistRes.data.map((c) => ({
          ...c,
          tipo_registro: "Manutenção",
          nome_tipo: c.itens_checklist?.nome_item,
          placa: c.caminhoes?.placa,
          data: c.data_manutencao,
          valor: "N/A",
          observacao: c.observacao, // Adicione a observação do checklist aqui
        }));

        setCaminhoes(caminhoesRes.data);
        setItensChecklist(itensRes.data);
        setTiposGastos(tiposRes.data);
        setRegistros(
          [...gastosFormatados, ...checklistFormatados].sort(
            (a, b) => new Date(b.data) - new Date(a.data)
          )
        );
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

  const handleTipoChange = (e) => {
    const { value } = e.target;
    setForm({
      ...form,
      tipo: value,
      tipo_id: "",
      valor: "",
      observacao: "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (form.tipo === "gasto") {
        await axios.post("http://localhost:3000/api/gastos", {
          caminhao_id: parseInt(form.caminhao_id),
          tipo_gasto_id: parseInt(form.tipo_id),
          valor: parseFloat(form.valor),
          data_gasto: form.data,
          descricao: form.observacao,
        });
      } else {
        // tipo === 'manutencao'
        await axios.post("http://localhost:3000/api/checklist", {
          caminhao_id: parseInt(form.caminhao_id),
          item_id: parseInt(form.tipo_id),
          data_manutencao: form.data,
          observacao: form.observacao,
        });
        await axios.post("http://localhost:3000/api/gastos", {
          caminhao_id: parseInt(form.caminhao_id),
          tipo_gasto_id: ID_TIPO_GASTO_MANUTENCAO,
          valor: parseFloat(form.valor),
          data_gasto: form.data,
          descricao: `Manutenção: ${
            itensChecklist.find((item) => item.id === parseInt(form.tipo_id))
              ?.nome_item || ""
          } - ${form.observacao}`,
        });
      }

      const [gastosRes, checklistRes] = await Promise.all([
        axios.get("http://localhost:3000/api/gastos"),
        axios.get("http://localhost:3000/api/checklist"),
      ]);

      const gastosFormatados = gastosRes.data.map((g) => ({
        ...g,
        tipo_registro: "Gasto",
        nome_tipo: g.tipos_gastos?.nome_tipo,
        placa: g.caminhoes?.placa,
        data: g.data_gasto,
        observacao: g.descricao,
      }));

      const checklistFormatados = checklistRes.data.map((c) => ({
        ...c,
        tipo_registro: "Manutenção",
        nome_tipo: c.itens_checklist?.nome_item,
        placa: c.caminhoes?.placa,
        data: c.data_manutencao,
        valor: "N/A",
        observacao: c.observacao,
      }));

      setRegistros(
        [...gastosFormatados, ...checklistFormatados].sort(
          (a, b) => new Date(b.data) - new Date(a.data)
        )
      );

      setForm({
        tipo: "gasto",
        caminhao_id: "",
        tipo_id: "",
        valor: "",
        data: "",
        observacao: "",
      });
      setError(null);
    } catch (err) {
      setError("Erro ao cadastrar registro.");
      console.error(err);
    }
  };

  const handleDelete = async (tipo, id) => {
    if (window.confirm("Tem certeza que deseja deletar este registro?")) {
      try {
        if (tipo === "Manutenção") {
          await axios.delete(`http://localhost:3000/api/checklist/${id}`);
        } else {
          await axios.delete(`http://localhost:3000/api/gastos/${id}`);
        }
        setRegistros(
          registros.filter((r) => !(r.id === id && r.tipo_registro === tipo))
        );
      } catch (err) {
        setError("Erro ao deletar registro.");
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
          Manutenção e Gastos
        </h1>

        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-4">Adicionar Novo Registro</h2>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div>
              <label className="label">Tipo de Registro</label>
              <select
                name="tipo"
                value={form.tipo}
                onChange={handleTipoChange}
                required
                className="input"
              >
                <option value="gasto">Gasto Financeiro</option>
                <option value="manutencao">Manutenção (Checklist)</option>
              </select>
            </div>
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
              <label className="label">
                {form.tipo === "gasto" ? "Tipo de Gasto" : "Item de Manutenção"}
              </label>
              <select
                name="tipo_id"
                value={form.tipo_id}
                onChange={handleChange}
                required
                className="input"
              >
                <option value="">Selecione...</option>
                {form.tipo === "gasto"
                  ? tiposGastos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome_tipo}
                      </option>
                    ))
                  : itensChecklist.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nome_item}
                      </option>
                    ))}
              </select>
            </div>
            <div>
              <label className="label">Valor</label>
              <input
                type="number"
                name="valor"
                value={form.valor}
                onChange={handleChange}
                className="input"
                step="0.01"
                required
              />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="label">Data</label>
              <input
                type="date"
                name="data"
                value={form.data}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            <div className="col-span-1 md:col-span-2">
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
              className="col-span-1 md:col-span-2 btn-primary"
            >
              Cadastrar Registro
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4">Histórico de Registros</h2>
          {registros.length === 0 ? (
            <p className="text-gray-500">Nenhum registro cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-neutral">
                    <th className="py-2 px-4 border-b">Tipo</th>
                    <th className="py-2 px-4 border-b">Placa</th>
                    <th className="py-2 px-4 border-b">Descrição</th>
                    <th className="py-2 px-4 border-b">Observação</th>
                    <th className="py-2 px-4 border-b">Valor</th>
                    <th className="py-2 px-4 border-b">Data</th>
                    <th className="py-2 px-4 border-b">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r) => (
                    <tr
                      key={`${r.tipo_registro}-${r.id}`}
                      className="border-b hover:bg-neutral transition-colors duration-200"
                    >
                      <td className="py-2 px-4 text-center">
                        {r.tipo_registro}
                      </td>
                      <td className="py-2 px-4 text-center">
                        {r.placa || "N/A"}
                      </td>
                      <td className="py-2 px-4 text-center">
                        {r.nome_tipo || "N/A"}
                      </td>
                      <td className="py-2 px-4 text-center">
                        {r.observacao || "N/A"}
                      </td>
                      <td className="py-2 px-4 text-center">
                        {r.valor !== "N/A" ? `R$ ${r.valor}` : r.valor}
                      </td>
                      <td className="py-2 px-4 text-center">{r.data}</td>
                      <td className="py-2 px-4 text-center">
                        <button
                          onClick={() => handleDelete(r.tipo_registro, r.id)}
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

export default ManutencaoGastos;
