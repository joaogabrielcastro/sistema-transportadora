// src/pages/EditGasto.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";

const EditGasto = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caminhaoPlaca, setCaminhaoPlaca] = useState(""); // Novo estado para a placa
  const [formData, setFormData] = useState({
    caminhao_id: "",
    tipo_gasto_id: "",
    valor: "",
    data_gasto: "",
    descricao: "",
  });
  const [tiposGastos, setTiposGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [gastoRes, tiposRes] = await Promise.all([
          axios.get(`https://sistema-transportadora.onrender.com/api/gastos/${id}`),
          axios.get("https://sistema-transportadora.onrender.com/api/tipos-gastos"),
        ]);

        const gastoData = gastoRes.data;
        setCaminhaoPlaca(gastoData.caminhoes.placa); // Salva a placa do caminhão

        setFormData({
          caminhao_id: gastoData.caminhao_id,
          tipo_gasto_id: gastoData.tipo_gasto_id,
          valor: gastoData.valor,
          data_gasto: gastoData.data_gasto,
          descricao: gastoData.descricao || "",
        });
        setTiposGastos(tiposRes.data);
      } catch (err) {
        setError("Erro ao carregar dados do gasto ou tipos de gastos.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`https://sistema-transportadora.onrender.com/api/gastos/${id}`, formData);
      alert("Gasto atualizado com sucesso!");
      navigate(`/caminhao/${caminhaoPlaca}`); // Usa a placa para navegar
    } catch (err) {
      setError("Erro ao atualizar o gasto.");
      console.error(err);
    }
  };

  if (loading) return <div className="text-center mt-10">Carregando...</div>;
  if (error)
    return <div className="text-center mt-10 text-accent">{error}</div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral">
      <div className="card w-full max-w-md">
        <Link
          to={`/caminhao/${caminhaoPlaca}`}
          className="btn-secondary mb-4 inline-block"
        >
          ← Voltar
        </Link>
        <h1 className="text-2xl font-bold mb-6 text-center">Editar Gasto</h1>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="label" htmlFor="tipoGasto">
              Tipo de Gasto
            </label>
            <select
              id="tipoGasto"
              name="tipo_gasto_id"
              value={formData.tipo_gasto_id}
              onChange={handleChange}
              className="input"
              required
            >
              <option value="">Selecione...</option>
              {tiposGastos.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nome_tipo}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="label" htmlFor="valor">
              Valor
            </label>
            <input
              type="number"
              id="valor"
              name="valor"
              value={formData.valor}
              onChange={handleChange}
              className="input"
              step="0.01"
              required
            />
          </div>
          <div className="mb-4">
            <label className="label" htmlFor="dataGasto">
              Data do Gasto
            </label>
            <input
              type="date"
              id="dataGasto"
              name="data_gasto"
              value={formData.data_gasto}
              onChange={handleChange}
              className="input"
              required
            />
          </div>
          <div className="mb-6">
            <label className="label" htmlFor="descricao">
              Observações
            </label>
            <textarea
              id="descricao"
              name="descricao"
              value={formData.descricao}
              onChange={handleChange}
              className="input"
            ></textarea>
          </div>
          <button type="submit" className="w-full btn-primary">
            Salvar Alterações
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditGasto;
