# Portal de Jogos

Projeto base do site com varios jogos, organizado por modulo.

## Estrutura principal

- `index.html`: home do portal
- `portal/styles/home.css`: visual do portal
- `jogos/termo/`: modulo completo do Palavro
- `jogos/forca/`: placeholder de outro jogo
- `jogos/memoria/`: placeholder de outro jogo
- `server.ps1`: servidor local do portal
- `netlify.toml`: configuracao de deploy

## Modulo Palavro

Tudo do Palavro fica dentro de `jogos/termo/`:

- `index.html`: entrada do jogo
- `src/`: frontend do jogo
- `data/`: listas de palavras
- `backend/netlify/functions/`: backend serverless do Palavro

## Rodar localmente

1. Execute `iniciar-servidor.bat`
2. Abra `http://localhost:8080`

## Publicar gratis no Netlify

1. Suba a pasta `portal-jogos` para um repositorio no GitHub.
2. Entre no Netlify e escolha `Add new site` > `Import an existing project`.
3. Conecte o repositorio do portal.
4. Deixe o Netlify usar a configuracao do arquivo `netlify.toml`.
5. Publique o site.

Configuracao que ja esta pronta no projeto:

- `publish`: `.`
- `functions`: `jogos/termo/backend/netlify/functions`
- redirecionamento de `/api/*` para as functions do Netlify

Depois de publicar:

- a home abre em `/`
- o Palavro abre em `/jogos/termo/`
- a API oficial responde em `/api/daily-challenge`
- a validacao responde em `/api/validate-word?guess=PALAVRA`

## Rotas

- `/`: home do portal
- `/jogos/termo/`: jogo Palavro
- `/jogos/forca/`: placeholder
- `/jogos/memoria/`: placeholder
- `/api/daily-challenge`: API do Palavro
- `/api/validate-word?guess=PALAVRA`: validacao do Palavro
