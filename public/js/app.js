// public/js/app.js
// Script principal da Aula 04 - paginação via /api/users?offset=..&limit=..

document.addEventListener("DOMContentLoaded", async () => {
  // Elementos da UI
  const usersEl = document.getElementById("users");
  const paginationEl = document.getElementById("pagination");

  // Estado inicial (requisito 3)
  const state = {
    currentPage: 1,
    pageSize: 10,    // tamanho fixo de 10 itens por página
    totalItems: null // será preenchido ao ler a API
  };

  // --- Helpers ---
  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (s) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s];
    });
  }

  function showLoading() {
    usersEl.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border" role="status"><span class="visually-hidden">Carregando...</span></div>
      </div>`;
  }

  // --- Função que chama a API ---
  async function fetchUsers(page = 1) {
    const offset = (page - 1) * state.pageSize;
    const limit = state.pageSize;

    showLoading();

    try {
      // Faz a requisição GET em /api/users com offset e limit
      const response = await fetch(`/api/users?offset=${offset}&limit=${limit}`, {
        headers: { "Accept": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}`);
      }

      // tenta ler JSON
      const data = await response.json();

      // --- interpretar/normalizar a resposta (requisito 5) ---
      // Procuramos o array de usuários em várias chaves comuns
      let users = null;
      if (Array.isArray(data)) {
        users = data;
      } else if (Array.isArray(data.users)) {
        users = data.users;
      } else if (Array.isArray(data.data)) {
        users = data.data;
      } else if (Array.isArray(data.results)) {
        users = data.results;
      } else if (Array.isArray(data.items)) {
        users = data.items;
      } else {
        // tenta encontrar a primeira propriedade que seja array
        const foundArray = Object.values(data).find(v => Array.isArray(v));
        users = foundArray || [];
      }

      // tenta obter total de itens
      let total = null;
      // cabeçalho X-Total-Count é comum em alguns mocks/APIs
      const headerTotal = response.headers.get("X-Total-Count") || response.headers.get("x-total-count");
      if (headerTotal) total = Number(headerTotal);

      // outras variações no corpo
      if (data.total != null) total = Number(data.total);
      if (data.totalCount != null) total = Number(data.totalCount);
      if (data.count != null) total = Number(data.count);
      if (data.meta && (data.meta.total != null || data.meta.totalCount != null)) {
        total = Number(data.meta.total || data.meta.totalCount);
      }
      // se API retornar totalPages, podemos derivar total aproximado:
      if (!total && data.totalPages != null) {
        total = Number(data.totalPages) * state.pageSize;
      }

      // Guardo total (pode ser null se API não fornecer)
      state.totalItems = Number.isFinite(total) ? total : null;

      // Renderiza lista e paginação (requisitos 6 e 7)
      renderUsers(users);
      renderPagination(state.currentPage);

    } catch (err) {
      usersEl.innerHTML = `<div class="alert alert-danger">Erro ao carregar usuários: ${escapeHtml(err.message)}</div>`;
      paginationEl.innerHTML = "";
      console.error(err);
    }
  }

  // --- Renderizar usuários (requisito 6) ---
  function renderUsers(users) {
    usersEl.innerHTML = ""; // limpa

    if (!users || users.length === 0) {
      usersEl.innerHTML = `<div class="text-muted">Nenhum usuário nesta página.</div>`;
      return;
    }

    // para cada usuário, renderiza um card simples.
    // Tenta usar campos comuns (name, fullName, username, email), cai para JSON se nada conhecido.
    users.forEach(user => {
      const name = user.name || user.fullName || user.nome || user.username || user.firstName || "(sem nome)";
      const email = user.email || user.mail || user.emailAddress || "";
      const id = user.id || user._id || "";

      const card = document.createElement("div");
      card.className = "card mb-2";
      card.innerHTML = `
        <div class="card-body">
          <h5 class="card-title">${escapeHtml(name)}</h5>
          ${email ? `<h6 class="card-subtitle mb-2 text-muted">${escapeHtml(email)}</h6>` : ""}
          <p class="card-text"><small class="text-muted">ID: ${escapeHtml(String(id))}</small></p>
        </div>
      `;
      usersEl.appendChild(card);
    });
  }

  // --- Renderizar paginação (requisito 7) ---
  function renderPagination(currentPage) {
    paginationEl.innerHTML = "";

    // se temos totalItems, calcula totalPages; caso contrário, cria paginação básica (1..current+2)
    let totalPages = 1;
    if (state.totalItems && Number.isFinite(state.totalItems)) {
      totalPages = Math.max(1, Math.ceil(state.totalItems / state.pageSize));
    } else {
      // fallback: mostramos algumas páginas próximas (não sabemos total)
      totalPages = Math.max(1, currentPage + 2);
    }

    // Função de criação de link
    function createPageItem(label, page, disabled = false, active = false) {
      const li = document.createElement("li");
      li.className = "page-item" + (disabled ? " disabled" : "") + (active ? " active" : "");
      const a = document.createElement("a");
      a.className = "page-link";
      a.href = "#";
      a.textContent = label;
      a.addEventListener("click", (e) => {
        e.preventDefault(); // SEM ATUALIZAR A PÁGINA (requisito 8)
        if (disabled || page === state.currentPage) return;
        gotoPage(page);
      });
      li.appendChild(a);
      return li;
    }

    // Prev
    paginationEl.appendChild(createPageItem("Anterior", Math.max(1, currentPage - 1), currentPage === 1));

    // Números (1 .. totalPages)
    for (let p = 1; p <= totalPages; p++) {
      paginationEl.appendChild(createPageItem(String(p), p, false, p === currentPage));
    }

    // Next
    const lastPage = totalPages;
    const nextDisabled = state.totalItems && Number.isFinite(state.totalItems) ? (currentPage >= lastPage) : false;
    paginationEl.appendChild(createPageItem("Próximo", Math.min(lastPage, currentPage + 1), nextDisabled));
  }

  // --- Navegar para página (requisito 8) ---
  async function gotoPage(page) {
    state.currentPage = page;
    await fetchUsers(page);
    // opcional: rolar para topo
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // --- Inicializa primeira página (requisito 4) ---
  await fetchUsers(state.currentPage);
});
