# Confere — conferência de fatura de cartão e extrato

App pessoal (você + Ana) pra importar fatura de cartão ou extrato bancário
(PDF ou OFX), classificar cada lançamento por conta — com rateio entre
contas/subcontas quando precisar — e acompanhar os totais em tempo real,
como um fluxo de caixa pessoal.

Instala no celular direto pelo navegador (PWA), sem loja e sem APK.

## Arquitetura

- **Frontend:** React + TypeScript + Tailwind CSS, PWA instalável, publicado como site estático
- **Banco de dados:** Supabase (PostgreSQL gerenciado, com Realtime pra sincronizar você e a Ana)
- **Autenticação:** Supabase Auth (e-mail + senha)
- **Hospedagem recomendada:** Vercel (gratuito, sem servidor próprio)

Todos os dados ficam no Supabase — não em `localStorage` — então trocar de
celular ou reinstalar o app não perde nada, e o que um lança aparece pro
outro na hora.

## Passo a passo para colocar no ar

### 1. Criar o projeto no Supabase (uma única vez)

1. Crie uma conta gratuita em https://supabase.com e um novo projeto
2. No painel do projeto, vá em **SQL Editor** → **New query**
3. Cole o conteúdo de `supabase/migrations/001_initial_schema.sql` e clique em **Run**
4. Vá em **Project Settings → API** e anote a **Project URL** e a chave **anon public**

### 2. Publicar o app (Vercel)

1. Crie uma conta gratuita em https://vercel.com (pode usar login do GitHub)
2. Suba esta pasta pra um repositório no GitHub
3. Na Vercel, **Add New → Project**, selecione o repositório
4. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` = a Project URL do passo 1
   - `VITE_SUPABASE_ANON_KEY` = a chave anon public do passo 1
5. Clique em **Deploy**

Em poucos minutos o app estará no ar com um link próprio
(ex: `confere-voce-e-ana.vercel.app`).

### 3. Instalar no celular (sem loja, sem APK)

1. Abra o link publicado no navegador do celular (Chrome no Android, Safari no iPhone)
2. **Android/Chrome:** toque no menu (⋮) → "Adicionar à tela inicial" (ou vai aparecer um banner de instalação sozinho)
3. **iPhone/Safari:** toque em Compartilhar (□↑) → "Adicionar à Tela de Início"
4. Um ícone do Confere aparece na tela inicial e abre em tela cheia, como um app normal

Pra facilitar, gere um QR code apontando pro link da Vercel (qualquer
gerador de QR online, ou peça pra eu gerar um) e cada um escaneia com a
câmera do próprio celular — abre direto no navegador, pronto pra instalar.

### 4. Criar a fatura compartilhada

1. Cada um cria sua própria conta (e-mail + senha) no app
2. O primeiro a entrar cria a fatura ("Criar nova") e recebe um **código de convite** de 6 caracteres (fica visível na aba Resumo depois também)
3. O segundo usa "Entrar com código" e cola esse código — a partir daí os dois veem as mesmas contas e lançamentos, atualizados em tempo real

## Desenvolvimento local (opcional)

```bash
npm install
cp .env.example .env.local   # depois edite com os dados reais do seu projeto Supabase
npm run dev
```

## O que já funciona

- Importar OFX (leitura estruturada) e PDF (extração por texto — revise sempre na tela de conciliação, o layout varia por banco)
- Lançamentos manuais/previstos, com rateio opcional entre contas/subcontas no momento do cadastro
- Conciliação: autosoma por seleção, casamento automático de importado com previsto por data+valor, rateio por lançamento, classificação em lote
- Contas com hierarquia pai/subconta
- Resumo com totais por conta, atividade recente dos dois usuários, e as configurações de aviso (visual / som / só lançamentos novos)
- Sincronização em tempo real entre os dois usuários (Supabase Realtime)

## Próximos passos possíveis

- Editar/excluir lançamentos já confirmados
- Gráfico comparativo mês a mês na aba Resumo
- Melhorar a extração de PDF pra bancos específicos (o parser atual é genérico, baseado em "data + valor na mesma linha")
