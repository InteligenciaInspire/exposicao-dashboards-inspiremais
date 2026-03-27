# Exibição de Dashboards (sem reload)

Aplicação Next.js 14 (app router, TS, Tailwind) para rotacionar múltiplos dashboards via iframes sem recarregar a página. Inclui UI para editar títulos, URLs, intervalos, sandbox/allow e importar/exportar JSON. Config fica no `localStorage` do navegador e pode ser compartilhada via export.

## Rodar local

```bash
npm run dev
# abre em http://localhost:3000
```

## Configuração

- Semente inicial em [dashboards.json](dashboards.json). Edite ou use a UI para sobrescrever (persistência local).
- A UI de configuração fica na lateral em [app/page.tsx](app/page.tsx):
	- Adicionar/remover dashboards
	- Ajustar título, URL do iframe, intervalo por dashboard, sandbox e allow
	- Importar/Exportar JSON (útil para mover a config entre TVs)
- Mudanças ficam só no navegador (localStorage). Exporte para levar a outro dispositivo.

## Controles de rotação

- Play/Pause, Próximo/Anterior, indicador do slide ativo, intervalo por dashboard.
- Iframes permanecem montados; só a visibilidade troca (sem reload/redimensionamento).

## Modo TV / fullscreen

- Botão “Alternar tela cheia” na UI. Em modo kiosk, configure o SO/navegador para não dormir.
- O mouse some após inatividade do SO (dependendo do kiosk). Atalhos de teclado padrão do navegador podem estar desabilitados em modo fullscreen.

## Deploy na Vercel

- Projeto é estático, sem API. Rode `npm run build` e publique normalmente (`vercel` CLI ou dashboard).
- Se alterar [dashboards.json](dashboards.json) antes do deploy, essa será a semente padrão; cada navegador continua com suas edições locais.
