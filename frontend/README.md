# Frontend

SPA React para gestão de frota.

## Ambiente

Crie `frontend/.env` com:

```bash
VITE_API_URL=http://localhost:3000
```

## Scripts

- `npm run dev`: inicia ambiente de desenvolvimento.
- `npm run build`: gera build de produção.
- `npm run preview`: serve build localmente.
- `npm run lint`: executa ESLint.

## Contrato de API

O frontend espera respostas no formato:

```json
{
  "success": true,
  "data": {},
  "message": "Opcional",
  "pagination": { "optional": true }
}
```

A normalização de payload fica centralizada em `src/hooks/useApi.js`.
