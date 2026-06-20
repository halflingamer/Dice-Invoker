# Dice Invoker — Guardiões da Dungeon, inventário e campanha de sete fases

## Objetivo

Reposicionar Dice Invoker como um roguelike no qual o jogador é o Invocador residente de uma dungeon e usa Dados de Monstro para defender o lar contra aventureiros enviados pelo Reino. A mudança preserva mapas ramificados, temporadas, evolução de dados, salas, ranking, backend autoritativo e monetização cosmética.

Esta entrega também introduz inventário equipável, combate automático simplificado, retorno do mapa à área principal entre salas, encerramento correto da run na derrota e uma campanha completa de sete fases com dificuldade crescente.

## Nova fantasia do jogo

O Reino considera as dungeons ativos improdutivos e iniciou um programa de privatização. Aventureiros, fiscais, consultores e nobres invadem os corredores para expulsar seus moradores, confiscar tesouros e preparar a concessão à iniciativa privada.

O jogador continua sendo um Invocador, mas invoca e fortalece monstros. Os antigos Dados de Herói tornam-se Dados de Monstro. Os adversários são invasores controlados automaticamente. O tom permanece medieval, colorido, absurdo e bem-humorado.

O primeiro monstro jogável é o **Slime Zelador**, guardião inicial da dungeon. Sua progressão usa a sequência:

`D4 → D6 → D8 → D10 → D12 → D20`

Cada promoção oferece linhagens ofensivas e defensivas. A arte definitiva dos monstros será produzida depois que esta estrutura estiver funcional; os assets existentes podem ser usados temporariamente.

## Migração do domínio

A implementação fará uma migração semântica real, não apenas uma troca de rótulos na interface:

- herói passa a ser guardião ou monstro;
- inimigo passa a ser invasor;
- dado de herói passa a ser Dado de Monstro;
- classe passa a representar estágio evolutivo do monstro;
- equipamentos e consumíveis pertencem ao inventário da dungeon.

Os algoritmos já testados de mapa, RNG, salas, persistência e segurança serão preservados. Compatibilidade de leitura deve migrar estados antigos de prévia quando isso puder ser feito sem ambiguidade; estados inválidos serão rejeitados sem expor seed ou detalhes internos.

## Estrutura da campanha

A run completa possui sete fases. Cada fase gera seu próprio mapa ramificado e termina em um invasor-chefe fixo. A quantidade de salas antes do chefe cresce progressivamente:

| Fase | Região | Salas antes do chefe | Chefe invasor |
| --- | --- | ---: | --- |
| 1 | Entrada Saqueada | 3 | Escudeiro Cobrador |
| 2 | Galerias de Estoque | 4 | Arqueira de Vistoria |
| 3 | Biblioteca Proibida | 5 | Maga Cartorial |
| 4 | Forja Abandonada | 6 | Paladino de Despejo |
| 5 | Cripta Terceirizada | 7 | Necromante Consultor |
| 6 | Cofres do Núcleo | 8 | Auditor Real |
| 7 | Coração da Dungeon | 9 | Príncipe da Privatização |

Cada decisão oferece exatamente dois ou três Dados de Local alcançáveis. A topologia segue o princípio visual de Slay the Spire: conexões explícitas, ramificações e caminho já percorrido destacado. O gerador mantém aleatoriedade controlada, evita sequências injustas e garante oportunidades de recuperação.

As fases são conteúdo configurável. Vida, defesa natural, dado de ataque, recompensa e composição de salas são definidos por configuração, permitindo adicionar fases e temporadas sem reescrever o motor. Ao vencer um chefe, o servidor encerra a fase, aplica a escalada de dificuldade e gera o mapa seguinte. Vencer o chefe da fase 7 encerra a campanha com vitória.

## Fluxo da área principal

O mapa ocupa a área principal sempre que não há uma sala ativa. Depois que uma sala é resolvida, combate e overlays são desmontados e o mapa volta imediatamente ao centro. O jogador escolhe um dos Dados de Local alcançáveis; somente depois da escolha a sala selecionada é aberta.

O mapa lateral permanente deixa de ser a superfície principal. A interface escolhida usa:

- mapa central entre salas;
- resumo compacto do Slime Zelador e da fase atual;
- botão de mochila que abre uma gaveta lateral;
- percurso concluído visível no próprio mapa;
- quatro slots futuros de monstro visíveis, porém bloqueados nesta entrega.

Combate, mercador, tesouro, evento e descanso substituem temporariamente o mapa central. Nenhum cenário de combate permanece ativo fora de um encontro.

## Combate automático simplificado

Cada combatente rola apenas um dado de ataque por turno. Não existem mais dados de defesa. O guardião e o invasor possuem defesa natural definida por sua ficha; equipamentos podem aumentar a defesa do guardião.

O dano é calculado exclusivamente no servidor:

`dano = máximo(0, ataque rolado - defesa natural - bônus de equipamento)`

O Slime ataca e, caso o invasor sobreviva, o invasor contra-ataca. Um combatente derrotado não executa ação posterior. Vida persiste entre salas conforme as regras atuais da run.

O resultado máximo de qualquer dado de ataque é crítico. Crítico recebe destaque visual e sonoro curto, mas não ganha multiplicador oculto: o próprio valor máximo já representa o melhor ataque do estágio. O cliente recebe do servidor a indicação derivada de crítico ou pode derivá-la apenas de `resultado === lados`, sem alterar o cálculo.

## Apresentação dos dados

Os dados do guardião e do invasor são elementos separados e ancorados acima da cabeça do respectivo personagem. Eles são menores que o overlay atual e não ocupam o centro da batalha.

Uma rolagem comum aparece, resolve e desaparece rapidamente. Apenas críticos usam pausa curta, brilho, escala e texto de ênfase. As animações respeitam `prefers-reduced-motion`. Em telas móveis, os dados permanecem ligados aos personagens e não cobrem barras de vida ou controles.

## Derrota e fim de run

Quando o Slime chega a zero PV, o estado muda imediatamente para derrota. Todos os temporizadores, callbacks e comandos automáticos de combate são cancelados; nenhum novo turno pode começar e nenhuma recompensa pode ser concedida.

A tela de fim de run mostra:

- resultado de derrota;
- fase alcançada;
- salas concluídas;
- estágio evolutivo do Slime;
- opção de iniciar uma nova run.

O servidor mantém o resultado definitivo. O cliente não pode fechar a derrota e continuar a run. A vitória final recebe uma tela equivalente com o Reino repelido.

## Inventário e equipamentos

O inventário é compartilhado pela dungeon, mas equipamentos pertencem a um monstro específico. Nesta entrega apenas o Slime Zelador está desbloqueado; a estrutura aceita até cinco monstros sem alterar o formato do estado.

Cada monstro possui exatamente três slots:

- Arma;
- Armadura;
- Acessório.

Cada slot aceita no máximo um item de seu tipo. Um item individual não pode estar equipado por dois monstros. Poções e itens descartáveis ficam em uma seção separada de Consumíveis e não ocupam slot.

Itens guardados não concedem bônus. Apenas itens equipados alteram ataque, defesa, ouro ou outros atributos. Espada Afiada é Arma, Escudo Reforçado é Armadura e Amuleto Fiscal é Acessório. Poções compradas passam a integrar o inventário de consumíveis em vez de serem usadas automaticamente.

Equipar, desequipar e usar consumíveis só é permitido no estado de mapa, entre salas. A mochila fica bloqueada durante combate, mercador, tesouro, evento, promoção, transição de fase e fim de run.

## Estado e comandos autoritativos

O estado da run passa a representar explicitamente:

- fase da campanha e mapa da fase;
- contagem total de salas concluídas;
- guardiões desbloqueados e guardião ativo;
- ficha do guardião, incluindo defesa natural;
- invasor atual, defesa natural e dado de ataque;
- inventário compartilhado;
- pilhas de consumíveis;
- equipamentos por guardião e por slot;
- resultado final `ongoing`, `victory` ou `defeat`.

Novos comandos aceitam apenas intenção e identificadores:

- equipar item em guardião e slot;
- desequipar item de guardião e slot;
- usar consumível no guardião;
- iniciar nova run após o fim.

O cliente nunca envia dano, defesa, preço, bônus, resultado crítico, progressão de fase ou pontuação. O reducer valida fase permitida, posse do item, tipo do slot, exclusividade, quantidade, sequência e idempotência. Persistência e cálculo de score permanecem no backend.

## Segurança

- Schemas de comandos são estritos e rejeitam campos adicionais.
- IDs de conteúdo são validados contra a temporada ativa.
- Equipamentos não podem ser duplicados, forjados ou aplicados fora do slot correto.
- Comandos de inventário são rate limited por usuário e run.
- Repetições usam IDs idempotentes e não consomem o mesmo item duas vezes.
- Transições de fase, vitória e derrota são estados terminais ou controlados pelo servidor.
- RNG de mapa, combate, recompensa e evento continua separado por canal.
- Erros públicos não revelam seed, ofertas privadas, estatísticas internas ou detalhes de validação úteis a atacantes.
- Logs registram transições relevantes e rejeições sem armazenar segredos ou dados sensíveis desnecessários.

## Conteúdo e artes temporárias

O Slime existente representa temporariamente o Slime Zelador. O Escudeiro existente pode representar o primeiro invasor. Os demais chefes e monstros usam artes temporárias genéricas até a etapa de produção visual definitiva.

Assets devem ser selecionados por ID de conteúdo, nunca por regras espalhadas na UI. Isso permitirá substituir sprites sem alterar combate, inventário ou progressão.

## Testes e critérios de aceite

- O gerador produz sete mapas com 3, 4, 5, 6, 7, 8 e 9 salas antes dos respectivos chefes.
- Cada decisão oferece somente dois ou três locais alcançáveis e o chefe de cada fase é fixo.
- Vencer um chefe gera a fase seguinte com dificuldade superior; vencer a fase 7 encerra a campanha.
- Apenas um item de cada tipo pode ser equipado por monstro e um item não pode ser equipado em dois monstros.
- Itens guardados não concedem bônus; itens equipados concedem os bônus oficiais.
- Inventário e consumíveis só podem ser manipulados no mapa.
- Combate rola um dado de ataque por combatente e usa defesa natural mais equipamento.
- Resultado máximo do dado é marcado como crítico sem multiplicador adicional.
- Dados aparecem separados sobre seus respectivos personagens e rolagens comuns desaparecem rapidamente.
- Derrota cancela o loop automático, impede comandos posteriores e abre a tela de fim de run.
- Resolver qualquer sala devolve a área principal ao mapa antes da próxima escolha.
- Testes de API rejeitam estatísticas, itens, slots e transições adulteradas.
- Testes unitários, integração, componentes, lint, typecheck, build Next.js e exportação Hostinger devem passar.
- Playtests em desktop e 390×844 validam fluxo, legibilidade, inventário, crítico, derrota e transição entre fases.

## Fora do escopo desta entrega

- Combate simultâneo com até cinco monstros.
- Desbloqueio funcional dos quatro monstros adicionais.
- Artes definitivas para todos os monstros e invasores.
- Novas formas de monetização além das regras cosméticas já definidas.
- Alteração do ranking ou do cálculo autoritativo de score além dos campos necessários para registrar a campanha de sete fases.
