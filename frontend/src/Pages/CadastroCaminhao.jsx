// src/pages/CadastroCaminhao.jsx
import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

const CadastroCaminhao = () => {
  const [placa, setPlaca] = useState("");
  const [qtdPneus, setQtdPneus] = useState(0);
  const [kmAtual, setKmAtual] = useState(0);
  const [numeroCarreta, setNumeroCarreta] = useState("");
  const [numeroCavalo, setNumeroCavalo] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const navigate = useNavigate(); 

  const API_URL = import.meta.env.VITE_API_URL;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/caminhoes`, {
        placa,
        qtd_pneus: parseInt(qtdPneus),
        km_atual: parseInt(kmAtual),
        numero_carreta: numeroCarreta ? parseInt(numeroCarreta) : null,
        numero_cavalo: numeroCavalo ? parseInt(numeroCavalo) : null,
      });
      setSuccess("Caminhão cadastrado com sucesso!");
      setError(null);
      setPlaca("");
      setQtdPneus(0);
      setKmAtual(0);
      setNumeroCarreta("");
      setNumeroCavalo("");
    } catch (err) {
      setError(
        "Erro ao cadastrar caminhão. Verifique os dados e tente novamente."
      );
      setSuccess(null);
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Cadastro de Caminhão
        </h1>

        {success && (
          <div className="bg-secondary text-white p-3 mb-4 rounded">
            {success}
          </div>
        )}
        {error && (
          <div className="bg-accent text-white p-3 mb-4 rounded">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="label" htmlFor="placa">
              Placa
            </label>
            <input
              type="text"
              id="placa"
              value={placa}
              onChange={(e) => setPlaca(e.target.value)}
              className="input"
              required
            />
          </div>

          <div className="mb-4">
            <label className="label" htmlFor="qtdPneus">
              Quantidade de Pneus
            </label>
            <input
              type="number"
              id="qtdPneus"
              value={qtdPneus}
              onChange={(e) => setQtdPneus(e.target.value)}
              className="input"
              required
            />
          </div>

          <div className="mb-4">
            <label className="label" htmlFor="kmAtual">
              KM Atual
            </label>
            <input
              type="number"
              id="kmAtual"
              value={kmAtual}
              onChange={(e) => setKmAtual(e.target.value)}
              className="input"
              required
            />
          </div>

          <div className="mb-4">
            <label className="label" htmlFor="numeroCarreta">
              Número da Carreta (0-100)
            </label>
            <input
              type="number"
              id="numeroCarreta"
              value={numeroCarreta}
              onChange={(e) => setNumeroCarreta(e.target.value)}
              className="input"
              min="0"
              max="100"
              placeholder="Opcional - apenas para carretas"
            />
          </div>

          <div className="mb-6">
            <label className="label" htmlFor="numeroCavalo">
              Número do Cavalo (101+)
            </label>
            <input
              type="number"
              id="numeroCavalo"
              value={numeroCavalo}
              onChange={(e) => setNumeroCavalo(e.target.value)}
              className="input"
              min="101"
              placeholder="Opcional - apenas para cavalos"
            />
          </div>

          <button type="submit" className="w-full btn-primary">
            Cadastrar
          </button>
        </form>
      </div>
    </div>
  );
};

export default CadastroCaminhao;