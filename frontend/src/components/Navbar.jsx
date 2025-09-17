// src/components/Navbar.jsx
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActiveLink = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="bg-gradient-to-r from-blue-800 to-indigo-900 p-4 shadow-xl relative">
      <div className="container mx-auto flex justify-between items-center">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center text-2xl font-bold text-white hover:text-blue-200 transition-colors duration-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Transportadora
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex space-x-2">
          <Link
            to="/manutencao-gastos"
            className={`px-4 py-2 rounded-lg transition-all duration-300 flex items-center ${
              isActiveLink("/manutencao-gastos")
                ? "bg-white text-blue-800 shadow-md font-semibold"
                : "text-white hover:bg-blue-700 hover:shadow-md"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Manutenção e Gastos
          </Link>
          <Link
            to="/pneus"
            className={`px-4 py-2 rounded-lg transition-all duration-300 flex items-center ${
              isActiveLink("/pneus")
                ? "bg-white text-blue-800 shadow-md font-semibold"
                : "text-white hover:bg-blue-700 hover:shadow-md"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Controle de Pneus
          </Link>
          <Link
            to="/cadastro-caminhao"
            className={`px-4 py-2 rounded-lg transition-all duration-300 flex items-center ${
              isActiveLink("/cadastro-caminhao")
                ? "bg-white text-blue-800 shadow-md font-semibold"
                : "text-white hover:bg-blue-700 hover:shadow-md"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Cadastrar Caminhão
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-white focus:outline-none"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-blue-800 shadow-lg rounded-b-lg absolute top-full left-0 right-0 z-50">
          <div className="container mx-auto py-4 px-6 flex flex-col space-y-3">
            <Link
              to="/manutencao-gastos"
              className={`px-4 py-3 rounded-lg transition-all duration-300 flex items-center ${
                isActiveLink("/manutencao-gastos")
                  ? "bg-white text-blue-800 shadow-md font-semibold"
                  : "text-white hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Manutenção e Gastos
            </Link>
            <Link
              to="/pneus"
              className={`px-4 py-3 rounded-lg transition-all duration-300 flex items-center ${
                isActiveLink("/pneus")
                  ? "bg-white text-blue-800 shadow-md font-semibold"
                  : "text-white hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Controle de Pneus
            </Link>
            <Link
              to="/cadastro-caminhao"
              className={`px-4 py-3 rounded-lg transition-all duration-300 flex items-center ${
                isActiveLink("/cadastro-caminhao")
                  ? "bg-white text-blue-800 shadow-md font-semibold"
                  : "text-white hover:bg-blue-700 hover:shadow-md"
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Cadastrar Caminhão
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;