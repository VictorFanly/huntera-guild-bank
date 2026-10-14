
const SUPABASE_URL = "https://atuwddnsdhchylxgcnja.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_Z386qHMVm7XfmZgP5uiWyg_w9l0r41T";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLIC_KEY
);

const elementos = {
    connectionStatus: document.getElementById("connection-status"),
    connectionText: document.getElementById("connection-text"),
    searchInput: document.getElementById("search-input"),
    monsterFilter: document.getElementById("monster-filter"),
    monsterFilterButton: document.getElementById("monster-filter-button"),
    monsterFilterOptions: document.getElementById("monster-filter-options"),
    monsterFilterSummary: document.getElementById("monster-filter-summary"),
    monsterOptionsList: document.getElementById("monster-options-list"),
    clearMonsterSelection: document.getElementById("clear-monster-selection"),
    itemGrid: document.getElementById("item-grid"),
    itemCount: document.getElementById("item-count"),
    message: document.getElementById("message"),
    emptyState: document.getElementById("empty-state"),
    clearFilters: document.getElementById("clear-filters"),
};

let itens = [];
let monstrosAtivos = [];
let carregando = true;
let erroCarregamento = false;

const monstrosSelecionados = new Set();
const LIMITE_MONSTROS_VISIVEIS = 3;

function normalizar(texto) {
    return String(texto ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .trim();
}

function definirConexao(estado, mensagem) {
    elementos.connectionStatus.classList.remove("online", "offline");

    if (estado === "online") {
        elementos.connectionStatus.classList.add("online");
    }

    if (estado === "offline") {
        elementos.connectionStatus.classList.add("offline");
    }

    elementos.connectionText.textContent = mensagem;
}

function mostrarMensagem(texto, tipo = "") {
    elementos.message.textContent = texto;
    elementos.message.className = "message";

    if (tipo) {
        elementos.message.classList.add(tipo);
    }

    elementos.message.hidden = !texto;
}


function obterMonstros(item) {
    const relacoes = item.item_monsters || [];

    return relacoes
        .map(relacao => relacao.monsters)
        .filter(monstro => monstro && monstro.visible === true)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}


async function carregarItens() {
    carregando = true;
    erroCarregamento = false;

    mostrarMensagem("Carregando catálogo...");
    elementos.emptyState.hidden = true;
    elementos.itemGrid.replaceChildren();

    try {
        const [respostaItens, respostaMonstros] = await Promise.all([
            supabaseClient
                .from("items")
                .select(`
                    id,
                    name,
                    image_url,
                    source_url,
                    item_monsters (
                        monster_id,
                        monsters (
                            id,
                            name,
                            visible
                        )
                    )
                `)
                .eq("visible", true)
                .order("name", { ascending: true })
                .limit(1000),

            supabaseClient
                .from("monsters")
                .select("id, name")
                .eq("visible", true)
                .order("name", { ascending: true })
                .limit(2000)
        ]);

        if (respostaItens.error) {
            throw respostaItens.error;
        }

        if (respostaMonstros.error) {
            throw respostaMonstros.error;
        }

        itens = respostaItens.data ?? [];
        monstrosAtivos = respostaMonstros.data ?? [];

        preencherFiltroMonstros();

        definirConexao("online", "Conectado");

        carregando = false;
        renderizarItens();

    } catch (erro) {
        console.error("Erro ao carregar catálogo:", erro);

        itens = [];
        monstrosAtivos = [];
        carregando = false;
        erroCarregamento = true;

        definirConexao("offline", "Falha na conexão");

        elementos.itemCount.textContent = "0";
        elementos.itemGrid.replaceChildren();
        elementos.emptyState.hidden = true;

        mostrarMensagem(
            "Não foi possível carregar os itens. Verifique a configuração do Supabase e tente novamente.",
            "error"
        );
    }
}

function obterTodosMonstros() {
    // A lista vem da tabela monsters e contém somente visible = true.
    // Um monstro ativo pode aparecer no filtro mesmo antes de receber drops.
    return [...monstrosAtivos].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR")
    );
}

function preencherFiltroMonstros() {
    const monstros = obterTodosMonstros();

    const idsExistentes = new Set(
        monstros.map((monstro) => String(monstro.id))
    );

    // Remove seleções de monstros que deixaram de estar ativos.
    for (const id of monstrosSelecionados) {
        if (!idsExistentes.has(id)) {
            monstrosSelecionados.delete(id);
        }
    }

    elementos.monsterOptionsList.replaceChildren();

    for (const monstro of monstros) {
        const id = String(monstro.id);

        const label = document.createElement("label");
        label.className = "monster-option";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = id;
        checkbox.checked = monstrosSelecionados.has(id);

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                monstrosSelecionados.add(id);
            } else {
                monstrosSelecionados.delete(id);
            }

            atualizarResumoFiltro();
            renderizarItens();
        });

        const nome = document.createElement("span");
        nome.textContent = monstro.name;

        label.append(checkbox, nome);
        elementos.monsterOptionsList.appendChild(label);
    }

    atualizarResumoFiltro();
}

function atualizarResumoFiltro() {
    const total = monstrosSelecionados.size;

    if (total === 0) {
        elementos.monsterFilterSummary.textContent = "Todas as criaturas";

    } else if (total === 1) {
        const id = [...monstrosSelecionados][0];

        const monstro = obterTodosMonstros().find(
            (m) => String(m.id) === id
        );

        elementos.monsterFilterSummary.textContent = monstro
            ? monstro.name
            : "1 criatura selecionada";

    } else {
        elementos.monsterFilterSummary.textContent =
            `${total} criaturas selecionadas`;
    }

    elementos.monsterFilterButton.setAttribute(
        "aria-expanded",
        String(!elementos.monsterFilterOptions.hidden)
    );
}

function alternarFiltroMonstros() {
    elementos.monsterFilterOptions.hidden =
        !elementos.monsterFilterOptions.hidden;

    elementos.monsterFilterButton.setAttribute(
        "aria-expanded",
        String(!elementos.monsterFilterOptions.hidden)
    );
}

function criarTagMonstro(monstro) {
    const tag = document.createElement("span");

    tag.className = "monster-tag";
    tag.textContent = monstro.name;
    tag.title = monstro.name;

    return tag;
}

function criarListaMonstros(item, monstros) {
    const area = document.createElement("div");
    area.className = "monster-list-wrap";

    const lista = document.createElement("div");
    lista.className = "monster-list";

    const nomesCompletos = monstros
        .map((monstro) => monstro.name)
        .join(", ");

    lista.title = nomesCompletos || "Não informado";

    if (monstros.length === 0) {
        const semMonstro = document.createElement("span");

        semMonstro.className = "monster-tag";
        semMonstro.textContent = "Não informado";

        lista.appendChild(semMonstro);
        area.appendChild(lista);

        return area;
    }

    const expandido = document.createElement("div");
    expandido.className = "monster-list-expanded";
    expandido.hidden = true;

    const compactos = monstros.slice(0, LIMITE_MONSTROS_VISIVEIS);

    for (const monstro of compactos) {
        lista.appendChild(criarTagMonstro(monstro));
    }

    for (const monstro of monstros) {
        expandido.appendChild(criarTagMonstro(monstro));
    }

    if (monstros.length > LIMITE_MONSTROS_VISIVEIS) {
        const botao = document.createElement("button");

        botao.type = "button";
        botao.className = "monster-expand-button";

        botao.textContent =
            `+${monstros.length - LIMITE_MONSTROS_VISIVEIS} monstros`;

        botao.setAttribute("aria-expanded", "false");
        botao.title = `Ver todos: ${nomesCompletos}`;

        botao.addEventListener("click", () => {
            const estaExpandido = !expandido.hidden;

            expandido.hidden = estaExpandido;
            lista.hidden = !estaExpandido;

            botao.textContent = estaExpandido
                ? `+${monstros.length - LIMITE_MONSTROS_VISIVEIS} monstros`
                : "Mostrar menos";

            botao.setAttribute(
                "aria-expanded",
                String(!estaExpandido)
            );
        });

        area.append(lista, botao, expandido);

    } else {
        area.appendChild(lista);
    }

    return area;
}

function criarCartao(item) {
    const cartao = document.createElement("article");
    cartao.className = "item-card";

    const areaImagem = document.createElement("div");
    areaImagem.className = "item-image-area";

    if (item.image_url) {
        const imagem = document.createElement("img");

        imagem.className = "item-image";
        imagem.src = item.image_url;
        imagem.alt = item.name;
        imagem.loading = "lazy";
        imagem.decoding = "async";

        imagem.addEventListener("error", () => {
            const fallback = document.createElement("div");

            fallback.className = "item-image-fallback";
            fallback.textContent = "✦";
            fallback.setAttribute(
                "aria-label",
                "Imagem indisponível"
            );

            imagem.replaceWith(fallback);
        }, { once: true });

        areaImagem.appendChild(imagem);

    } else {
        const fallback = document.createElement("div");

        fallback.className = "item-image-fallback";
        fallback.textContent = "✦";
        fallback.setAttribute(
            "aria-label",
            "Imagem indisponível"
        );

        areaImagem.appendChild(fallback);
    }

    const conteudo = document.createElement("div");
    conteudo.className = "item-content";

    const nome = document.createElement("h3");

    nome.className = "item-name";
    nome.textContent = item.name;
    nome.title = item.name;

    if (item.source_url) {
        nome.classList.add("item-name-link");
        nome.title = `${item.name} — abrir página de origem`;

        nome.addEventListener("click", () => {
            window.open(
                item.source_url,
                "_blank",
                "noopener,noreferrer"
            );
        });
    }

    const divisor = document.createElement("div");
    divisor.className = "item-divider";

    const rotulo = document.createElement("span");
    rotulo.className = "drop-label";
    rotulo.textContent = "Drop de";

    const monstros = obterMonstros(item);
    const listaMonstros = criarListaMonstros(item, monstros);

    conteudo.append(nome, divisor, rotulo, listaMonstros);
    cartao.append(areaImagem, conteudo);

    return cartao;
}

function renderizarItens() {
    if (carregando || erroCarregamento) {
        return;
    }

    const pesquisa = normalizar(elementos.searchInput.value);
    const selecionados = new Set(monstrosSelecionados);

    const filtrados = itens.filter((item) => {
        const nomeItem = normalizar(item.name);
        const monstros = obterMonstros(item);

        const correspondePesquisa =
            !pesquisa ||
            nomeItem.includes(pesquisa) ||
            monstros.some((monstro) =>
                normalizar(monstro.name).includes(pesquisa)
            );

        // Lógica OU: mostra drops de qualquer monstro selecionado.
        const correspondeMonstro =
            selecionados.size === 0 ||
            monstros.some((monstro) =>
                selecionados.has(String(monstro.id))
            );

        return correspondePesquisa && correspondeMonstro;
    });

    elementos.itemCount.textContent = String(filtrados.length);
    elementos.itemGrid.replaceChildren();

    if (filtrados.length > 0) {
        const fragmento = document.createDocumentFragment();

        for (const item of filtrados) {
            fragmento.appendChild(criarCartao(item));
        }

        elementos.itemGrid.appendChild(fragmento);
    }

    elementos.emptyState.hidden = filtrados.length !== 0;

    if (itens.length === 0) {
        mostrarMensagem(
            "Nenhum item está visível no catálogo. Habilite itens no Supabase para exibi-los aqui."
        );
    } else {
        mostrarMensagem("");
    }
}

function limparFiltros() {
    elementos.searchInput.value = "";
    monstrosSelecionados.clear();

    elementos.monsterOptionsList
        .querySelectorAll('input[type="checkbox"]')
        .forEach((checkbox) => {
            checkbox.checked = false;
        });

    atualizarResumoFiltro();
    renderizarItens();
}

elementos.searchInput.addEventListener(
    "input",
    renderizarItens
);

elementos.monsterFilterButton.addEventListener(
    "click",
    alternarFiltroMonstros
);

elementos.clearMonsterSelection.addEventListener("click", () => {
    monstrosSelecionados.clear();

    elementos.monsterOptionsList
        .querySelectorAll('input[type="checkbox"]')
        .forEach((checkbox) => {
            checkbox.checked = false;
        });

    atualizarResumoFiltro();
    renderizarItens();
});

elementos.clearFilters.addEventListener(
    "click",
    limparFiltros
);

document.addEventListener("click", (evento) => {
    if (!elementos.monsterFilter.contains(evento.target)) {
        elementos.monsterFilterOptions.hidden = true;

        elementos.monsterFilterButton.setAttribute(
            "aria-expanded",
            "false"
        );
    }
});

document.addEventListener("keydown", (evento) => {
    if (
        evento.key === "Escape" &&
        !elementos.monsterFilterOptions.hidden
    ) {
        elementos.monsterFilterOptions.hidden = true;

        elementos.monsterFilterButton.setAttribute(
            "aria-expanded",
            "false"
        );

        elementos.monsterFilterButton.focus();
    }
});

carregarItens();
