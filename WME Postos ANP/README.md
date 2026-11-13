
# ⛽ WME Postos ANP

Userscript para o **Waze Map Editor (WME)** que consulta e plota **postos de combustíveis** diretamente no mapa, usando a API oficial de Revendedores da **ANP** (Agência Nacional do Petróleo, Gás Natural e Biocombustíveis).

## 📋 O que ele faz

- Consulta postos por **UF** (obrigatório) e **Município** (opcional)
- **Paginação automática**: busca todas as páginas da API até esgotar os resultados
- Plota cada posto como um ponto no mapa do WME
- Exibe o **nome do posto** (razão social) como rótulo no mapa
- Ao clicar em um ponto, abre um **card arrastável** com os dados completos do posto
- Normaliza automaticamente o nome do município (remove acentos e caracteres especiais) para evitar erros na API

## 🚀 Instalação

1. Instale o **Tampermonkey** no seu navegador (Chrome, Edge, Firefox, etc.)
2. **[Clique aqui para instalar o script](https://raw.githubusercontent.com/clenildo96/wme-scripts/main/WME%20Postos%20ANP/WME-Postos-ANP.user.js)**
3. Confirme a instalação na tela que abrir
4. Abra o **Waze Map Editor** e procure a aba **⛽ ANP** na barra lateral

## 🖱️ Como usar

1. Na aba **⛽ ANP**, selecione a **UF** desejada
2. (Opcional) Digite o **município** — acentos e caracteres especiais são removidos automaticamente
3. Clique em **🔍 Buscar Postos**
4. Aguarde o carregamento (o status mostra o progresso da paginação)
5. Os postos aparecem no mapa como pinos laranja
6. **Clique em um pino** para abrir o card com os detalhes
7. **Arraste o topo do card** (barra laranja) para reposicioná-lo na tela

## 📊 Dados exibidos no card

| Campo | Origem na API |
|---|---|
| Razão Social | `razaoSocial` |
| CNPJ | `cnpj` (formatado) |
| Autorização | `autorizacao` |
| Endereço | `endereco` |
| Complemento | `complemento` |
| Bairro | `bairro` |
| CEP | `cep` |
| Município / UF | `municipio` / `uf` |
| Distribuidora | `distribuidora` |
| Classe | `classe` |
| Status SIGAF | `statusSIGAF` |
| Produtos | `produtos[].produto` |

## ⚙️ Configuração técnica

- **API utilizada:** `https://revendedoresapi.anp.gov.br/v1/combustivel`
- **Documentação oficial:** [Manual da API de Revendedores ANP](https://www.gov.br/anp/pt-br/centrais-de-conteudo/paineis-dinamicos-da-anp/paineis-dinamicos-do-abastecimento/api-revendedores-manual-usuario.pdf)
- **Permissões:** `GM_xmlhttpRequest` (para contornar a CSP do Waze), `unsafeWindow` (para acessar o SDK do WME)
- **Domínio autorizado:** `revendedoresapi.anp.gov.br`

## 🔄 Atualização automática

O script inclui `@updateURL` e `@downloadURL` apontando para este repositório. O Tampermonkey verifica atualizações periodicamente e instala novas versões automaticamente quando o `@version` é incrementado.

## ⚠️ Limitações

- A API da ANP pode retornar **postos sem coordenadas geográficas** (latitude/longitude vazias). Esses postos são **ignorados** pelo script.
- Para UFs grandes (SP, MG, RJ), a consulta pode demorar alguns segundos devido ao volume de registros e à paginação.
- O limite de segurança é de **100 páginas** (500.000 registros), mais que suficiente para qualquer UF brasileira.

## 📜 Licença

Este script está sob a licença descrita no arquivo [LICENSE](../../LICENSE) do repositório principal.

---

**Desenvolvido por [Clenildo](https://github.com/clenildo96) para a comunidade de editores do Waze.**
