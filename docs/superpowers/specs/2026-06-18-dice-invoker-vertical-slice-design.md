# Dice Invoker — Design da vertical slice

Data: 18 de junho de 2026  
Status: aprovado em conversa, aguardando revisão do documento  
Escopo: primeira vertical slice jogável

## 1. Objetivo

Construir uma vertical slice web de Dice Invoker que valide o núcleo do jogo: formar uma companhia, equipar dados, atravessar um mapa ramificado, manipular rolagens com Essência, vencer combates automáticos e derrotar um chefe em uma run de 10 a 20 minutos.

A vertical slice deve estabelecer as fundações de segurança, conteúdo sazonal, progressão e monetização cosmética sem tentar entregar todo o MVP comercial.

## 2. Princípios

1. Dados são o principal vetor de build e progressão.
2. Heróis permanecem durante a run; não são invocados novamente a cada turno.
3. O jogador manipula resultados; os heróis executam automaticamente as ações validadas.
4. Todo estado competitivo é calculado no servidor.
5. Progressão persistente libera variedade, não poder acumulativo para rankings.
6. Compras são exclusivamente cosméticas.
7. Temporadas são pacotes versionados de conteúdo.

## 3. Arquitetura

O produto será um monólito modular em Next.js, TypeScript e Tailwind. Auth.js cuidará de identidade e sessão. Prisma acessará PostgreSQL. A aplicação poderá ser hospedada na Vercel ou em outro provedor Node compatível, com banco Neon, Supabase ou PostgreSQL gerenciado.

### 3.1 Módulos

- `app/`: layouts, telas e rotas HTTP.
- `modules/game-engine/`: regras puras de turnos, dados, heróis, inimigos, efeitos e score.
- `modules/run/`: criação, comandos, persistência e progressão das runs.
- `modules/content/`: carregamento e validação de conteúdo sazonal versionado.
- `modules/progression/`: desbloqueios, conquistas e direitos cosméticos.
- `modules/ranking/`: placares por temporada e modo.
- `modules/commerce/`: catálogo, pedidos, pagamentos e direitos cosméticos.
- `modules/security/`: rate limiting, auditoria, integridade, idempotência e detecção de anomalias.
- `prisma/`: schema, migrações e seeds.

### 3.2 Simulação e apresentação

O servidor é a única fonte de verdade. O cliente envia intenções e recebe uma visão sanitizada do estado. O cliente nunca envia resultados de rolagem, dano, HP final, recompensas ou score.

React/DOM renderiza menus, HUD, fichas e dados. Phaser renderiza somente o campo animado de combate. O renderer não contém regras oficiais e anima resultados já resolvidos pelo servidor.

### 3.3 Comandos da run

O protocolo inicial expõe comandos fechados:

- `CHOOSE_ROOM`
- `ROLL_DICE`
- `LOCK_RESULT`
- `REROLL`
- `ACTIVATE_RESULTS`
- `CHOOSE_REWARD`
- `CHOOSE_EVENT_OPTION`

Cada comando possui identificador de run, sequência monotônica, chave de idempotência e payload validado por schema. Comandos fora de ordem ou incompatíveis com a fase atual são rejeitados.

## 4. Loop da run

### 4.1 Progressão da companhia

O primeiro herói é o Escudeiro. O jogador inicia somente com ele e um conjunto básico de dados de ataque e defesa. Novos heróis são desbloqueados permanentemente ao cumprir requisitos claros, mas entram em cada run por recrutamento ou recompensa.

A companhia pode ter até cinco heróis. Cada herói possui uma ficha com atributos e espaços para dados de ataque, defesa ou magia. O dado do herói é uma representação simbólica do personagem: cor indica raridade e símbolo indica classe.

Quando todos os heróis iniciais estiverem desbloqueados, a opção `Destino Aleatório` escolhe o herói inicial e concede +1 de Essência máxima e +5% de multiplicador de score. Esse benefício recompensa a aceitação de risco e nunca pode ser comprado.

### 4.2 Mapa

A vertical slice possui dez salas em rotas ramificadas visíveis:

1. Início.
2–3. Combates e primeiro evento.
4. Tesouro ou mercador.
5. Elite.
6–7. Combate, descanso ou evento.
8. Segundo elite ou rota segura.
9. Preparação.
10. Chefe.

As rotas mostram tipo de sala e risco esperado, permitindo planejamento. O conteúdo exato é determinado no servidor a partir da seed secreta da run.

### 4.3 Combate

1. O servidor rola os dados equipados dos heróis.
2. O jogador trava resultados que deseja preservar.
3. O jogador pode gastar Essência limitada para rerrolar os demais.
4. O jogador escolhe os resultados que deseja ativar.
5. O servidor resolve iniciativa, ataques, defesas, efeitos e ações inimigas.
6. O cliente anima o resultado validado.
7. O ciclo continua até vitória ou derrota.

Heróis agem automaticamente com base em suas fichas e nos dados equipados. A decisão do jogador está na composição, bloqueio, rerrolagem e ativação dos resultados.

### 4.4 Persistência e derrota

Ao terminar ou perder uma run, todo poder temporário é descartado. Permanecem:

- Heróis desbloqueados.
- Conquistas.
- Cosméticos.
- Histórico de runs e pontuação.

Não existe moeda persistente capaz de aumentar poder competitivo.

## 5. Conteúdo da vertical slice

- Escudeiro inicial.
- Maga e Arqueira desbloqueáveis.
- Doze dados equipáveis.
- Oito inimigos comuns.
- Dois inimigos elite.
- Supervisor Gelatinoso como chefe.
- Seis eventos, incluindo o Goblin Vendedor de Seguro.
- Dez salas por run.
- Modo Normal completo.
- Hardcore como configuração do mesmo motor, inicialmente bloqueado ou experimental.

Arena, ranking global público e pagamentos reais ficam fora da primeira vertical slice, embora seus limites de arquitetura e dados sejam preparados.

## 6. Conteúdo sazonal

Cada temporada é um pacote de dados versionado que declara:

- Metadados e história.
- Heróis e requisitos de desbloqueio.
- Dados, faces, raridades e evoluções.
- Inimigos, elites e chefes.
- Salas e eventos.
- Cosméticos e modificadores.

Runs persistem a versão do motor e do pacote de conteúdo. Uma run em andamento continua usando sua versão mesmo após a publicação de novo balanceamento.

## 7. Direção visual

A direção aprovada é `Mesa Arcana`: pixel art chibi em um ambiente de fantasia de taberna arcana, com madeira escura, azul-noturno, violeta e dourado.

### 7.1 Tela de combate

- Campo animado na metade superior.
- Fichas dos heróis e inimigos com informação essencial.
- Mesa ritual na metade inferior.
- Dados físicos em destaque, com estados de travado, selecionado e rerrolável.
- Essência e custo de rerrolagem sempre visíveis.
- Histórico resumido da resolução do turno.

### 7.2 Telas

- Portal principal.
- Seleção de modo.
- Companhia e equipamento.
- Mapa ramificado.
- Combate.
- Recompensa.
- Evento.
- Resultado da run.
- Perfil e desbloqueios.
- Catálogo cosmético separado da progressão.

### 7.3 Arte e acessibilidade

Heróis e inimigos principais usam sprites 48×48; summons e efeitos menores podem usar 32×32. O conjunto mínimo de animações inclui idle, ataque, dano, defesa e derrota.

Raridades usam simultaneamente cor, borda, padrão e ícone. A interface suporta teclado, mouse e toque. O combate mobile usa orientação horizontal; menus e mapa também funcionam em retrato. O jogo oferece movimento reduzido e não exige interações de alta precisão.

## 8. Segurança

Segurança é um critério de aceite de todas as etapas.

### 8.1 Controles preventivos

- Cookies de sessão `HttpOnly`, `Secure` e `SameSite`.
- Proteção CSRF nas mutações aplicáveis.
- Sessões rotacionadas e bloqueio progressivo de abuso.
- Autorização por proprietário em toda run e recurso.
- Seed criptográfica e RNG exclusivamente no servidor.
- Limite de uma quantidade configurável de runs ativas por jogador.
- Schemas estritos, limites de tamanho e rejeição de campos desconhecidos.
- Rate limiting por conta, sessão, IP e classe de operação.
- Idempotência e sequência monotônica dos comandos.
- Transações atômicas e bloqueio otimista no PostgreSQL.
- Segredos somente no ambiente do servidor.
- Política de segurança de conteúdo e headers defensivos.
- Dependências travadas, atualizadas e verificadas.

### 8.2 Integridade competitiva

- O score é reconstruído do log de comandos.
- O cliente nunca envia score, dano, rolagens ou recompensas.
- A run registra versão do motor, conteúdo e sequência de comandos.
- Runs com frequência impossível, duração incompatível, sequências inválidas, sessões conflitantes ou scores anômalos entram em quarentena.
- Heurísticas não aplicam punição definitiva sem evidência revisável.
- Rankings públicos aceitam somente runs finalizadas e verificadas.

### 8.3 Operação e privacidade

- Logs estruturados com correlação e sem segredos.
- Trilha de auditoria para autenticação, runs, score e comércio.
- Alertas para abuso, falhas de webhook e anomalias de ranking.
- Backups e restauração testada.
- Coleta mínima de dados e exclusão de conta.
- Revisão de ameaças e testes adversariais em cada marco.

## 9. Monetização

### 9.1 Fontes de receita

- Passe sazonal com trilha gratuita e premium de cosméticos.
- Loja direta de skins de dados, temas da Mesa Arcana, animações, mascotes, molduras, banners e efeitos de vitória.
- Pacotes de apoiador com cosméticos conhecidos, créditos e trilha sonora.

Não existirão loot boxes. Preço e conteúdo são explícitos.

### 9.2 Barreiras contra Pay to Win

- Compra não altera faces, probabilidades, raridade funcional, Essência, desbloqueios ou score.
- Passe premium não acelera progressão de poder.
- Inventário comercial e progressão de jogo são domínios separados.
- Pagamentos usam webhooks assinados e idempotentes.
- Reembolso revoga apenas o direito cosmético associado.
- A interface não usa contadores falsos, escassez artificial ou padrões manipulativos.

A vertical slice implementa catálogo e direitos cosméticos simulados. Integração de pagamento real ocorre somente após a validação do gameplay e da retenção.

## 10. Falhas e recuperação

- Comando duplicado retorna a resposta idempotente original.
- Estado desatualizado causa sincronização com o estado oficial.
- Queda durante combate retoma do último comando confirmado.
- Run antiga mantém a versão original de regras e conteúdo.
- Erro inesperado reverte a transação e retorna um identificador de suporte.
- Atividade suspeita não interrompe necessariamente a experiência, mas impede publicação imediata do score.
- Nenhuma atualização otimista do cliente altera o estado oficial.

## 11. Testes e verificação

- Testes unitários do motor determinístico.
- Testes baseados em propriedades para dados, dano, Essência e score.
- Testes de integração com PostgreSQL para concorrência e idempotência.
- Testes de contrato das rotas.
- Casos adversariais para payload, autorização, replay e ordem de comandos.
- Simulação automatizada de centenas de runs.
- Playtest manual e automatizado no navegador.
- Comparação visual com o conceito aprovado.
- Testes responsivos, acessibilidade e movimento reduzido.
- Varredura de dependências e revisão de segurança por marco.

## 12. Métricas

O MVP mede somente o necessário para balanceamento:

- Taxa de conclusão.
- Duração da run.
- Abandono por sala.
- Dano recebido.
- Essência gasta.
- Rotas escolhidas.
- Dados escolhidos e ativados.
- Heróis recrutados.

Eventos analíticos não contêm texto livre, segredos ou identificadores sensíveis desnecessários.

## 13. Critérios de aceite

A vertical slice está pronta quando:

1. Um usuário autenticado consegue iniciar e concluir uma run Normal de dez salas.
2. O Escudeiro equipa dados, trava resultados, gasta Essência, rerrola e ativa ações.
3. O servidor resolve todos os resultados e calcula o score.
4. O mapa oferece rotas ramificadas e pelo menos uma escolha de risco e recompensa.
5. O Supervisor Gelatinoso pode ser derrotado.
6. Uma derrota preserva apenas desbloqueios, conquistas, cosméticos e histórico.
7. Maga e Arqueira podem ser desbloqueadas por requisitos verificáveis no servidor.
8. O catálogo cosmético não possui qualquer caminho para conceder poder.
9. Comandos repetidos, fora de ordem, concorrentes ou pertencentes a outro usuário não alteram a run.
10. Os testes automatizados, o playtest de navegador, a revisão visual e a revisão de segurança passam sem falhas críticas.

## 14. Fora de escopo desta entrega

- Conteúdo completo de vinte dados, dez heróis e quinze inimigos.
- Arena infinita completa.
- Ranking global público e ranking histórico.
- Pagamento real.
- Guildas.
- Aplicativos nativos.
- Trailer de marketing; HyperFrames poderá ser usado em uma etapa comercial posterior.

