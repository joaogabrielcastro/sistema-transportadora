import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

const ManutencaoGastos = () => {
  const [caminhoes, setCaminhoes] = useState([]);
  const [itensChecklist, setItensChecklist] = useState([]);
  const [tiposGastos, setTiposGastos] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [registrosFiltrados, setRegistrosFiltrados] = useState([]);
  const [filtroPlaca, setFiltroPlaca] = useState("");
  const [form, setForm] = useState({
    tipo: "gasto",
    caminhao_id: "",
    tipo_id: "",
    valor: "",
    data: "",
    observacao: "",
    oficina: "",
    km_registro: "",
    quantidade_combustivel: "",
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState("");

  const ID_TIPO_GASTO_MANUTENCAO = 10;
  const ID_TIPO_GASTO_COMBUSTIVEL = 9;

  const fetchData = async () => {
    try {
      const [caminhoesRes, itensRes, tiposRes, gastosRes, checklistRes] =
        await Promise.all([
          axios.get(`${API_URL}/api/caminhoes`),
          axios.get(`${API_URL}/api/itens-checklist`),
          axios.get(`${API_URL}/api/tipos-gastos`),
          axios.get(`${API_URL}/api/gastos`),
          axios.get(`${API_URL}/api/checklist`),
        ]);

      const gastosFormatados = gastosRes.data.map((g) => ({
        ...g,
        tipo_registro: "Gasto",
        nome_tipo: g.tipos_gastos?.nome_tipo,
        placa: g.caminhoes?.placa,
        data: g.data_gasto,
        observacao: g.descricao,
        oficina: "N/A",
        km_registro: g.km_registro || "N/A",
        quantidade_combustivel: g.quantidade_combustivel || "N/A",
      }));

      const checklistFormatados = checklistRes.data.map((c) => ({
        ...c,
        tipo_registro: "Manutenção",
        nome_tipo: c.itens_checklist?.nome_item,
        placa: c.caminhoes?.placa,
        data: c.data_manutencao,
        valor: "N/A",
        observacao: c.observacao,
        oficina: c.oficina || "N/A",
        km_registro: "N/A",
        quantidade_combustivel: "N/A",
      }));

      setCaminhoes(caminhoesRes.data);
      setItensChecklist(itensRes.data);
      setTiposGastos(tiposRes.data);
      
      const todosRegistros = [...gastosFormatados, ...checklistFormatados].sort(
        (a, b) => new Date(b.data) - new Date(a.data)
      );
      
      setRegistros(todosRegistros);
      setRegistrosFiltrados(todosRegistros);
    } catch (err) {
      setError("Erro ao carregar dados. Verifique a conexão com o backend.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtro por placa
  useEffect(() => {
    if (filtroPlaca) {
      const filtered = registros.filter(registro => 
        registro.placa && registro.placa.toLowerCase().includes(filtroPlaca.toLowerCase())
      );
      setRegistrosFiltrados(filtered);
    } else {
      setRegistrosFiltrados(registros);
    }
  }, [filtroPlaca, registros]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCaminhaoChange = (e) => {
    const caminhaoId = e.target.value;
    const caminhaoSelecionado = caminhoes.find(
      (c) => c.id === parseInt(caminhaoId)
    );
    setForm((prevForm) => ({
      ...prevForm,
      caminhao_id: caminhaoId,
      km_registro: caminhaoSelecionado ? caminhaoSelecionado.km_atual : "",
    }));
  };

  const handleTipoChange = (e) => {
    const newTipo = e.target.value;
    setForm((prevForm) => ({
      ...prevForm,
      tipo: newTipo,
      tipo_id: "",
      valor: "",
      observacao: "",
      oficina: "",
      quantidade_combustivel: "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const caminhaoId = parseInt(form.caminhao_id);
      const newKm = form.km_registro ? parseInt(form.km_registro, 10) : null;

      if (form.tipo === "gasto") {
        const payload = {
          caminhao_id: caminhaoId,
          tipo_gasto_id: parseInt(form.tipo_id),
          valor: parseFloat(form.valor),
          data_gasto: form.data,
          descricao: form.observacao,
          km_registro: newKm,
          quantidade_combustivel: form.quantidade_combustivel
            ? parseFloat(form.quantidade_combustivel)
            : null,
        };
        await axios.post(`${API_URL}/api/gastos`, payload);
      } else {
        await axios.post(`${API_URL}/api/checklist`, {
          caminhao_id: caminhaoId,
          item_id: parseInt(form.tipo_id),
          data_manutencao: form.data,
          observacao: form.observacao,
          oficina: form.oficina,
        });
        await axios.post(`${API_URL}/api/gastos`, {
          caminhao_id: caminhaoId,
          tipo_gasto_id: ID_TIPO_GASTO_MANUTENCAO,
          valor: parseFloat(form.valor),
          data_gasto: form.data,
          descricao: `Manutenção: ${
            itensChecklist.find((item) => item.id === parseInt(form.tipo_id))
              ?.nome_item || ""
          } - ${form.observacao}`,
          km_registro: newKm,
        });
      }

      if (newKm !== null) {
        const caminhaoParaAtualizar = caminhoes.find(c => c.id === caminhaoId);
        if (caminhaoParaAtualizar && newKm > caminhaoParaAtualizar.km_atual) {
          await axios.put(`${API_URL}/api/caminhoes/${caminhaoId}`, {
            km_atual: newKm,
          });
        }
      }

      fetchData();

      setForm({
        tipo: "gasto",
        caminhao_id: "",
        tipo_id: "",
        valor: "",
        data: "",
        observacao: "",
        oficina: "",
        km_registro: "",
        quantidade_combustivel: "",
      });
      
      setError(null);
      setSuccessMessage("Registro cadastrado com sucesso!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError("Erro ao cadastrar registro.");
      console.error(err);
    }
  };

  const handleDelete = async (tipo, id) => {
    if (window.confirm("Tem certeza que deseja deletar este registro?")) {
      try {
        if (tipo === "Manutenção") {
          await axios.delete(`${API_URL}/api/checklist/${id}`);
        } else {
          await axios.delete(`${API_URL}/api/gastos/${id}`);
        }
        setRegistros(
          registros.filter((r) => !(r.id === id && r.tipo_registro === tipo))
        );
        setSuccessMessage("Registro deletado com sucesso!");
        setTimeout(() => setSuccessMessage(""), 3000);
      } catch (err) {
        setError("Erro ao deletar registro.");
        console.error(err);
      }
    }
  };

  const formatarValor = (valor) => {
    if (valor === "N/A") return "N/A";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const formatarData = (dataString) => {
    if (!dataString) return "N/A";
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR');
  };

  if (loading) return <div className="text-center mt-10 text-xl">Carregando...</div>;
  if (error) return <div className="text-center mt-10 text-xl text-red-600">{error}</div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center text-navy-blue">
          Manutenção e Gastos
        </h1>

        {/* Mensagens de feedback */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {successMessage}
          </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-bold mb-4 text-navy-blue">Adicionar Novo Registro</h2>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Registro</label>
              <select
                name="tipo"
                value={form.tipo}
                onChange={handleTipoChange}
                required
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-blue focus:border-transparent"
              >
                <option value="gasto">Gasto Financeiro</option>
                <option value="manutencao">Manutenção (Checklist)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Caminhão</label>
              <select
                name="caminhao_id"
                value={form.caminhao_id}
                onChange={handleCaminhaoChange}
                required
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-blue focus:border-transparent"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {form.tipo === "gasto" ? "Tipo de Gasto" : "Item de Manutenção"}
              </label>
              <select
                name="tipo_id"
                value={form.tipo_id}
                onChange={handleChange}
                required
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-blue focus:border-transparent"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
              <input
                type="number"
                name="valor"
                value={form.valor}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-blue focus:border-transparent"
                step="0.01"
                required
              />
            </div>
            {form.tipo === "manutencao" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Oficina</label>
                <input
                  type="text"
                  name="oficina"
                  value={form.oficina}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-blue focus:border-transparent"
                />
              </div>
            )}
            {form.tipo === "gasto" &&
              form.tipo_id == ID_TIPO_GASTO_COMBUSTIVEL && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade (Litros)</label>
                  <input
                    type="number"
                    name="quantidade_combustivel"
                    value={form.quantidade_combustivel}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-blue focus:border-transparent"
                    step="0.01"
                    required
                  />
                </div>
              )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input
                type="date"
                name="data"
                value={form.data}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-blue focus:border-transparent"
                required
              />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
              <textarea
                name="observacao"
                value={form.observacao}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-blue focus:border-transparent"
                rows="2"
              ></textarea>
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Quilometragem (KM)</label>
              <input
                type="number"
                name="km_registro"
                value={form.km_registro}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-blue focus:border-transparent"
              />
            </div>
            <div className="col-span-1 md:col-span-3 flex justify-end">
              <button
                type="submit"
                className="bg-navy-blue text-white px-6 py-2 rounded-md hover:bg-blue-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                Cadastrar Registro
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
            <h2 className="text-xl font-bold text-navy-blue mb-2 md:mb-0">Histórico de Registros</h2>
            <div className="w-full md:w-64">
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar por placa:</label>
              <input
                type="text"
                placeholder="Digite a placa..."
                value={filtroPlaca}
                onChange={(e) => setFiltroPlaca(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-blue focus:border-transparent"
              />
            </div>
          </div>
          
          {registrosFiltrados.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nenhum registro encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-navy-blue text-white">
                    <th className="py-3 px-4 border-b text-left">Tipo</th>
                    <th className="py-3 px-4 border-b text-left">Placa</th>
                    <th className="py-3 px-4 border-b text-left">Descrição</th>
                    <th className="py-3 px-4 border-b text-left">Oficina</th>
                    <th className="py-3 px-4 border-b text-left">Valor</th>
                    <th className="py-3 px-4 border-b text-left">Data</th>
                    <th className="py-3 px-4 border-b text-left">KM</th>
                    <th className="py-3 px-4 border-b text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.map((r) => (
                    <tr
                      key={`${r.tipo_registro}-${r.id}`}
                      className="border-b hover:bg-gray-50 transition-colors duration-200"
                    >
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                          r.tipo_registro === "Gasto" 
                            ? "bg-blue-100 text-blue-800" 
                            : "bg-green-100 text-green-800"
                        }`}>
                          {r.tipo_registro}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium">{r.placa || "N/A"}</td>
                      <td className="py-3 px-4">{r.nome_tipo || "N/A"}</td>
                      <td className="py-3 px-4">{r.oficina || "N/A"}</td>
                      <td className="py-3 px-4 font-semibold text-lg">
                        {r.valor !== "N/A" ? formatarValor(r.valor) : r.valor}
                      </td>
                      <td className="py-3 px-4">{formatarData(r.data)}</td>
                      <td className="py-3 px-4 font-medium">
                        {r.km_registro !== "N/A" ? parseInt(r.km_registro).toLocaleString('pt-BR') : "N/A"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDelete(r.tipo_registro, r.id)}
                          className="text-red-600 hover:text-red-800 transition-colors duration-200"
                          title="Deletar registro"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
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

      <style jsx>{`
        .text-navy-blue {
          color: #003366;
        }
        .bg-navy-blue {
          background-color: #003366;
        }
        .hover\:bg-blue-800:hover {
          background-color: #00264d;
        }
      `}</style>
    </div>
  );
};

export default ManutencaoGastos;