// src/components/Navbar.jsx
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isActiveLink = (path) => {
    return location.pathname === path;
  };

  const navLinks = [
    {
      path: "/manutencao-gastos",
      label: "Manutenção e Gastos",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      path: "/pneus",
      label: "Controle de Pneus",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
    {
      path: "/pneus/estoque",
      label: "Estoque de Pneus",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M16 3v4M8 3v4" />
        </svg>
      ),
    },
    {
      path: "/cadastro-caminhao",
      label: "Cadastrar Caminhão",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ),
    },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-primary/95 backdrop-blur-md shadow-lg py-2"
          : "bg-primary py-4"
      }`}
    >
      <div className="container mx-auto px-4 md:px-6 flex justify-between items-center">
        {/* Logo */}
        <Link to="/" className="flex items-center group">
          <div className="bg-secondary p-2 rounded-lg mr-3 group-hover:bg-secondary-light transition-colors">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
              />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold text-white tracking-tight">
              ABroto
            </span>
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
              Transportadora
            </span>
          </div>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center space-x-1">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center ${
                isActiveLink(link.path)
                  ? "bg-white/10 text-white shadow-sm backdrop-blur-sm border border-white/10"
                  : "text-gray-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}

          {/* User Profile Placeholder */}
          <div className="ml-4 pl-4 border-l border-gray-700 flex items-center">
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-secondary to-secondary-dark flex items-center justify-center text-white font-bold shadow-md cursor-pointer hover:ring-2 hover:ring-secondary-light transition-all">
              AD
            </div>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-gray-300 hover:text-white focus:outline-none p-2 rounded-md hover:bg-white/10 transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden absolute top-full left-0 right-0 bg-primary border-t border-gray-800 shadow-xl transition-all duration-300 ease-in-out overflow-hidden ${
          isMobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="container mx-auto py-4 px-4 flex flex-col space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`px-4 py-3 rounded-lg transition-all duration-200 flex items-center ${
                isActiveLink(link.path)
                  ? "bg-secondary text-white shadow-md"
                  : "text-gray-300 hover:bg-white/5 hover:text-white"
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
          <div className="pt-4 mt-2 border-t border-gray-800 flex items-center px-4">
            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-white text-sm font-bold mr-3">
              AD
            </div>
            <div className="flex flex-col">
              <span className="text-white text-sm font-medium">Admin User</span>
              <span className="text-gray-500 text-xs">admin@abroto.com</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
