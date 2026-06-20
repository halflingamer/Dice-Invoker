# Dice Invoker — Combate inimigo, salas interativas e variantes de slime

## Objetivo

Completar o ciclo jogável da run com contra-ataques inimigos, economia temporária, mercador funcional, recompensas de tesouro, eventos com consequências e variantes provisórias do slime para elite e chefão.

## Princípios

- A run deve continuar rápida e legível.
- Nenhuma sala libera a rota seguinte antes de ser resolvida.
- Todo poder e recurso obtido nesta etapa é temporário e reinicia ao fim da run.
- O backend é autoritativo; o cliente nunca informa dano, preço, recompensa ou saldo resultante.
- A prévia estática da Hostinger simula o fluxo no cliente, informa que é demonstração e não envia score ao ranking.

## Combate automático

Cada turno possui três resultados visíveis:

1. dado de dano do herói;
2. dado de defesa do herói;
3. dado de ataque do inimigo.

O herói ataca primeiro. Se o inimigo sobreviver, ele contra-ataca. O dano sofrido é `máximo(0, ataque inimigo - defesa do herói)`. O resultado é calculado no servidor. Os PV do herói persistem entre salas; chegar a zero encerra a run.

Os dados inimigos são:

- inimigo normal: D4;
- elite: D6;
- chefão: D8.

O overlay mostra os três dados surgindo, rolando, resolvendo e desaparecendo. O campo de batalha reproduz animação de ataque do herói e impacto/avanço do inimigo. Vitória concede XP e ouro segundo o tipo da sala.

## Economia da run

O jogador começa cada run com um saldo inicial configurável. Ouro, itens e bônus pertencem somente à run atual.

Itens iniciais:

- Espada Afiada: +1 ao dano do herói;
- Escudo Reforçado: +1 à defesa do herói;
- Poção: recupera 6 PV, limitada ao máximo;
- Amuleto Fiscal: aumenta em 20% o ouro recebido após sua aquisição, com arredondamento para baixo.

Itens passivos não acumulam consigo mesmos. A poção é consumível e pode ser comprada novamente.

## Mercador

Ao entrar no mercador, a rota é bloqueada e aparece um painel temático sobre o campo de batalha. A oferta contém três itens selecionados por aleatoriedade controlada. Cada item exibe efeito e preço.

O jogador pode comprar várias ofertas enquanto tiver ouro. Uma oferta comprada torna-se indisponível. O servidor valida a oferta vigente, o preço oficial, o saldo e a regra de acúmulo. O botão de saída resolve a sala e libera os próximos dados de local.

## Tesouro

O tesouro apresenta três recompensas e exige a escolha de uma:

- ouro;
- item passivo ou consumível;
- essência.

As opções são geradas pelo servidor a partir do fluxo de RNG de recompensas. O cliente envia apenas o identificador da oferta escolhida. Após a aplicação, a sala é resolvida e as demais opções expiram.

## Eventos

O evento abre o mesmo painel contextual com narrativa curta e três escolhas. A primeira implementação usa o Goblin Vendedor de Seguro:

- comprar seguro;
- ignorar;
- tentar roubar.

O resultado pode alterar PV, ouro, essência ou conceder um efeito temporário. Consequência e mudança de recursos são mostradas antes de o jogador continuar. O RNG de evento permanece separado dos fluxos de mapa, combate e recompensa.

## Fluxo e interface

Cada sala passa por um estado explícito: `combat`, `merchant`, `treasure`, `event` ou `resolved`. Salas de descanso continuam com resolução simples e serão expandidas depois.

Mercador, tesouro e evento usam um painel central comum, com cabeçalho, recursos atuais, até três cartões e uma ação de saída ou confirmação. O campo fica escurecido, mas ainda visível. Em telas pequenas, o painel ocupa quase toda a largura e preserva o cabeçalho de recursos.

O mapa permanece visível, porém seus dados ficam desabilitados enquanto houver combate, recompensa, compra ou resultado de evento pendente.

## Artes provisórias

A imagem atual do Slime de Recibo permanece como inimigo normal. Serão criadas duas variantes preservando silhueta, pixel art, recibo e expressão:

- Inspetor Gelatinoso: corpo vermelho, detalhes carmesim e leitura de elite;
- Supervisor Gelatinoso: corpo dourado, brilhos âmbar e leitura de chefão.

As novas imagens terão fundo transparente, dimensões compatíveis e nomes próprios. O runtime seleciona a textura pelo tipo do encontro. Essas artes são provisórias e poderão ser substituídas sem alterar a lógica.

## Backend autoritativo

O estado da run passa a guardar PV/máximo do herói, ouro, essência, inventário, sala pendente, oferta ativa e histórico auditável de resoluções.

Novos comandos aceitam somente identificadores e intenção:

- comprar item do mercador;
- sair do mercador;
- escolher recompensa do tesouro;
- escolher opção de evento.

O reducer valida fase, sala atual, oferta vigente, disponibilidade, saldo e repetição. Comandos são idempotentes por ID, rate limited por classe e persistidos atomicamente. Tentativas inválidas retornam erros genéricos sem revelar seed ou estado privado.

## Testes e critérios de aceite

- Testes unitários cobrem dano inimigo, mitigação, derrota, ouro, itens, compras, tesouros e consequências de evento.
- Testes do reducer rejeitam preço adulterado, opção inexistente, compra sem saldo, repetição e escolha fora da fase.
- Testes de UI cobrem bloqueio do mapa, compra, escolha de tesouro, resultado de evento e dado inimigo.
- Simulação verifica determinismo e isolamento dos fluxos de RNG.
- Playtest em desktop e 390×844 valida legibilidade e ausência de overflow.
- Build Next.js, exportação Hostinger, testes de segurança e headers devem permanecer aprovados.

