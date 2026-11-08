# Assinatura manuscrita por toque — AXE Despacho Mobile (laboratório)

## Objetivo

Em Android (Capacitor 8, React), o agente consegue testar assinatura
com o dedo ou caneta touch em um **relatório fictício de encerramento**
dentro da demonstração de atendimento. Sem Flutter: o repositório mobile
existente é React/Capacitor; adicionar Flutter fragmentaria o runtime.

## Entrega implementada

- Documento demonstrativo vinculado ao código de ocorrência `DEMO-...`;
- área de desenho responsiva de 600×220 pontos lógicos, com Pointer Events;
- captura mouse/caneta/toque, suporte a limpar e refazer;
- bloqueio de confirmação por traço vazio/insuficiente e consentimento
  explícito para o uso demonstrativo;
- prévia da assinatura manuscrita em PNG **apenas na memória React**;
- limite por traço para evitar consumo descontrolado de memória;
- troca de ocorrência, nova transição ou reinício do simulador descartam
  a prévia da assinatura anterior;
- **nenhuma** gravação em localStorage, IndexedDB, arquivo, fila, backend,
  API do serviço de assinatura ou PDF final.

A área aparece apenas quando a ocorrência fictícia está em
`concluida`. Nenhuma operação real de despacho é habilitada pelo
componente. O APK nativo continua bloqueado para operações reais porque
falta homologação de autenticação nativa.

## Segurança, classificação e limites

A marca manuscrita é **imagem de assinatura eletrônica simples** em
potencial, mas não cria automaticamente uma assinatura digital com
certificado ou garantias legais de autoria/integridade.

O pacote `axesistemas-signature-service` permanece independente, com
a API de assinatura produtiva não inicializada. Não há integração
criptográfica nem promessa de validade jurídica nesta entrega.

Para evolução real, exigir: agente autenticado, documento versão
imutável com hash SHA-256 no servidor, identidade/autorização tenant-scoped,
consentimento, armazenamento protegido e auditável, vínculo ao
despacho, possibilidade de multiassinaturas, assinatura com provedor
adequado e PDF final que preserve a integridade. Para modo offline,
usar fila criptografada, autenticação revalidada e reconciliação sem
repetir mutações incertas, após revisão de segurança.

## Testes

```bash
npm run check
npm test
npm run build
```

As funções puras em `src/lib/touchSignature.ts` têm testes de
normalização de coordenadas, limite de memória, rejeição de cliques
acidentais e aceite de traçado suficiente. A CI verifica tipagem,
suite e build da aplicação.
