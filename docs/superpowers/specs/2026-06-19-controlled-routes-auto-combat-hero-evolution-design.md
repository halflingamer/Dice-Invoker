# Dice Invoker — Rotas, combate automático e evolução do herói

**Data:** 2026-06-19  
**Status:** aprovado para planejamento

## Objetivo

Transformar a run em uma sequência de escolhas estratégicas entre caminhos ramificados, mantendo a identidade dos Dados Primordiais. O mapa deve gerar surpresa sem produzir sequências injustas, o combate deve acontecer automaticamente com uma janela curta de intervenção, e o dado de classe do herói deve evoluir durante cada run.

## Princípios

- O destino é aleatório, mas nunca arbitrariamente injusto.
- O jogador enxerga informação suficiente para escolher uma rota conscientemente.
- A build decide como o herói luta; o jogador não executa ataques manualmente.
- Evolução aumenta opções e identidade de classe, não apenas números.
- O servidor é a autoridade sobre mapa, rolagens, XP, evolução, combate e score.
- Toda progressão de poder descrita aqui reinicia ao final da run.

## Mapa de Dados de Local

A run possui dez etapas percorridas. O mapa é um grafo direcionado em camadas, inspirado na leitura de rotas de Slay the Spire, mas cada nó é apresentado como um Dado de Local.

- As camadas oferecem duas ou três opções de local.
- Cada nó se conecta somente a parte dos nós da camada seguinte.
- Não existem becos sem saída.
- Todos os nós gerados pertencem a pelo menos uma rota completa.
- A última camada contém somente o chefão da temporada.
- Nenhum outro tipo ou posição de sala é fixo.

No início da run, o servidor gera o grafo e rola todos os Dados de Local. A face superior fica visível desde o começo e mostra, por símbolo, o tipo exato sorteado:

- espadas: combate;
- caveira ou coroa: elite;
- baú: tesouro;
- balança ou moeda: mercador;
- interrogação: evento;
- fogueira: descanso;
- coroa monstruosa: chefão.

O jogador pode inspecionar caminhos futuros, mas não vê o inimigo, evento, estoque ou recompensa específicos antes de entrar no local.

## Aleatoriedade controlada

O sistema não fará sorteios independentes para cada nó. Ele usará uma bolsa ponderada de tipos de sala, embaralhada de maneira determinística, seguida por validação das rotas.

Distribuição inicial para balanceamento:

- combate: muito comum;
- evento: comum;
- descanso: incomum;
- tesouro: incomum;
- mercador: incomum;
- elite: raro;
- chefão: exclusivo da última camada.

As quantidades finais serão calibradas por simulação, não fixadas permanentemente pelos valores iniciais.

### Regras de proteção

- Nenhuma rota completa contém elites consecutivos.
- Nenhuma rota repete o mesmo tipo mais de duas vezes seguidas.
- Toda rota oferece ao menos uma oportunidade de recuperação antes do chefão, por descanso, mercador ou evento recuperador possível.
- Sempre que houver tipos suficientes na bolsa, opções alcançáveis na mesma bifurcação serão diferentes.
- Uma rota com poucas fontes de XP recebe compensação de jornada para não bloquear a evolução esperada.
- A geração tenta novamente apenas dentro de um limite definido; ao atingir o limite, usa uma construção de contingência válida e determinística.

Essas regras limitam sequências ruins sem garantir uma rota perfeita. Escolhas arriscadas continuam existindo.

## Determinismo e segurança

O servidor cria uma seed secreta por run. A seed pública ou identificador enviado ao cliente não permite prever resultados futuros.

Fluxos pseudoaleatórios separados derivam da seed principal:

- `map`: topologia e tipos dos locais;
- `encounter`: inimigos e variações de sala;
- `combat`: dados de dano e defesa;
- `reward`: recompensas e ofertas;
- `event`: resultados de eventos.

Separar os fluxos impede que rerrolar um dado de combate altere uma recompensa futura. Cada comando possui sequência, cursor e idempotency key. O cliente envia somente a intenção; nunca envia resultados, XP, dano, evolução ou score calculados.

## Fluxo da run

1. O servidor cria a run, seed e mapa completo.
2. A interface anima a rolagem inicial dos Dados de Local.
3. O jogador escolhe um nó alcançável.
4. O servidor valida a conexão e resolve a entrada na sala.
5. Combates são executados turno a turno pelo servidor.
6. Recompensas, XP e possíveis promoções são aplicados.
7. O jogador retorna ao mapa e escolhe a próxima conexão.
8. A última etapa leva ao chefão fixo da temporada.
9. O servidor encerra a run e calcula o score.

## Combate automático

O herói e o inimigo agem automaticamente. Cada turno segue uma máquina de estados explícita:

1. `preparing`: servidor prepara o turno;
2. `rolling`: dados de dano e defesa aparecem e rolam;
3. `intervention`: resultados ficam visíveis por uma janela curta;
4. `resolving`: servidor aplica defesa, dano, cura e efeitos;
5. `presenting`: a interface mostra o resultado e remove os dados;
6. `next-turn` ou encerramento do combate.

Na janela de intervenção, o jogador pode gastar essência para rerrolar um dado permitido. Sem ação, o turno continua automaticamente. A janela possui duração configurável e o servidor considera seu próprio relógio; atrasos ou alterações no cliente não estendem o prazo.

A animação não escolhe resultados. Ela apenas apresenta os valores já confirmados pelo servidor. Os dados entram na arena, giram, assentam na face correta e desaparecem depois da resolução.

## Dado de classe e XP

Todo herói começa a run no primeiro estágio da árvore, normalmente D4. Salas concedem XP de jornada, e combates, elites e eventos podem acrescentar bônus.

Progressão máxima:

`D4 → D6 → D8 → D10 → D12`

- D6: primeira especialização;
- D8: identidade principal da build;
- D10: evolução esperada para uma run consistente;
- D12: forma excepcional, obtida somente com desempenho ou escolhas especiais.

Os limites de XP serão balanceados para não depender de uma única rota. XP, nível, classe e dado retornam ao estado inicial após a run.

## Árvore inicial do Escudeiro

```text
Escudeiro D4
├─ Guerreiro D6 — ataque
│  ├─ Duelista D8 — velocidade e crítico
│  └─ Cavaleiro D8 — dano e armadura
└─ Guardião D6 — defesa
   ├─ Paladino D8 — cura e proteção
   └─ Bastião D8 — bloqueio e contra-ataque
```

Os estágios D10 e D12 serão definidos como continuações das identidades escolhidas, evitando que todas as ramificações terminem na mesma ficha.

Ao atingir o limite de XP, o combate ou sala atual termina primeiro. Em seguida, a run entra na fase `promotion`, apresenta duas classes válidas e aguarda uma escolha autenticada. Não é possível continuar o mapa antes da promoção.

## Como o dado melhora

A promoção não troca apenas o poliedro. Ela transforma a ficha do herói:

- aumenta a quantidade de faces possíveis;
- preserva parte das faces que definem a classe anterior;
- adiciona faces exclusivas da nova classe;
- pode aprimorar faces antigas;
- altera prioridades da IA automática;
- pode desbloquear sinergias com dados de ataque, defesa e magia equipados.

O dado de classe determina a base usada nas rolagens automáticas de dano e defesa. Dados equipados modificam faces, adicionam efeitos ou criam rolagens auxiliares; eles não substituem a identidade de classe.

## Interface

### Mapa

Os nós possuem cinco estados visuais: bloqueado, alcançável, selecionado, concluído e perdido. Linhas deixam claro quais escolhas continuam disponíveis. O mapa permite rolagem vertical em telas pequenas sem esconder o próximo conjunto de opções.

### Combate

Somente os dados relevantes ao turno ocupam a área central. Vida, essência e progressão de XP permanecem legíveis. Durante `intervention`, o dado rerrolável recebe destaque e o custo de essência aparece junto à ação.

### Promoção

A tela mostra as duas classes lado a lado, incluindo novo poliedro, faces adicionadas, faces melhoradas, papel tático e sinergias principais.

## Testes e métricas de equilíbrio

Testes de propriedade executarão milhares de seeds e verificarão:

- determinismo para seed e versão de conteúdo iguais;
- conectividade e ausência de becos sem saída;
- chefão único na última camada;
- cumprimento das regras de repetição, elite e recuperação;
- diversidade mínima entre escolhas;
- distribuição de tipos por rota;
- XP mínimo, mediano e máximo antes do chefão;
- frequência de D6, D8, D10 e D12;
- impossibilidade de alterar resultados por repetição ou reordenação de comandos.

Telemetria agregada acompanhará escolha de rotas, mortes por etapa, classes escolhidas, uso de essência e evolução alcançada. Ajustes de pesos e limites serão versionados por temporada para que uma run em andamento nunca mude de regras.

## Fora deste incremento

- árvores completas dos dez heróis do MVP;
- balanceamento definitivo de todas as faces;
- efeitos visuais finais para cada poliedro;
- recompensas permanentes ou monetização;
- ranking definitivo da temporada.

O incremento deve entregar a fundação extensível, uma árvore jogável do Escudeiro e instrumentos de teste suficientes para expandir conteúdo com segurança.
