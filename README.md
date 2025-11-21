# 🚛 Sistema de Gestão para Transportadora ABroto

Sistema completo de gestão de frotas desenvolvido especificamente para a transportadora ABroto. A aplicação oferece controle total sobre caminhões, gastos operacionais, manutenções preventivas/corretivas e gerenciamento detalhado de pneus, com dashboards analíticos e relatórios em tempo real.

## 🏗️ **Arquitetura do Sistema**

**Backend (API RESTful)**

- Node.js + Express + Supabase (PostgreSQL)
- Validação robusta com Zod
- Arquitetura MVC organizada

**Frontend (SPA React)**

- React 18 + Vite + Tailwind CSS
- Hooks customizados e gerenciamento de estado
- Interface responsiva e moderna

---

## 🎯 **Funcionalidades Completas**

### **📊 Dashboard Executivo**

- **Estatísticas em Tempo Real**: Total de caminhões, gastos acumulados, médias operacionais
- **Gráficos Dinâmicos**: Evolução de gastos mensais, análise de custos por categoria
- **Indicadores de Performance**: Métricas de eficiência da frota
- **Visão Consolidada**: Overview completo do status operacional

### **🚛 Gestão de Caminhões**

- **Cadastro Completo**: Placa, motorista, KM atual, quantidade de pneus
- **Controle de Carretas**: Números e placas de carreta 1 e 2
- **Número do Cavalo**: Identificação única do veículo
- **Busca Avançada**: Por placa, motorista, número do cavalo ou carreta
- **Edição e Exclusão**: Gerenciamento completo do ciclo de vida

### **💰 Controle Financeiro**

- **Tipos de Gastos**: Combustível, manutenção, pedágio, multas, etc.
- **Registro Detalhado**: Data, valor, descrição, categoria
- **Associação por Caminhão**: Rastreamento de custos por veículo
- **Relatórios Financeiros**: Análise de gastos por período e categoria

### **🔧 Manutenção Preventiva**

- **Checklists Personalizados**: Itens de verificação configuráveis
- **Histórico de Manutenções**: Registro completo de todas as verificações
- **Status de Conformidade**: Identificação de itens em não conformidade
- **Agendamento**: Controle de próximas manutenções

### **🛞 Gerenciamento de Pneus**

- **Controle por Posição**: Dianteiro esquerdo/direito, traseiro interno/externo
- **Status Detalhado**: Novo, usado, recapado, descartado
- **Histórico de Rodízio**: Rastreamento de movimentações
- **Vida Útil**: Controle de quilometragem e desgaste

### **🔍 Sistema de Busca e Filtros**

- **Busca Inteligente**: Múltiplos critérios simultâneos
- **Filtros Avançados**: Por data, status, categoria, motorista
- **Paginação Otimizada**: Carregamento eficiente de grandes volumes
- **Export de Dados**: Relatórios exportáveis

---

## 🛠️ **Stack Tecnológica**

### **Backend (API)**

| Tecnologia   | Versão | Finalidade                             |
| ------------ | ------ | -------------------------------------- |
| **Node.js**  | 18+    | Runtime JavaScript server-side         |
| **Express**  | 4.x    | Framework web RESTful                  |
| **Supabase** | Latest | Database PostgreSQL + Auth + APIs      |
| **Zod**      | 3.x    | Validação de schemas TypeScript-first  |
| **CORS**     | Latest | Cross-Origin Resource Sharing          |
| **Dotenv**   | Latest | Gerenciamento de variáveis de ambiente |

### **Frontend (SPA)**

| Tecnologia       | Versão | Finalidade                           |
| ---------------- | ------ | ------------------------------------ |
| **React**        | 18.x   | Biblioteca UI declarativa            |
| **Vite**         | 5.x    | Build tool e dev server ultra-rápido |
| **React Router** | 6.x    | Roteamento client-side               |
| **Axios**        | Latest | Cliente HTTP com interceptors        |
| **Tailwind CSS** | 3.x    | Framework CSS utility-first          |
| **Chart.js**     | 4.x    | Biblioteca de gráficos interativos   |
| **ESLint**       | 8.x    | Linting e padronização de código     |

### **Database Schema (Supabase)**

```sql
-- Tabelas principais do sistema
├── caminhoes (id, placa, motorista, km_atual, qtd_pneus, numero_cavalo, numero_carreta_1, placa_carreta_1, numero_carreta_2, placa_carreta_2)
├── gastos (id, caminhao_id, tipo_gasto_id, valor, data_gasto, descricao)
├── checklist (id, caminhao_id, data_checklist, observacoes)
├── pneus (id, caminhao_id, posicao_id, status_id, data_instalacao)
├── tipos_gastos (id, nome, descricao)
├── itens_checklist (id, nome, obrigatorio)
├── posicoes_pneus (id, posicao, descricao)
└── status_pneus (id, status, descricao)
```

---

## 🚀 **Guia de Instalação**

### **📋 Pré-requisitos**

- [Node.js](https://nodejs.org/) ≥ 18.x
- [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/)
- Conta [Supabase](https://supabase.com/) (gratuita)
- Git para clonagem do repositório

### **⚙️ Configuração do Banco (Supabase)**

1. **Criar Projeto no Supabase**

   - Acesse [supabase.com](https://supabase.com)
   - Crie um novo projeto
   - Anote a URL e as chaves de acesso

2. **Executar SQL de Criação das Tabelas**
   ```sql
   -- Adicionar as colunas necessárias na tabela caminhoes
   ALTER TABLE caminhoes
   ADD COLUMN IF NOT EXISTS placa_carreta_1 VARCHAR,
   ADD COLUMN IF NOT EXISTS placa_carreta_2 VARCHAR;
   ```

### **🔧 Configuração das Variáveis de Ambiente**

**Backend (.env)**

```bash
# Configuração do Supabase
SUPABASE_URL="https://seu-projeto.supabase.co"
SUPABASE_ANON_KEY="sua_chave_anonima_aqui"
SUPABASE_SERVICE_KEY="sua_chave_de_servico_aqui"

# Configuração do servidor
PORT=3000
NODE_ENV=development
```

**Frontend (.env)**

```bash
# URL da API Backend
VITE_API_URL="http://localhost:3000/api"

# Configuração de desenvolvimento
VITE_NODE_ENV=development
```

### **💻 Instalação e Execução**

**1. Clone o Repositório**

```bash
git clone https://github.com/joaogabrielcastro/sistema-transportadora.git
cd sistema-transportadora
```

**2. Configurar Backend**

```bash
# Navegar para o backend
cd backend

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais do Supabase

# Iniciar servidor de desenvolvimento
npm run dev
```

🌐 **Backend rodando em:** `http://localhost:3000`

**3. Configurar Frontend**

```bash
# Em outro terminal, navegar para o frontend
cd frontend

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com a URL do backend

# Iniciar servidor de desenvolvimento
npm run dev
```

🌐 **Frontend rodando em:** `http://localhost:5173`

### **🔄 Scripts Disponíveis**

**Backend**

- `npm run dev` - Servidor de desenvolvimento com hot reload
- `npm start` - Servidor de produção
- `npm run lint` - Verificação de código

**Frontend**

- `npm run dev` - Servidor de desenvolvimento
- `npm run build` - Build de produção
- `npm run preview` - Preview do build
- `npm run lint` - Verificação de código

---

## 📂 **Estrutura do Projeto**

```
sistema-transportadora/
├── 📁 backend/                    # API RESTful Node.js
│   ├── 📁 src/
│   │   ├── 📄 app.js              # Configuração Express + Middlewares
│   │   ├── 📄 server.js           # Ponto de entrada do servidor
│   │   ├── 📁 config/
│   │   │   └── 📄 supabase.js     # Configuração cliente Supabase
│   │   ├── 📁 controllers/        # Lógica de negócio
│   │   │   ├── 📄 caminhoesController.js
│   │   │   ├── 📄 gastosController.js
│   │   │   ├── 📄 checklistController.js
│   │   │   └── 📄 pneusController.js
│   │   ├── 📁 models/             # Acesso ao banco de dados
│   │   │   ├── 📄 caminhoesModel.js
│   │   │   ├── 📄 gastosModel.js
│   │   │   └── 📄 pneusModel.js
│   │   ├── 📁 routes/             # Definição de rotas
│   │   │   └── 📄 *.Routes.js
│   │   └── 📁 schemas/            # Validação Zod
│   │       └── 📄 caminhaoSchema.js
│   ├── 📄 .env.example           # Template variáveis ambiente
│   └── 📄 package.json           # Dependências backend
│
├── 📁 frontend/                   # SPA React + Vite
│   ├── 📁 public/                # Assets estáticos
│   │   └── 📄 abrotto-*.png      # Ícones PWA
│   ├── 📁 src/
│   │   ├── 📄 App.jsx            # Componente raiz + Rotas
│   │   ├── 📄 main.jsx           # Ponto entrada React
│   │   ├── 📁 components/        # Componentes reutilizáveis
│   │   │   ├── 📄 Navbar.jsx     # Navegação principal
│   │   │   └── 📄 ConfirmModal.jsx
│   │   ├── 📁 Pages/             # Páginas/Views
│   │   │   ├── 📄 Home.jsx       # Dashboard principal
│   │   │   ├── 📄 CadastroCaminhao.jsx
│   │   │   ├── 📄 ManutencaoGastos.jsx
│   │   │   └── 📄 Pneus.jsx
│   │   └── 📁 hooks/             # Hooks customizados
│   │       └── 📄 useApi.js      # Cliente HTTP centralizado
│   ├── 📄 .env.example          # Template variáveis ambiente
│   ├── 📄 vite.config.js        # Configuração Vite
│   └── 📄 package.json          # Dependências frontend
│
└── 📄 README.md                  # Documentação do projeto
```

---

## 🌐 **API Endpoints**

### **🚛 Caminhões**

```http
GET    /api/caminhoes              # Lista todos com paginação
GET    /api/caminhoes?search=ABC   # Busca por placa/motorista
GET    /api/caminhoes/:placa       # Detalhes específicos
POST   /api/caminhoes              # Cadastrar novo
PUT    /api/caminhoes/:placa       # Atualizar existente
DELETE /api/caminhoes/:placa       # Remover caminhão
```

### **💰 Gastos**

```http
GET    /api/gastos                 # Lista todos os gastos
GET    /api/gastos/:id             # Detalhes específicos
POST   /api/gastos                 # Registrar novo gasto
PUT    /api/gastos/:id             # Atualizar gasto
DELETE /api/gastos/:id             # Remover gasto
```

### **🔧 Manutenção**

```http
GET    /api/checklist             # Lista checklists
GET    /api/checklist/:id         # Detalhes checklist
POST   /api/checklist             # Criar checklist
PUT    /api/checklist/:id         # Atualizar checklist
```

### **🛞 Pneus**

```http
GET    /api/pneus                 # Lista todos os pneus
GET    /api/pneus/:id             # Detalhes específicos
POST   /api/pneus                 # Cadastrar pneu
PUT    /api/pneus/:id             # Atualizar pneu
```

### **📊 Relatórios**

```http
GET    /api/estatisticas          # Dashboard estatísticas
GET    /api/relatorios/gastos     # Relatório financeiro
GET    /api/relatorios/manutencao # Relatório manutenção
```

---

## 🔥 **Features em Destaque**

### **🎯 Dashboard Inteligente**

- **Cards Estatísticos**: Total de caminhões, gastos, média por veículo
- **Gráficos Interativos**: Chart.js com análise temporal
- **Indicadores KPI**: Performance da frota em tempo real
- **Filtros Dinâmicos**: Por período, motorista, tipo de gasto

### **🔍 Busca Avançada**

- **Multi-critério**: Placa, motorista, número cavalo/carreta
- **Autocomplete**: Sugestões em tempo real
- **Filtros Combinados**: Data + categoria + status
- **Paginação Inteligente**: Carregamento sob demanda

### **📱 Interface Responsiva**

- **Mobile-First**: Otimizado para dispositivos móveis
- **PWA Ready**: Ícones e manifesto configurados
- **Tailwind CSS**: Design system consistente
- **UX Moderna**: Micro-interações e feedback visual

### **🔐 Validação Robusta**

- **Zod Schemas**: Validação TypeScript-first
- **Sanitização**: Limpeza automática de dados
- **Error Handling**: Tratamento centralizado de erros
- **Feedback**: Mensagens claras para o usuário

---

## 🚀 **Deploy e Produção**

### **Backend (Supabase + Vercel/Railway)**

```bash
# Build de produção
npm run build

# Variáveis de ambiente necessárias
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_anonima
NODE_ENV=production
```

### **Frontend (Vercel/Netlify)**

```bash
# Build otimizado
npm run build

# Variáveis de ambiente
VITE_API_URL=https://sua-api.com/api
VITE_NODE_ENV=production
```

---

## 🤝 **Contribuição**

1. **Fork** o projeto
2. **Clone** sua fork
3. **Crie** uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
4. **Commit** suas mudanças (`git commit -m 'Add: nova funcionalidade'`)
5. **Push** para a branch (`git push origin feature/nova-funcionalidade`)
6. **Abra** um Pull Request

### **📋 Padrões de Código**

- **ESLint**: Configuração padronizada
- **Commits**: Conventional commits (feat, fix, docs, etc.)
- **Branches**: feature/, bugfix/, hotfix/
- **Code Review**: Obrigatório antes do merge

---

## 📝 **Changelog**

### **v1.0.0** (2025-11-17)

- ✅ Sistema completo de gestão de caminhões
- ✅ Dashboard com estatísticas em tempo real
- ✅ CRUD completo para todas as entidades
- ✅ Sistema de busca e filtros avançados
- ✅ Validação robusta com Zod
- ✅ Interface responsiva com Tailwind CSS
- ✅ Integração completa com Supabase

---

## 📞 **Suporte**

### **🐛 Reportar Bugs**

- **Issues**: Use o GitHub Issues para reportar problemas
- **Template**: Siga o template de bug report
- **Logs**: Inclua logs relevantes e passos para reproduzir

### **💡 Sugestões**

- **Feature Requests**: Use o GitHub Issues com label "enhancement"
- **Discussões**: GitHub Discussions para ideias e melhorias
- **Roadmap**: Consulte o projeto para próximas funcionalidades

### **📚 Documentação**

- **API Docs**: Documentação completa dos endpoints
- **Components**: Storybook com todos os componentes
- **Database**: Schema completo no Supabase

---

## 📄 **Licença**

Este projeto está licenciado sob a **MIT License** - veja o arquivo [LICENSE.md](LICENSE.md) para detalhes.


<div align="center">

**⭐ Deixe uma estrela se este projeto foi útil!**

**🚛 Desenvolvido com ❤️ para a Transportadora ABroto**

![GitHub stars](https://img.shields.io/github/stars/joaogabrielcastro/sistema-transportadora?style=social)
![GitHub forks](https://img.shields.io/github/forks/joaogabrielcastro/sistema-transportadora?style=social)

</div>
