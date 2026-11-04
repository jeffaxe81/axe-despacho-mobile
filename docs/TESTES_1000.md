# AXE Despacho Mobile — bateria de 1.000 cenários determinísticos

Este conjunto acrescenta **exatamente 1.000 casos unitários parametrizados**, com identificadores exclusivos, no arquivo `src/lib/robustness1000.test.ts`. Não são 1.000 sessões reais em celular, testes end-to-end nem testes de carga. São verificações de regras de segurança e integridade executadas sobre o **código de produção**.

| Grupo | Casos | Oráculo de comportamento |
| --- | ---: | --- |
| Respostas de ocorrências | 250 | 10 status × 5 prioridades × 5 variantes de pertencimento/duplicação; respostas inválidas sempre rejeitadas |
| Perfil e acesso do agente | 250 | 5 papéis × 5 conjuntos de permissões × 5 IDs de equipe × 2 IDs de organização; somente agente válido recebe comandos |
| Atualidade da sincronização | 250 | 10 relógios-base × 25 intervalos; dados com idade superior a 45 s ou no futuro são inválidos |
| Envio de GPS | 250 | 25 intervalos entre tentativas × 10 tipos de amostra; precisão, antiguidade, ordem temporal e cadência são verificados |
| **Total** | **1.000** | Casos independentes e reproduzíveis, sem requisições externas |

Para reproduzir:

```sh
npm install --no-audit --no-fund
npm run test:1000
npm test
npm run check
npm run build
```

## Melhorias vinculadas aos testes

1. Bloqueio de IDs de usuário/equipe/organização não inteiros, negativos, zero ou fora do intervalo seguro, com confirmação de organização pertencente ao tenant autorizado no componente.
2. GPS em primeiro plano: cadência mínima de 20 segundos **entre tentativas**, mesmo após timeout, e amostras de timestamp repetido/antigo não são reaproveitadas. Não há fila de reenvio nem persistência de coordenadas.
3. Resposta de negação de acesso em `teams.recordLocation` (401/403) revoga também a sessão local do agente e interrompe o GPS, não apenas exibe erro no widget.
4. Regressões adicionais testam falha de transmissão ambígua e relógio retrocedendo.

## Critérios de evidência

- Exigir que o Vitest informe ao menos os **1.000 casos da matriz** aprovados no SHA final.
- TypeScript, build web, guarda de segredos e build Android/Gradle devem passar no **mesmo commit**.
- O APK continua **somente de laboratório**: autenticação nativa e rastreamento real dependem das issues #4 e #5 e de homologação do backend e de Android 14–16.
- Sem acesso a produção, credenciais, banco de dados ou GPS físico durante esta bateria automatizada.
