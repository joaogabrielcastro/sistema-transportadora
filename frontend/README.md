# Frontend (ATrack)

SPA React para gestão de frota multi-empresa.

## Ambiente

Crie `frontend/.env` com:

```bash
VITE_API_URL=http://localhost:3020
VITE_AUTH_REQUIRED=true
# VITE_ALLOW_PUBLIC_REGISTER=false
```

## Scripts

- `npm run dev`: inicia ambiente de desenvolvimento.
- `npm run build`: gera build de produção.
- `npm run preview`: serve build localmente.
- `npm run lint`: executa ESLint.
- `npm test`: testes unitários.
- `npm run test:coverage`: cobertura de utils/lib.
- `npm run test:e2e`: Playwright.

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

A normalização de payload fica centralizada em `src/lib/apiClient.ts` e `src/utils/extractApiArray.js`.
