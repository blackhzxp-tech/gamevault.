# GameVault 0.3 — Catálogo + Promoções

O GameVault reúne jogos gratuitos permanentes, jogos independentes e ofertas temporárias. Esta versão adiciona uma aba de Promoções com ofertas da Steam e da Epic Games Store.

## Executar no Windows

1. Instale o Node.js LTS (18 ou superior): https://nodejs.org/
2. Extraia o ZIP.
3. Dê dois cliques em `start.bat`.
4. Abra `http://localhost:3000`.
5. Para o site local funcionar, mantenha a janela do servidor aberta.

## Aba Promoções

- As ofertas são carregadas quando o visitante abre a aba Promoções ou clica em Buscar ofertas.
- A consulta usa a API pública da CheapShark e filtra Steam e Epic Games Store quando essas lojas estão disponíveis no catálogo deles.
- Os preços são apresentados em USD (dólares), sem conversão automática para reais. Preço e disponibilidade podem variar por região e conta; confirme na loja antes de comprar.
- Os links de ofertas usam o redirecionador da CheapShark, conforme as condições de uso da API.
- A CheapShark recomenda chamadas em resposta à navegação do usuário e alerta contra consultas automatizadas em massa. Por isso, as promoções são consultadas sob demanda, não em varredura automática periódica.
- Documentação e condições: https://apidocs.cheapshark.com/

## Fontes do catálogo gratuito

- FreeToGame: `https://www.freetogame.com/api/games` — jogos free-to-play.
- itch.io: `https://itch.io/games/price-free.xml` — feed RSS de jogos gratuitos independentes.
- GamerPower: `https://www.gamerpower.com/api/giveaways?platform=pc&type=game` — ofertas temporárias.

As fontes são consultadas ao iniciar e a cada 6 horas enquanto o servidor estiver ativo. O botão Atualizar força uma nova coleta. O catálogo é deduplicado pelo título.

## Publicar gratuitamente para ficar acessível com o PC desligado

O projeto inclui `render.yaml` configurado para o plano **Free** do Render. Não é necessário manter seu computador ligado depois que a publicação terminar.

### O que você precisa

- Uma conta gratuita no GitHub: https://github.com/
- Uma conta gratuita no Render: https://render.com/
- Não escolha planos pagos nem adicione serviços pagos.

### Passo a passo

1. No GitHub, crie um repositório público chamado `gamevault`.
2. Extraia este ZIP e envie os arquivos que estão dentro da pasta `gamevault-starter` para a raiz do repositório. Não envie `node_modules`.
3. No Render, entre no painel e escolha **New + → Blueprint**.
4. Conecte sua conta GitHub e selecione o repositório `gamevault`.
5. O Render vai ler o `render.yaml`. Confira que o plano mostrado é **Free** antes de confirmar.
6. Aguarde o deploy e abra o endereço `https://...onrender.com` fornecido pelo Render.
7. Teste o catálogo e a aba Promoções.

### Limitações importantes do plano gratuito

- O site fica hospedado na nuvem e pode ser acessado com seu PC desligado.
- O serviço gratuito do Render entra em repouso após 15 minutos sem visitas e leva cerca de um minuto para acordar quando alguém acessa. Portanto, a primeira abertura depois de um período parado pode demorar.
- O plano gratuito tem limites de uso e não oferece garantia de disponibilidade contínua. Não é hospedagem profissional com funcionamento ininterrupto garantido.
- Como o serviço pode dormir ou reiniciar, a coleta automática de jogos ocorre quando o servidor está ativo; não prometemos uma atualização a cada 6 horas enquanto ele estiver dormindo.
- O armazenamento local do plano gratuito é temporário. O catálogo é reconstruído quando o servidor inicia, consultando novamente as fontes.
- Não cadastre cartão nem confirme upgrade para plano pago. Se o painel mostrar qualquer cobrança ou plano diferente de **Free**, pare antes de confirmar.

Documentação oficial do Render: https://render.com/docs/free e https://render.com/docs/blueprint-spec

## Limitações conhecidas

- O catálogo não representa todos os jogos gratuitos da internet; cada fonte tem cobertura própria.
- A aba Promoções depende da disponibilidade e cobertura da CheapShark. Ela não é um inventário oficial completo de todas as promoções de Steam/Epic.
- A CheapShark pode não listar todas as ofertas regionais brasileiras e seus preços são em USD.
- O GameVault não hospeda arquivos de jogos; os links direcionam para lojas ou páginas dos criadores.
