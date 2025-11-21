// frontend/src/hooks/useLocalStorage.js
import { useState, useEffect, useCallback } from "react";

export const useLocalStorage = (key, initialValue) => {
  // Função para obter valor do localStorage
  const getStoredValue = useCallback(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Erro ao ler localStorage para chave "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue]);

  const [storedValue, setStoredValue] = useState(getStoredValue);

  // Função para salvar no localStorage
  const setValue = useCallback(
    (value) => {
      try {
        // Permitir que value seja uma função (como no useState)
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;

        setStoredValue(valueToStore);

        if (valueToStore === undefined || valueToStore === null) {
          window.localStorage.removeItem(key);
        } else {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error(
          `Erro ao salvar no localStorage para chave "${key}":`,
          error
        );
      }
    },
    [key, storedValue]
  );

  // Função para remover do localStorage
  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.error(
        `Erro ao remover do localStorage para chave "${key}":`,
        error
      );
    }
  }, [key, initialValue]);

  // Sincronizar com mudanças no localStorage de outras abas
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key) {
        try {
          const newValue = e.newValue ? JSON.parse(e.newValue) : initialValue;
          setStoredValue(newValue);
        } catch (error) {
          console.error(
            `Erro ao sincronizar localStorage para chave "${key}":`,
            error
          );
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
};
