// mockApi.js — servidor de mock para desenvolvimento sem backend. Intercepta o
// window.fetch e responde aos endpoints /api/v1/* com dados fictícios, permitindo
// testar login e navegar pelas telas. Ativado por flag (ver main.jsx); não altera
// a lógica real de services/api.js.

const TOKENS = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
};

const BANKER = { id: 'bk-1', name: 'Operador Mycon', email: 'operador@mycon.com.br' };

function buildHistory(base) {
  const now = new Date();
  return Array.from({ length: 12 }).map((_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - idx), 1);
    const factor = 0.9 + (idx / 11) * 0.2;
    return {
      snapshotDate: d.toISOString(),
      avgMonthlyIncome3m: (base * factor).toFixed(2),
    };
  });
}

const CLIENTS = [
  {
    id: '1',
    name: 'Fernanda Rocha',
    email: 'fernanda.rocha@email.com',
    cpf: '12345678901',
    active: true,
    akropoliLinkId: 'akr-1001',
    insights: {
      avgMonthlyIncome12m: '8650.00',
      avgMonthlyIncome3m: '9120.00',
      avgMonthlyIncome: '8800.00',
      debtToIncomeRatio: '0.28',
      healthScore: 82,
      savingsCapacity3m: '1740.00',
      lastSyncAt: new Date().toISOString(),
      history: buildHistory(9000),
    },
  },
  {
    id: '2',
    name: 'Carlos Mendes',
    email: 'carlos.mendes@email.com',
    cpf: '98765432100',
    active: true,
    akropoliLinkId: 'akr-1002',
    insights: {
      avgMonthlyIncome12m: '5200.00',
      avgMonthlyIncome3m: '4780.00',
      avgMonthlyIncome: '5000.00',
      debtToIncomeRatio: '0.41',
      healthScore: 64,
      savingsCapacity3m: '620.00',
      lastSyncAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      history: buildHistory(5000),
    },
  },
  {
    id: '3',
    name: 'Juliana Prado',
    email: 'juliana.prado@email.com',
    cpf: '45678912300',
    active: false,
    akropoliLinkId: null,
    insights: {
      avgMonthlyIncome12m: '12300.00',
      avgMonthlyIncome3m: '13100.00',
      avgMonthlyIncome: '12600.00',
      debtToIncomeRatio: '0.19',
      healthScore: 91,
      savingsCapacity3m: '3200.00',
      lastSyncAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      history: buildHistory(12500),
    },
  },
];

function clientSummary(c) {
  const { insights, ...summary } = c;
  return summary;
}

function jsonResponse(data, status = 200) {
  const body = status === 204 ? '' : JSON.stringify(data);
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function resolve(method, pathname) {
  if (method === 'POST' && pathname === '/api/v1/auth/login') return jsonResponse(TOKENS);
  if (method === 'POST' && pathname === '/api/v1/auth/refresh') return jsonResponse(TOKENS);
  if (method === 'POST' && pathname === '/api/v1/auth/logout') return jsonResponse(null, 204);
  if (method === 'GET' && pathname === '/api/v1/bankers/me') return jsonResponse(BANKER);

  if (method === 'GET' && pathname === '/api/v1/clients') {
    const content = CLIENTS.map(clientSummary);
    return jsonResponse({
      content,
      totalElements: content.length,
      totalPages: 1,
      number: 0,
      size: content.length,
    });
  }

  const detail = pathname.match(/^\/api\/v1\/clients\/([^/]+)$/);
  if (method === 'GET' && detail) {
    const c = CLIENTS.find((x) => x.id === detail[1]);
    return c ? jsonResponse(clientSummary(c)) : jsonResponse({ message: 'Cliente não encontrado' }, 404);
  }

  const insights = pathname.match(/^\/api\/v1\/clients\/([^/]+)\/insights$/);
  if (method === 'GET' && insights) {
    const c = CLIENTS.find((x) => x.id === insights[1]);
    return c ? jsonResponse(c.insights) : jsonResponse({ message: 'Cliente não encontrado' }, 404);
  }

  if (method === 'GET' && /\/category-breakdown$/.test(pathname)) {
    return jsonResponse([]);
  }

  return jsonResponse({ message: `Mock sem rota para ${method} ${pathname}` }, 404);
}

export function installMock() {
  if (typeof window === 'undefined' || window.__mockInstalled) return;
  window.__mockInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();

    let pathname;
    try {
      pathname = new URL(url, window.location.origin).pathname;
    } catch {
      pathname = url;
    }

    if (pathname.startsWith('/api/v1/')) {
      await new Promise((r) => setTimeout(r, 250));
      return resolve(method, pathname);
    }

    return originalFetch(input, init);
  };

  // eslint-disable-next-line no-console
  console.info('[mockApi] Backend mockado ativo — qualquer e-mail/senha faz login.');
}
