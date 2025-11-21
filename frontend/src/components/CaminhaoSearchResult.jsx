// src/components/CaminhaoSearchResult.jsx
import React from "react";
import { Link } from "react-router-dom";

const CaminhaoSearchResult = ({ results, loading, error }) => {
  if (loading) {
    return (
      <div className="text-center p-4">
        <p className="text-gray-500">Buscando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4 bg-red-50 rounded-lg">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center p-4">
        <p className="text-gray-500">Nenhum caminhão encontrado.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 bg-white rounded-xl shadow-md overflow-hidden">
      <ul className="divide-y divide-gray-200">
        {results.map((caminhao) => (
          <li key={caminhao.id} className="hover:bg-gray-50 transition-colors">
            <Link to={`/caminhao/${caminhao.placa}`} className="block p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-blue-600 text-lg">
                    {caminhao.placa}
                  </p>
                  <p className="text-sm text-gray-600">
                    {caminhao.motorista || "Motorista não definido"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">KM Atual</p>
                  <p className="font-medium text-gray-800">
                    {caminhao.km_atual.toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CaminhaoSearchResult;
