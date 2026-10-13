
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
    itemGrid: document.getElementById("item-grid"),
    itemCount: document.getElementById("item-count"),
    message: document.getElementById("message"),
    emptyState: document.getElementById("empty-state"),
    clearFilters: document.getElementById("clear-filters"),
};

let itens = [];
let carregando = true;
let erroCarregamento = false;

function normalizar(texto) {
    return String(texto ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .trim();
}

function definirConexao(estado, mensagem) {
    elementos.connectionStatus.classList.remove(
        "online",
        "offline"
    );

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
    const relacoes = Array.isArray(item.item_monsters)
        ? item.item_monsters
        : [];

    return relacoes
        .map((relacao) => relacao.monsters)
        .filter((monstro) => monstro && monstro.name)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

async function carregarItens() {
    carregando = true;
    erroCarregamento = false;

    mostrarMensagem("Carregando catálogo...");
    elementos.emptyState.hidden = true;
    elementos.itemGrid.replaceChildren();

    try {
        const { data, error } = await supabaseClient
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
                        name
                    )
                )
            `)
            .eq("visible", true)
            .order("name", { ascending: true })
            .limit(1000);

        if (error) {
            throw error;
        }

        itens = data ?? [];

        preencherFiltroMonstros();
        definirConexao("online", "Conectado");

        carregando = false;
        renderizarItens();

    } catch (erro) {
        console.error("Erro ao carregar catálogo:", erro);

        itens = [];
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

function preencherFiltroMonstros() {
    const valorAnterior = elementos.monsterFilter.value;

    const monstros = new Map();

    for (const item of itens) {
        for (const monstro of obterMonstros(item)) {
            monstros.set(String(monstro.id), monstro);
        }
    }

    elementos.monsterFilter.replaceChildren();

    const opcaoPadrao = document.createElement("option");
    opcaoPadrao.value = "";
    opcaoPadrao.textContent = "Todas as criaturas";

    elementos.monsterFilter.appendChild(opcaoPadrao);

    const lista = [...monstros.values()].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR")
    );

    for (const monstro of lista) {
        const opcao = document.createElement("option");

        opcao.value = String(monstro.id);
        opcao.textContent = monstro.name;

        elementos.monsterFilter.appendChild(opcao);
    }

    const aindaExiste = [...elementos.monsterFilter.options]
        .some((opcao) => opcao.value === valorAnterior);

    elementos.monsterFilter.value = aindaExiste
        ? valorAnterior
        : "";
}

function criarTagMonstro(monstro) {
    const tag = document.createElement("span");

    tag.className = "monster-tag";
    tag.textContent = monstro.name;
    tag.title = monstro.name;

    return tag;
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
            fallback.setAttribute("aria-label", "Imagem indisponível");

            imagem.replaceWith(fallback);
        }, { once: true });

        areaImagem.appendChild(imagem);
    } else {
        const fallback = document.createElement("div");

        fallback.className = "item-image-fallback";
        fallback.textContent = "✦";
        fallback.setAttribute("aria-label", "Imagem indisponível");

        areaImagem.appendChild(fallback);
    }

    const conteudo = document.createElement("div");
    conteudo.className = "item-content";

    const nome = document.createElement("h3");
    nome.className = "item-name";
    nome.textContent = item.name;
    nome.title = item.name;

    if (item.source_url) {
        nome.style.cursor = "pointer";
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

    const listaMonstros = document.createElement("div");
    listaMonstros.className = "monster-list";

    const monstros = obterMonstros(item);

    if (monstros.length > 0) {
        for (const monstro of monstros) {
            listaMonstros.appendChild(criarTagMonstro(monstro));
        }
    } else {
        const semMonstro = document.createElement("span");

        semMonstro.className = "monster-tag";
        semMonstro.textContent = "Não informado";

        listaMonstros.appendChild(semMonstro);
    }

    conteudo.append(
        nome,
        divisor,
        rotulo,
        listaMonstros
    );

    cartao.append(areaImagem, conteudo);

    return cartao;
}

function renderizarItens() {
    if (carregando || erroCarregamento) {
        return;
    }

    const pesquisa = normalizar(elementos.searchInput.value);
    const monstroSelecionado = elementos.monsterFilter.value;

    const filtrados = itens.filter((item) => {
        const nomeItem = normalizar(item.name);
        const monstros = obterMonstros(item);

        const correspondePesquisa =
            !pesquisa ||
            nomeItem.includes(pesquisa) ||
            monstros.some((monstro) =>
                normalizar(monstro.name).includes(pesquisa)
            );

        const correspondeMonstro =
            !monstroSelecionado ||
            monstros.some(
                (monstro) =>
                    String(monstro.id) === monstroSelecionado
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
    elementos.monsterFilter.value = "";

    renderizarItens();
}

elementos.searchInput.addEventListener(
    "input",
    renderizarItens
);

elementos.monsterFilter.addEventListener(
    "change",
    renderizarItens
);

elementos.clearFilters.addEventListener(
    "click",
    limparFiltros
);

carregarItens();
