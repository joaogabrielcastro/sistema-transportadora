// src/components/Navbar.jsx
import React from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <nav className="bg-primary p-4 shadow-md text-white">
      <div className="container mx-auto flex justify-between items-center">
        <Link
          to="/"
          className="text-2xl font-bold hover:text-gray-200 transition-colors duration-200"
        >
          Transportadora
        </Link>
        <div className="space-x-4">
          <Link
            to="/manutencao-gastos"
            className="hover:text-gray-200 transition-colors duration-200"
          >
            Manutenção e Gastos
          </Link>
          <Link
            to="/pneus"
            className="hover:text-gray-200 transition-colors duration-200"
          >
            Controle de Pneus
          </Link>
          <Link
            to="/cadastro-caminhao"
            className="hover:text-gray-200 transition-colors duration-200"
          >
            Cadastrar Caminhão
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
