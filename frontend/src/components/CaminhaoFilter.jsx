// frontend/src/components/CaminhaoFilter.jsx
import React from "react";

const CaminhaoFilter = ({ filtro, setFiltro, termoBusca, setTermoBusca }) => {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-8">
      <h2 className="text-xl font-bold text-navy-blue mb-4">Filtrar Frota</h2>
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
        <div className="w-full md:w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filtrar por
          </label>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-blue focus:border-navy-blue transition-colors"
          >
            <option value="placa">Placa</option>
            <option value="motorista">Motorista</option>
            <option value="carreta">Nº Carreta</option>
            <option value="cavalo">Nº Cavalo</option>
          </select>
        </div>
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Termo de busca
          </label>
          <input
            type="text"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            placeholder={`Digite o ${filtro} para buscar...`}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-blue focus:border-navy-blue transition-colors"
          />
        </div>
      </div>
    </div>
  );
};

export default CaminhaoFilter;
