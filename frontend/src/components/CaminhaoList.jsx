// frontend/src/components/CaminhaoList.jsx
import React from "react";
import { Link } from "react-router-dom";
import EmptyState from "./EmptyState";

const CaminhaoList = ({
  caminhoes,
  handleOpenDeleteModal,
  termoBusca,
  filtro,
}) => {
  if (!caminhoes || caminhoes.length === 0) {
    return (
      <EmptyState
        icon="🚛"
        title="Nenhum caminhão encontrado"
        description={
          termoBusca
            ? `Não foram encontrados caminhões com ${filtro} contendo "${termoBusca}"`
            : "Nenhum caminhão cadastrado na frota."
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {[
              "Placa",
              "Motorista",
              "KM Atual",
              "Qtd. Pneus",
              "Carreta 1",
              "Carreta 2",
              "Cavalo",
              "Ações",
            ].map((header) => (
              <th
                key={header}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {caminhoes.map((caminhao) => (
            <tr
              key={caminhao.id}
              className="hover:bg-gray-50 transition-colors"
            >
              <td className="px-6 py-4 font-medium text-gray-900">
                {caminhao.placa}
              </td>
              <td className="px-6 py-4">
                {caminhao.motorista ? (
                  <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                    {caminhao.motorista}
                  </span>
                ) : (
                  <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                    Não definido
                  </span>
                )}
              </td>
              <td className="px-6 py-4 text-gray-600">
                {caminhao.km_atual?.toLocaleString("pt-BR") || 0}
              </td>
              <td className="px-6 py-4">
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                  {caminhao.qtd_pneus}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="px-3 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                  {caminhao.numero_carreta_1 || "-"}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="px-3 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full">
                  {caminhao.numero_carreta_2 || "-"}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                  {caminhao.numero_cavalo || "-"}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex gap-2">
                  <Link
                    to={`/caminhao/editar/${caminhao.placa}`}
                    className="px-3 py-1 rounded-md bg-yellow-100 text-yellow-700 hover:bg-yellow-200 text-sm font-medium"
                  >
                    Editar
                  </Link>
                  <Link
                    to={`/caminhao/${caminhao.placa}`}
                    className="px-3 py-1 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm font-medium"
                  >
                    Detalhes
                  </Link>
                  <button
                    onClick={() => handleOpenDeleteModal(caminhao)}
                    className="px-3 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200 text-sm font-medium"
                  >
                    Excluir
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CaminhaoList;
