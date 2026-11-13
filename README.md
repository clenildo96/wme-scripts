
# 🚗 WME Scripts — Userscripts para Waze Map Editor

**Autor:** Clenildo

Bem-vindo(a) ao **WME Scripts**! Este é o meu repositório pessoal de userscripts (scripts para Tampermonkey) desenvolvidos para melhorar a experiência de edição no Waze Map Editor (WME).

A ideia central é ajudar a comunidade de editores do Waze, compartilhando ferramentas que automatizam tarefas, integram dados e tornam o trabalho de edição mais produtivo e preciso.

## 🎯 Propósito

Este repositório reúne ferramentas criadas para facilitar o dia a dia de quem edita o mapa do Waze. Cada script tem uma finalidade própria e pode ser instalado individualmente, conforme a necessidade do editor.

O objetivo é simples: entregar à comunidade ferramentas úteis, bem documentadas e de fácil instalação, sem depender de plataformas externas ou processos complicados.

## 📁 Estrutura do Repositório

Cada script tem sua própria subpasta, contendo:

- O arquivo `.user.js` (código do userscript).
- Um `README.md` com descrição detalhada, instruções e informações específicas daquele script.

```text
wme-scripts/
├── README.md                  ← este arquivo (visão geral)
├── <pasta-do-script-1>/
│   ├── <script-1>.user.js
│   └── README.md
├── <pasta-do-script-2>/
│   ├── <script-2>.user.js
│   └── README.md
└── ...
```

💡 **Dica:** Para descobrir quais scripts estão disponíveis, navegue pelas subpastas deste repositório. Cada uma tem seu próprio README explicando a funcionalidade em detalhes.

## 🚀 Como Instalar e Usar

1. Instale o [Tampermonkey](https://www.tampermonkey.net/) no seu navegador (Chrome, Edge, Firefox, etc.).
2. Escolha um script navegando pelas subpastas deste repositório.
3. Dentro da subpasta, siga as instruções do README daquele script para instalar (geralmente abrindo o arquivo `.user.js` no modo Raw).
4. Confirme a instalação na tela que abrir.
5. Abra o Waze Map Editor e o script estará ativo.

### 🔄 Atualização Automática

Os scripts incluem `@updateURL` e `@downloadURL` apontando para este repositório. Com isso, o Tampermonkey verifica automaticamente se há novas versões e as baixa sem você precisar fazer nada.

## 🧑‍💻 Sobre o Desenvolvimento

Este é um projeto pessoal, mantido por mim, Clenildo, com o objetivo de compartilhar ferramentas com a comunidade de editores do Waze. Cada script é desenvolvido, testado e documentado individualmente.

### Como contribuir

Sua opinião e sugestões são muito bem-vindas! Se você tem uma ideia, encontrou um bug ou quer propor uma melhoria:

- Abra uma **Issue** descrevendo o problema ou a sugestão. É a melhor forma de conversarmos sobre o que pode ser melhorado.
- Se você já tem uma correção pronta, fique à vontade para fazer um **fork** do repositório e abrir um **Pull Request**. Vou avaliar com carinho e, se fizer sentido, incorporar a mudança.

### Se você também desenvolve scripts

Se você cria userscripts para o WME e quer compartilhá-los com a comunidade, sinta-se encorajado a criar o seu próprio repositório. Este aqui é dedicado aos meus scripts, mas a comunidade cresce quando cada um compartilha o que faz. Fico feliz em trocar ideias via Issues!

### Boas práticas (para mim e para quem for fazer fork)

- Testar o script no WME antes de subir.
- Documentar dependências (APIs externas, permissões `@grant`, `@connect`).
- Manter o versionamento semântico no `@version`.

No cabeçalho do userscript, configurar:

```javascript
// @updateURL    https://raw.githubusercontent.com/clenildo96/wme-scripts/main/<pasta>/<arquivo>.user.js
// @downloadURL  https://raw.githubusercontent.com/clenildo96/wme-scripts/main/<pasta>/<arquivo>.user.js
```

## 🤝 Contribuições

Sugestões, correções e melhorias são sempre bem-vindas através de Issues e Pull Requests (via fork). Toda ajuda é válida para fortalecer a comunidade de editores do Waze. 💙

## 📜 Licença

Este projeto está sob a licença descrita no arquivo `LICENSE` do repositório.

---

Desenvolvido com 💙 por **Clenildo** para a comunidade de editores do Waze.
