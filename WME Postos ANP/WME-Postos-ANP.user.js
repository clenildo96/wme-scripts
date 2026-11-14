// ==UserScript==
// @name         WME Postos ANP
// @namespace    WMEANP
// @version      1.3
// @description  Postos de Combustíveis ANP no WME com paginação automática, card arrastável e relatório de postos sem georreferenciamento
// @author       Clenildo
// @match        https://www.waze.com/*/editor*
// @match        https://beta.waze.com/*/editor*
// @exclude      https://www.waze.com/user/*editor/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=waze.com
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      revendedoresapi.anp.gov.br
// @updateURL    https://raw.githubusercontent.com/clenildo96/wme-scripts/main/WME%20Postos%20ANP/WME-Postos-ANP.user.js
// @downloadURL  https://raw.githubusercontent.com/clenildo96/wme-scripts/main/WME%20Postos%20ANP/WME-Postos-ANP.user.js
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    /* ============================================================
       CONFIGURACAO
       ============================================================ */
    const SCRIPT_ID   = 'wme-anp-postos';
    const SCRIPT_NAME = 'WME Postos ANP';
    const LAYER_NAME  = 'anp-postos-pontos';
    const LAYER_CHECKBOX_NAME = 'ANP — Postos de Combustíveis';

    const COR = '#E65100';
    const API_BASE = 'https://revendedoresapi.anp.gov.br/v1/combustivel';
    const CACHE_TTL_MS = 5 * 60 * 1000;

    const pageWindow = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    /* ============================================================
       ESTADO
       ============================================================ */
    let sdk = null;
    let postos = [];
    let postosSemCoordenadas = [];   // NOVO: postos sem lat/lon
    let camadaCriada = false;
    let checkboxCriado = false;
    let cache = {};
    let busy = false;
    let cardEl = null;
    let cardPostoId = null;

    /* Estado do arraste */
    let cardArrastando = false;
    let cardPosicaoManual = false;
    let cardDragOffsetX = 0;
    let cardDragOffsetY = 0;

    /* ============================================================
       LOG
       ============================================================ */
    function log(...args) { console.log('[WME ANP]', ...args); }
    function logErro(...args) { console.error('[WME ANP]', ...args); }

    /* ============================================================
       BOOTSTRAP
       ============================================================ */
    function iniciarSDK() {
        if (!pageWindow.SDK_INITIALIZED) {
            setTimeout(iniciarSDK, 500);
            return;
        }
        pageWindow.SDK_INITIALIZED
            .then(() => {
                if (typeof pageWindow.getWmeSdk !== 'function') {
                    throw new Error('getWmeSdk não está disponível.');
                }
                sdk = pageWindow.getWmeSdk({ scriptId: SCRIPT_ID, scriptName: SCRIPT_NAME });
                log('SDK inicializado:', sdk.getSDKVersion?.() || 'ok');
                iniciar();
            })
            .catch(erro => logErro('Erro no SDK:', erro));
    }

    async function iniciar() {
        if (!sdk) return;
        criarCSS();
        await criarSidebar();
        criarCamada();
        criarLayerSwitcher();
        configurarEventosSDK();
        log('WME Postos ANP 1.3 pronto.');
    }

    /* ============================================================
       SIDEBAR
       ============================================================ */
    async function criarSidebar() {
        try {
            const resultado = await sdk.Sidebar.registerScriptTab();
            const tabLabel = resultado.tabLabel;
            const tabPane  = resultado.tabPane;

            tabLabel.textContent = '⛽ ANP';
            tabLabel.title = 'Postos de Combustíveis ANP';

            tabPane.innerHTML = `
                <div class="anp-container">
                    <div class="anp-header">
                        <div class="anp-title"><span>⛽</span> POSTOS ANP</div>
                        <div class="anp-version">1.3</div>
                    </div>

                    <div class="anp-form">
                        <label class="anp-label">UF (Unidade Federativa)</label>
                        <select id="anpUf" class="anp-select">
                            <option value="">Selecione...</option>
                            <option value="AC">AC</option>
                            <option value="AL">AL</option>
                            <option value="AP">AP</option>
                            <option value="AM">AM</option>
                            <option value="BA">BA</option>
                            <option value="CE">CE</option>
                            <option value="DF">DF</option>
                            <option value="ES">ES</option>
                            <option value="GO">GO</option>
                            <option value="MA">MA</option>
                            <option value="MT">MT</option>
                            <option value="MS">MS</option>
                            <option value="MG">MG</option>
                            <option value="PA">PA</option>
                            <option value="PB">PB</option>
                            <option value="PR">PR</option>
                            <option value="PE">PE</option>
                            <option value="PI">PI</option>
                            <option value="RJ">RJ</option>
                            <option value="RN">RN</option>
                            <option value="RS">RS</option>
                            <option value="RO">RO</option>
                            <option value="RR">RR</option>
                            <option value="SC">SC</option>
                            <option value="SP">SP</option>
                            <option value="SE">SE</option>
                            <option value="TO">TO</option>
                        </select>

                        <label class="anp-label">Município (opcional)</label>
                        <input type="text" id="anpMunicipio" class="anp-input" placeholder="Ex: SAO PAULO (sem acentos)">
                        <div class="anp-hint">Use apenas letras e espaços. Acentos e caracteres especiais serão removidos automaticamente.</div>

                        <button id="btnBuscarAnp" class="anp-btn buscar">🔍 Buscar Postos</button>
                        <button id="btnLimparAnp" class="anp-btn limpar">🗑 Limpar Mapa</button>
                    </div>

                    <div id="anpStatus" class="anp-status">Selecione uma UF e clique em Buscar.</div>

                    <!-- NOVO: RELATÓRIO -->
                    <div id="anpRelatorio" class="anp-relatorio" style="display:none;">
                        <div class="anp-relatorio-titulo">📊 RELATÓRIO DA BUSCA</div>
                        <div class="anp-relatorio-grid">
                            <div class="anp-relatorio-item">
                                <b id="anpTotal">0</b>
                                <span>TOTAL</span>
                            </div>
                            <div class="anp-relatorio-item verde">
                                <b id="anpGeo">0</b>
                                <span>GEORREF.</span>
                            </div>
                            <div class="anp-relatorio-item amarelo">
                                <b id="anpSemGeo">0</b>
                                <span>SEM GEO.</span>
                            </div>
                            <div class="anp-relatorio-item azul">
                                <b id="anpCobertura">0%</b>
                                <span>COBERTURA</span>
                            </div>
                        </div>
                    </div>

                    <!-- NOVO: LISTA DE POSTOS SEM COORDENADAS -->
                    <div id="anpSemCoordSection" class="anp-semcoord-section" style="display:none;">
                        <div id="anpSemCoordHeader" class="anp-semcoord-header">
                            <span>📍 POSTOS SEM GEORREFERENCIAMENTO (<span id="anpSemCoordCount">0</span>)</span>
                            <span id="anpSemCoordToggle" class="anp-semcoord-toggle">▼</span>
                        </div>
                        <div id="anpSemCoordBody" class="anp-semcoord-body" style="display:none;">
                            <button id="btnCopiarTodos" class="anp-btn copiar-todos">📋 COPIAR TODOS OS ENDEREÇOS</button>
                            <div id="anpSemCoordList" class="anp-semcoord-list"></div>
                        </div>
                    </div>

                    <div class="anp-ajuda">
                        <b>💡 Dica</b><br>
                        Clique em um ponto no mapa para ver os detalhes do posto.<br>
                        Arraste o topo do card para reposicioná-lo na tela.
                    </div>
                </div>
            `;

            setTimeout(() => {
                const btnBuscar = document.getElementById('btnBuscarAnp');
                const btnLimpar = document.getElementById('btnLimparAnp');
                if (btnBuscar) btnBuscar.addEventListener('click', buscarPostos);
                if (btnLimpar) btnLimpar.addEventListener('click', () => limparMapa(true));

                // NOVO: toggle da lista de sem coordenadas
                const header = document.getElementById('anpSemCoordHeader');
                if (header) header.addEventListener('click', toggleSemCoord);

                // NOVO: copiar todos
                const btnCopiarTodos = document.getElementById('btnCopiarTodos');
                if (btnCopiarTodos) btnCopiarTodos.addEventListener('click', copiarTodosEnderecos);
            }, 300);

            log('Aba ANP registrada no Sidebar.');
        } catch (erro) {
            logErro('Não foi possível criar a aba do Sidebar:', erro);
        }
    }

    function setStatus(msg, color) {
        const el = document.getElementById('anpStatus');
        if (!el) return;
        el.textContent = msg;
        el.style.color = color || '#555';
    }

    /* ============================================================
       CAMADA
       ============================================================ */
    function criarCamada() {
        if (!sdk || camadaCriada) return;
        try {
            sdk.Map.addLayer({
                layerName: LAYER_NAME,
                zIndexing: true,
                styleContext: {
                    getGraphic: ({ feature }) => criarIcone(feature?.properties),
                    getLabel:   ({ feature }) => criarRotulo(feature?.properties),
                    getTitle:   ({ feature }) => criarTooltip(feature?.properties)
                },
                styleRules: [{
                    style: {
                        externalGraphic: '${getGraphic}',
                        graphicWidth: 28,
                        graphicHeight: 28,
                        graphicXOffset: -14,
                        graphicYOffset: -14,
                        fillOpacity: 1,
                        label: '${getLabel}',
                        labelAlign: 'cm',
                        labelXOffset: 0,
                        labelYOffset: -24,
                        fontColor: '#000000',
                        fontFamily: 'Arial, sans-serif',
                        fontWeight: 'bold',
                        fontSize: '10px',
                        labelOutlineColor: '#ffffff',
                        labelOutlineWidth: 3,
                        labelOutlineOpacity: 0.95,
                        title: '${getTitle}',
                        pointerEvents: 'visiblePainted',
                        cursor: 'pointer'
                    }
                }]
            });
            camadaCriada = true;
            log('Camada criada:', LAYER_NAME);
        } catch (erro) {
            logErro('Erro criando camada:', erro);
        }
    }

    function criarLayerSwitcher() {
        if (!sdk || checkboxCriado) return;
        try {
            sdk.LayerSwitcher.addLayerCheckbox({
                name: LAYER_CHECKBOX_NAME,
                isChecked: true
            });
            checkboxCriado = true;
            log('Checkbox do Layer Switcher criado.');
        } catch (erro) {
            logErro('Erro criando checkbox:', erro);
        }
    }

    /* ============================================================
       ICONE / ROTULO / TOOLTIP
       ============================================================ */
    function criarIcone(p) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="${COR}" stroke="#ffffff" stroke-width="2.5"/><text x="16" y="21" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="#ffffff">⛽</text></svg>`;
        return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    }

    function criarRotulo(p) {
        if (!p) return '';
        let nome = (p.razaoSocial || 'Posto').trim();
        if (nome.length > 28) nome = nome.substring(0, 26) + '…';
        return nome;
    }

    function criarTooltip(p) {
        if (!p) return 'Posto ANP';
        return [
            p.razaoSocial || 'Posto',
            p.municipio ? `${p.municipio} / ${p.uf}` : p.uf
        ].filter(Boolean).join('\n');
    }

    /* ============================================================
       EVENTOS DO SDK
       ============================================================ */
    function configurarEventosSDK() {
        if (!sdk) return;
        try {
            sdk.Events.trackLayerEvents({ layerName: LAYER_NAME });
        } catch (erro) {
            logErro('Erro ativando eventos da camada:', erro);
        }

        sdk.Events.on({
            eventName: 'wme-layer-feature-clicked',
            eventHandler: evento => {
                if (evento.layerName !== LAYER_NAME) return;
                const id = String(evento.featureId);
                const posto = postos.find(p => String(p.id) === id);
                if (!posto) return;
                abrirCard(posto);
            }
        });

        sdk.Events.on({
            eventName: 'wme-layer-checkbox-toggled',
            eventHandler: evento => {
                if (evento.name !== LAYER_CHECKBOX_NAME) return;
                try {
                    sdk.Map.setLayerVisibility({ layerName: LAYER_NAME, visibility: evento.checked });
                } catch (erro) {
                    logErro('Erro alterando visibilidade:', erro);
                }
            }
        });

        sdk.Events.on({
            eventName: 'wme-map-move',
            eventHandler: () => { if (cardEl && !cardPosicaoManual) posicionarCard(); }
        });
        sdk.Events.on({
            eventName: 'wme-map-zoom-changed',
            eventHandler: () => { if (cardEl && !cardPosicaoManual) posicionarCard(); }
        });
    }

    /* ============================================================
       CARD FLUTUANTE (ARRASTAVEL)
       ============================================================ */
    function criarCard() {
        if (cardEl) return;

        cardEl = document.createElement('div');
        cardEl.id = 'anp-card';
        cardEl.innerHTML = `
            <div class="anp-card-wrapper">
                <div class="anp-card-drag-handle">
                    <span class="anp-card-drag-dots">⋮⋮</span>
                    <span class="anp-card-drag-label">Arraste para mover</span>
                </div>
                <div class="anp-card-content">
                    <div class="anp-card-title"></div>
                    <div class="anp-card-rows"></div>
                </div>
            </div>
            <div class="anp-card-tip"></div>
            <a class="anp-card-close" href="#">×</a>
        `;
        document.body.appendChild(cardEl);

        cardEl.querySelector('.anp-card-close').addEventListener('click', e => {
            e.preventDefault();
            fecharCard();
        });

        const handle = cardEl.querySelector('.anp-card-drag-handle');
        if (handle) {
            handle.addEventListener('mousedown', iniciarArraste);
        }
    }

    /* ============================================================
       ARRASTE DO CARD
       ============================================================ */
    function iniciarArraste(evento) {
        if (evento.button !== 0 || !cardEl) return;
        evento.preventDefault();

        const rect = cardEl.getBoundingClientRect();

        cardArrastando = true;
        cardPosicaoManual = true;

        cardDragOffsetX = evento.clientX - rect.left;
        cardDragOffsetY = evento.clientY - rect.top;

        cardEl.style.left = rect.left + 'px';
        cardEl.style.top  = rect.top  + 'px';

        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';

        document.addEventListener('mousemove', moverArraste);
        document.addEventListener('mouseup', encerrarArraste);
    }

    function moverArraste(evento) {
        if (!cardArrastando || !cardEl) return;

        let left = evento.clientX - cardDragOffsetX;
        let top  = evento.clientY - cardDragOffsetY;

        const w = cardEl.offsetWidth;
        const h = cardEl.offsetHeight;
        const margem = 5;

        left = Math.max(margem, Math.min(left, window.innerWidth  - w - margem));
        top  = Math.max(margem, Math.min(top,  window.innerHeight - h - margem));

        cardEl.style.left = left + 'px';
        cardEl.style.top  = top  + 'px';
    }

    function encerrarArraste() {
        cardArrastando = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', moverArraste);
        document.removeEventListener('mouseup', encerrarArraste);
    }

    /* ============================================================
       ABRIR / POSICIONAR CARD
       ============================================================ */
    function abrirCard(posto) {
        criarCard();
        cardPostoId = String(posto.id);

        cardPosicaoManual = false;

        const titulo = cardEl.querySelector('.anp-card-title');
        titulo.textContent = '⛽ POSTO DE COMBUSTÍVEL';
        titulo.style.color = COR;

        const rows = cardEl.querySelector('.anp-card-rows');
        rows.innerHTML = [
            row('Razão Social', posto.razaoSocial),
            row('CNPJ', formatarCNPJ(posto.cnpj)),
            row('Autorização', posto.autorizacao),
            row('Endereço', posto.endereco),
            row('Complemento', posto.complemento),
            row('Bairro', posto.bairro),
            row('CEP', posto.cep),
            row('Município', `${posto.municipio || '-'} / ${posto.uf}`),
            row('Distribuidora', posto.distribuidora),
            row('Classe', posto.classe),
            row('Status SIGAF', posto.statusSIGAF),
            row('Produtos', formatarProdutos(posto.produtos))
        ].join('');

        cardEl.style.display = 'block';
        posicionarCard();
    }

    function row(label, value) {
        if (value === null || value === undefined) return '';
        const v = String(value).trim();
        if (!v || v === 'null' || v === 'undefined' || v === '-') return '';
        return `<div class="anp-card-row"><div class="anp-card-label">${label}:</div><div class="anp-card-value">${v}</div></div>`;
    }

    function formatarCNPJ(cnpj) {
        if (!cnpj) return '';
        const s = String(cnpj).replace(/\D/g, '');
        if (s.length !== 14) return cnpj;
        return `${s.substr(0,2)}.${s.substr(2,3)}.${s.substr(5,3)}/${s.substr(8,4)}-${s.substr(12,2)}`;
    }

    function formatarProdutos(produtos) {
        if (!produtos || !Array.isArray(produtos) || !produtos.length) return '';
        return produtos.map(p => p.produto).filter(Boolean).join(', ');
    }

    function posicionarCard() {
        if (!cardEl || !cardPostoId) return;
        if (cardPosicaoManual) return;

        const posto = postos.find(p => String(p.id) === cardPostoId);
        if (!posto || !sdk) return;

        try {
            const pixel = sdk.Map.getPixelFromLonLat({
                lonLat: { lon: Number(posto.longitude), lat: Number(posto.latitude) }
            });
            const viewport = sdk.Map.getMapViewportElement();
            if (!viewport) return;

            const rect = viewport.getBoundingClientRect();
            const w = cardEl.offsetWidth  || 320;
            const h = cardEl.offsetHeight || 340;

            let left = rect.left + pixel.x - (w / 2);
            let top  = rect.top  + pixel.y - h - 20;

            if (left < 10) left = 10;
            if (left + w > window.innerWidth - 10) left = window.innerWidth - w - 10;
            if (top < 10) top = rect.top + pixel.y + 25;

            cardEl.style.left = left + 'px';
            cardEl.style.top  = top  + 'px';
        } catch (erro) {
            logErro('Erro posicionando card:', erro);
        }
    }

    function fecharCard() {
        cardPostoId = null;
        cardPosicaoManual = false;
        if (cardEl) cardEl.style.display = 'none';
    }

    /* ============================================================
       REQUEST
       ============================================================ */
    function requestAPI(url) {
        const now = Date.now();
        if (cache[url] && (now - cache[url].ts) < CACHE_TTL_MS) {
            return Promise.resolve(cache[url].data);
        }
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                headers: { 'Accept': 'application/json, text/plain, */*' },
                onload: function (r) {
                    if (r.status >= 200 && r.status < 300) {
                        try {
                            const data = JSON.parse(r.responseText);
                            cache[url] = { ts: Date.now(), data: data };
                            resolve(data);
                        } catch (e) { reject('JSON inválido: ' + url); }
                    } else { reject('HTTP ' + r.status + ': ' + url); }
                },
                onerror:   function () { reject('Erro de rede: ' + url); },
                ontimeout: function () { reject('Timeout: ' + url); }
            });
        });
    }

    /* ============================================================
       NORMALIZAR MUNICIPIO
       ============================================================ */
    function normalizarMunicipio(texto) {
        if (!texto) return '';
        return String(texto)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    }

    /* ============================================================
       BUSCA COM PAGINACAO AUTOMATICA
       ============================================================ */
    async function buscarPostos() {
        if (busy) return;

        const uf = document.getElementById('anpUf').value;
        const municipioRaw = document.getElementById('anpMunicipio').value;
        const municipio = normalizarMunicipio(municipioRaw);

        if (!uf) {
            setStatus('⚠️ Selecione uma UF.', 'orange');
            return;
        }

        busy = true;
        setStatus('Buscando postos na ANP...', '#007BFF');
        limparMapa(false);

        // NOVO: limpar relatório anterior
        limparRelatorio();

        let baseUrl = `${API_BASE}?uf=${encodeURIComponent(uf)}`;
        if (municipio) {
            baseUrl += `&municipio=${encodeURIComponent(municipio)}`;
        }

        try {
            let todos = [];
            let pagina = 1;
            let totalPaginas = 1;

            do {
                setStatus(`Buscando página ${pagina} de ${totalPaginas}...`, '#007BFF');
                const url = `${baseUrl}&numeropagina=${pagina}`;
                const dados = await requestAPI(url);

                let lista = [];
                if (Array.isArray(dados)) {
                    lista = dados;
                } else if (dados.data && Array.isArray(dados.data)) {
                    lista = dados.data;
                }

                if (dados.searchPageFilter && dados.searchPageFilter.totalPagina != null) {
                    totalPaginas = Number(dados.searchPageFilter.totalPagina) || 1;
                }

                todos = todos.concat(lista);
                pagina++;

                if (pagina > 100) break;

            } while (pagina <= totalPaginas);

            log(`Total de postos recebidos: ${todos.length} em ${totalPaginas} página(s)`);

            const total = processarLista(todos);
            desenharPontos();
            atualizarRelatorio(todos.length);
            renderizarListaSemCoordenadas();
            setStatus(`✅ ${total} postos georreferenciados + ${postosSemCoordenadas.length} sem coordenadas. Clique em um ponto.`, 'green');

        } catch (err) {
            logErro(err);
            setStatus('❌ Falha ao buscar (veja console).', 'red');
        } finally {
            busy = false;
        }
    }

    function limparMapa(showStatus) {
        if (sdk) {
            try { sdk.Map.removeAllFeaturesFromLayer({ layerName: LAYER_NAME }); } catch (e) {}
        }
        postos = [];
        postosSemCoordenadas = [];
        fecharCard();
        limparRelatorio();
        if (showStatus !== false) setStatus('Mapa limpo.', '#555');
    }

    /* ============================================================
       PROCESSAMENTO — ALTERADO
       ============================================================ */
    function processarLista(lista) {
        if (!lista || !lista.length) return 0;

        let total = 0;

        lista.forEach(item => {
            // 🔥 Validação robusta de coordenadas
            const latRaw = item.latitude;
            const lonRaw = item.longitude;

            const lat = (latRaw !== null && latRaw !== undefined && String(latRaw).trim() !== '')
                ? parseFloat(latRaw) : NaN;
            const lon = (lonRaw !== null && lonRaw !== undefined && String(lonRaw).trim() !== '')
                ? parseFloat(lonRaw) : NaN;

            const coordenadaValida =
                !isNaN(lat) && !isNaN(lon) &&
                lat >= -90 && lat <= 90 &&
                lon >= -180 && lon <= 180;

            const postoBase = {
                id:          'anp-' + (item.cnpj || item.codigoSIMP || (Date.now() + '_' + Math.random())),
                numero:      0, // será definido abaixo
                razaoSocial: item.razaoSocial || '',
                cnpj:        item.cnpj || '',
                autorizacao: item.autorizacao || '',
                endereco:    item.endereco || '',
                complemento: item.complemento || '',
                bairro:      item.bairro || '',
                cep:         item.cep || '',
                uf:          item.uf || '',
                municipio:   item.municipio || '',
                distribuidora: item.distribuidora || '',
                classe:      item.classe || '',
                statusSIGAF: item.statusSIGAF || '',
                produtos:    item.produtos || [],
                latitude:    coordenadaValida ? lat : null,
                longitude:   coordenadaValida ? lon : null
            };

            if (coordenadaValida) {
                postoBase.numero = postos.length + 1;
                postos.push(postoBase);
                total++;
            } else {
                // NOVO: guardar no array separado
                postosSemCoordenadas.push(postoBase);
            }
        });

        log('Postos georreferenciados:', postos.length);
        log('Postos sem coordenadas:', postosSemCoordenadas.length);
        return total;
    }

    /* ============================================================
       DESENHAR PONTOS
       ============================================================ */
    function desenharPontos() {
        if (!sdk || !camadaCriada || !postos.length) return;
        try { sdk.Map.removeAllFeaturesFromLayer({ layerName: LAYER_NAME }); } catch (e) {}

        const features = postos.map(p => ({
            id: p.id,
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
            properties: {
                numero: p.numero,
                razaoSocial: p.razaoSocial,
                municipio: p.municipio,
                uf: p.uf
            }
        }));

        try {
            sdk.Map.addFeaturesToLayer({ layerName: LAYER_NAME, features: features });
            sdk.Map.redrawLayer({ layerName: LAYER_NAME });
            log('Postos desenhados:', features.length);
        } catch (erro) {
            logErro('Erro desenhando postos:', erro);
        }
    }

    /* ============================================================
       NOVO: RELATÓRIO
       ============================================================ */
    function atualizarRelatorio(totalRecebidos) {
        const rel = document.getElementById('anpRelatorio');
        if (!rel) return;

        const totalGeo = postos.length;
        const totalSem = postosSemCoordenadas.length;
        const total = totalRecebidos || (totalGeo + totalSem);
        const cobertura = total > 0 ? Math.round((totalGeo / total) * 100) : 0;

        const elTotal = document.getElementById('anpTotal');
        const elGeo = document.getElementById('anpGeo');
        const elSem = document.getElementById('anpSemGeo');
        const elCob = document.getElementById('anpCobertura');

        if (elTotal) elTotal.textContent = total;
        if (elGeo) elGeo.textContent = totalGeo;
        if (elSem) elSem.textContent = totalSem;
        if (elCob) elCob.textContent = cobertura + '%';

        rel.style.display = 'block';

        // Mostrar/ocultar seção de sem coordenadas
        const section = document.getElementById('anpSemCoordSection');
        const count = document.getElementById('anpSemCoordCount');
        if (section) {
            section.style.display = totalSem > 0 ? 'block' : 'none';
        }
        if (count) {
            count.textContent = totalSem;
        }
    }

    function limparRelatorio() {
        const rel = document.getElementById('anpRelatorio');
        if (rel) rel.style.display = 'none';

        const section = document.getElementById('anpSemCoordSection');
        if (section) section.style.display = 'none';

        const list = document.getElementById('anpSemCoordList');
        if (list) list.innerHTML = '';

        const count = document.getElementById('anpSemCoordCount');
        if (count) count.textContent = '0';
    }

    /* ============================================================
       NOVO: LISTA DE POSTOS SEM COORDENADAS
       ============================================================ */
    function toggleSemCoord() {
        const body = document.getElementById('anpSemCoordBody');
        const toggle = document.getElementById('anpSemCoordToggle');
        if (!body) return;

        const visivel = body.style.display !== 'none';
        body.style.display = visivel ? 'none' : 'block';
        if (toggle) toggle.textContent = visivel ? '▼' : '▲';
    }

    function renderizarListaSemCoordenadas() {
        const list = document.getElementById('anpSemCoordList');
        if (!list) return;

        if (!postosSemCoordenadas.length) {
            list.innerHTML = '<div class="anp-semcoord-empty">Nenhum posto sem coordenadas.</div>';
            return;
        }

        list.innerHTML = postosSemCoordenadas.map((p, idx) => {
            const enderecoFormatado = formatarEndereco(p);
            return `
                <div class="anp-semcoord-card" data-idx="${idx}">
                    <div class="anp-semcoord-razao">${escapeHTML(p.razaoSocial || '—')}</div>
                    <div class="anp-semcoord-endereco">${escapeHTML(enderecoFormatado)}</div>
                    <div class="anp-semcoord-meta">
                        <span>${escapeHTML(p.municipio || '—')} / ${escapeHTML(p.uf || '—')}</span>
                        <span>CEP: ${escapeHTML(p.cep || '—')}</span>
                    </div>
                    <div class="anp-semcoord-cnpj">CNPJ: ${escapeHTML(formatarCNPJ(p.cnpj) || '—')}</div>
                    <button class="anp-btn copiar-endereco" data-idx="${idx}">📋 COPIAR ENDEREÇO</button>
                </div>
            `;
        }).join('');

        // Bind dos botões de copiar
        list.querySelectorAll('.copiar-endereco').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = Number(btn.dataset.idx);
                const posto = postosSemCoordenadas[idx];
                if (!posto) return;
                copiarTexto(formatarEndereco(posto), btn);
            });
        });
    }

    function formatarEndereco(p) {
        if (!p) return '';
        const partes = [
            p.endereco,
            p.complemento,
            p.bairro,
            p.municipio,
            p.uf
        ]
            .map(v => (v || '').trim())
            .filter(v => v && v !== 'null' && v !== 'undefined');

        // Remove duplicados consecutivos
        const unicos = [];
        partes.forEach(v => {
            if (!unicos.length || unicos[unicos.length - 1].toLowerCase() !== v.toLowerCase()) {
                unicos.push(v);
            }
        });

        return unicos.join(', ');
    }

    async function copiarTodosEnderecos() {
        if (!postosSemCoordenadas.length) return;

        const texto = postosSemCoordenadas
            .map(p => formatarEndereco(p))
            .filter(Boolean)
            .join('\n');

        const btn = document.getElementById('btnCopiarTodos');
        await copiarTexto(texto, btn);
    }

    async function copiarTexto(texto, botao) {
        if (!texto) return;

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(texto);
            } else {
                // Fallback: textarea + execCommand
                const ta = document.createElement('textarea');
                ta.value = texto;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }

            if (botao) {
                const original = botao.textContent;
                botao.textContent = '✅ COPIADO!';
                botao.classList.add('copiado');
                setTimeout(() => {
                    botao.textContent = original;
                    botao.classList.remove('copiado');
                }, 1500);
            }
        } catch (err) {
            logErro('Erro ao copiar:', err);
            if (botao) {
                const original = botao.textContent;
                botao.textContent = '❌ ERRO';
                setTimeout(() => { botao.textContent = original; }, 1500);
            }
        }
    }

    function escapeHTML(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /* ============================================================
       CSS
       ============================================================ */
    function criarCSS() {
        const style = document.createElement('style');
        style.textContent = `
            .anp-container { padding: 10px; font-family: Arial, Helvetica, sans-serif; color: #263238; }
            .anp-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; margin-bottom: 9px; border-radius: 8px; background: linear-gradient(135deg, #E65100, #BF360C); color: #fff; }
            .anp-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; }
            .anp-version { padding: 3px 6px; border-radius: 10px; background: rgba(255,255,255,.15); font-size: 9px; color: #ffe0b2; }
            .anp-form { background: #f8f9fa; padding: 10px; border-radius: 6px; border: 1px solid #ddd; margin-bottom: 10px; }
            .anp-label { display: block; font-size: 10px; font-weight: 700; color: #555; margin-bottom: 4px; margin-top: 8px; }
            .anp-label:first-child { margin-top: 0; }
            .anp-select, .anp-input { width: 100%; box-sizing: border-box; padding: 7px; border: 1px solid #ccc; border-radius: 5px; font-size: 11px; margin-bottom: 4px; }
            .anp-hint { font-size: 9px; color: #888; margin-bottom: 8px; line-height: 1.3; }
            .anp-btn { width: 100%; padding: 9px; border: 0; border-radius: 6px; cursor: pointer; font-size: 10px; font-weight: 700; margin-bottom: 6px; transition: filter .15s; }
            .anp-btn.buscar { background: #E65100; color: #fff; }
            .anp-btn.limpar { background: #f8f9fa; color: #333; border: 1px solid #ccc; }
            .anp-btn:hover { filter: brightness(.95); }
            .anp-status { margin-top: 8px; padding: 7px 8px; border: 1px solid #e0e0e0; border-radius: 6px; background: #fafafa; color: #616161; font-size: 10px; text-align: center; }
            .anp-ajuda { margin-top: 8px; padding: 7px; border: 1px solid #ffe0a3; border-radius: 6px; background: #fff8e1; color: #6d4c41; font-size: 9px; line-height: 1.45; }

            /* RELATÓRIO */
            .anp-relatorio { margin-top: 10px; padding: 8px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fff; }
            .anp-relatorio-titulo { font-size: 10px; font-weight: 700; color: #37474f; margin-bottom: 6px; text-align: center; }
            .anp-relatorio-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
            .anp-relatorio-item { text-align: center; padding: 6px 2px; border-radius: 5px; background: #f5f5f5; border: 1px solid #e0e0e0; }
            .anp-relatorio-item b { display: block; font-size: 14px; line-height: 16px; color: #263238; }
            .anp-relatorio-item span { display: block; font-size: 7px; font-weight: 700; color: #757575; margin-top: 2px; }
            .anp-relatorio-item.verde { background: #e8f5e9; border-color: #c8e6c9; }
            .anp-relatorio-item.verde b { color: #2e7d32; }
            .anp-relatorio-item.amarelo { background: #fff8e1; border-color: #ffe082; }
            .anp-relatorio-item.amarelo b { color: #e65100; }
            .anp-relatorio-item.azul { background: #e3f2fd; border-color: #bbdefb; }
            .anp-relatorio-item.azul b { color: #1565c0; }

            /* LISTA DE SEM COORDENADAS */
            .anp-semcoord-section { margin-top: 10px; border: 1px solid #ffe082; border-radius: 8px; background: #fff8e1; overflow: hidden; }
            .anp-semcoord-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: linear-gradient(135deg, #FF9800, #E65100); color: #fff; cursor: pointer; font-size: 10px; font-weight: 700; user-select: none; }
            .anp-semcoord-header:hover { filter: brightness(1.05); }
            .anp-semcoord-toggle { font-size: 11px; }
            .anp-semcoord-body { padding: 8px; }
            .anp-semcoord-list { max-height: 320px; overflow-y: auto; margin-top: 6px; }
            .anp-semcoord-card { padding: 7px; margin-bottom: 6px; border: 1px solid #ffe0b2; border-radius: 6px; background: #fff; font-size: 10px; }
            .anp-semcoord-card:last-child { margin-bottom: 0; }
            .anp-semcoord-razao { font-weight: 700; color: #263238; margin-bottom: 3px; }
            .anp-semcoord-endereco { color: #424242; margin-bottom: 4px; line-height: 1.3; word-break: break-word; }
            .anp-semcoord-meta { display: flex; justify-content: space-between; font-size: 9px; color: #757575; margin-bottom: 3px; }
            .anp-semcoord-cnpj { font-size: 9px; color: #757575; margin-bottom: 5px; }
            .anp-semcoord-empty { text-align: center; padding: 15px; color: #9e9e9e; font-size: 10px; }
            .anp-btn.copiar-todos { background: #FF9800; color: #fff; font-size: 9px; padding: 7px; margin-bottom: 6px; }
            .anp-btn.copiar-endereco { background: #fff; color: #E65100; border: 1px solid #FF9800; font-size: 9px; padding: 5px; margin-bottom: 0; }
            .anp-btn.copiado { background: #2e7d32 !important; color: #fff !important; border-color: #2e7d32 !important; }

            /* CARD FLUTUANTE */
            #anp-card { position: fixed; z-index: 999999; display: none; max-width: calc(100vw - 20px); pointer-events: auto; font-family: "Helvetica Neue", Arial, Helvetica, sans-serif; font-size: 12px; color: #333; }
            #anp-card .anp-card-wrapper { padding: 1px; border-radius: 12px; background: #fff; box-shadow: 0 3px 14px rgba(0,0,0,.4); overflow: hidden; }
            #anp-card .anp-card-drag-handle { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 6px 10px; background: linear-gradient(135deg, #E65100, #BF360C); color: #fff; font-size: 10px; font-weight: 700; cursor: grab; user-select: none; transition: filter .15s; }
            #anp-card .anp-card-drag-handle:hover { filter: brightness(1.1); }
            #anp-card .anp-card-drag-handle:active { cursor: grabbing; }
            #anp-card .anp-card-drag-dots { font-size: 14px; opacity: .85; letter-spacing: -2px; }
            #anp-card .anp-card-drag-label { opacity: .9; text-transform: uppercase; letter-spacing: .5px; }
            #anp-card .anp-card-content { margin: 13px 19px; line-height: 1.4; width: 290px; max-width: 80vw; max-height: 60vh; overflow-y: auto; }
            #anp-card .anp-card-title { text-align: center; font-weight: bold; margin-bottom: 12px; font-size: 13px; }
            #anp-card .anp-card-row { display: flex; margin-bottom: 4px; }
            #anp-card .anp-card-label { width: 41.66%; text-align: right; padding-right: 5px; color: #555; flex-shrink: 0; }
            #anp-card .anp-card-value { width: 58.33%; text-align: left; font-weight: bold; color: #000; word-break: break-word; }
            #anp-card .anp-card-tip { position: absolute; left: 50%; margin-left: -8px; bottom: -8px; width: 16px; height: 16px; transform: rotate(45deg); background: #fff; box-shadow: 0 3px 14px rgba(0,0,0,.4); pointer-events: none; }
            #anp-card .anp-card-close { position: absolute; top: 0; right: 0; padding: 4px 8px; color: #ffffff; text-decoration: none; font: bold 16px/14px Tahoma, Verdana, sans-serif; cursor: pointer; z-index: 2; opacity: .8; transition: opacity .15s; }
            #anp-card .anp-card-close:hover { opacity: 1; }
        `;
        document.head.appendChild(style);
    }

    /* ============================================================
       START
       ============================================================ */
    iniciarSDK();
})();
