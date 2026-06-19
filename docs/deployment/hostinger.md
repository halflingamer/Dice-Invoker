# Prévia do Dice Invoker na Hostinger

O plano de hospedagem PHP compartilhada pode servir a interface estática do jogo, mas não executa o servidor Next.js, Auth.js, Prisma nem o cálculo autoritário de score. Por isso, este pacote é uma demonstração interativa sem login e sem ranking.

## Gerar o pacote

```powershell
npm.cmd run build:hostinger
```

O comando gera `dist/dice-invoker-hostinger-preview.zip`. Ele:

- remove as rotas `src/app/api` somente durante o build e sempre as restaura;
- ativa export estático e imagens sem servidor de otimização;
- identifica visualmente a página como demonstração;
- rejeita rotas de API e marcadores de segredos no resultado;
- inclui `.htaccess` com listagem de diretório desativada e cabeçalhos de segurança.

## Domínio temporário ativo

O endereço originalmente informado (`sandybrown-dog-375291.hostingersite.com`) não estava mais associado a um site e não respondia. Foi criado um site PHP/HTML isolado para o Dice Invoker em:

`https://saddlebrown-louse-542936.hostingersite.com/`

## Publicar pelo Git

A branch `hostinger-preview` contém somente os arquivos gerados de `out`, sem código servidor ou variáveis privadas. No hPanel, use **Avançado → GIT** e configure:

- Repositório: `https://github.com/halflingamer/Dice-Invoker.git`
- Branch: `hostinger-preview`
- Diretório: `/public_html`

## Publicar por upload manual

1. No hPanel, abra **Sites → Gerenciar → Gerenciador de arquivos**.
2. Abra `public_html` do domínio `saddlebrown-louse-542936.hostingersite.com`.
3. Remova apenas a página padrão da instalação vazia.
4. Envie `dice-invoker-hostinger-preview.zip` e extraia o conteúdo diretamente em `public_html`.
5. Confirme que `public_html/index.html` e `public_html/.htaccess` existem.
6. Abra `https://saddlebrown-louse-542936.hostingersite.com/` em janela anônima.

Nunca envie `.env.local`, `src`, `prisma`, `node_modules` ou o repositório completo para `public_html`.

## Produção completa

Login, PostgreSQL, runs validadas e ranking exigem um host Node.js para o Next.js autoritário. O domínio pode continuar na Hostinger apontando por DNS para esse host quando essa etapa estiver pronta.
