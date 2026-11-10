# Formaria - Formulários Inteligentes

Interface completa inspirada no Typeform com recursos liberados e suporte ao construtor de formulários, fluxo de pesquisa e integração com lógica condicional.

## 🚀 Como Rodar Localmente

1. Entre na pasta do aplicativo:
   ```bash
   cd app
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

4. Para gerar o build de produção:
   ```bash
   npm run build
   ```

## 🌐 Deploy na Vercel

O projeto está configurado com `vercel.json` para suportar roteamento de SPA (Single Page Application) sem erros 404 ao atualizar páginas.

Ao vincular o repositório à Vercel:
- **Framework Preset**: Vite
- **Root Directory**: `app` (ou raiz `.`)
- **Build Command**: `vite build && node scripts/routes.mjs`
- **Output Directory**: `dist`
