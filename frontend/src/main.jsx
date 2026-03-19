import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { ToastProvider } from "./components/ui/ToastProvider.jsx";

const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ToastProvider>
        <App />
      </ToastProvider>
    </React.StrictMode>
  );
} else {
  console.error("Failed to find the root element.");
}