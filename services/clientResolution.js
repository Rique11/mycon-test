/**
 * clientResolution.js — resolução do cliente da API Akropoli correspondente a um
 * caso da POC (busca por CPF, e-mail ou nome), criação do cliente quando necessário
 * e montagem da fila operacional combinando clientes reais da API com casos locais.
 *
 * Limitação conhecida: o fallback de busca lista apenas os 100 primeiros clientes
 * e casa por nome — homônimos podem vincular o caso ao cliente errado.
 * O fix correto é um endpoint de busca por CPF na API.
 */

import { clientsApi } from './api';
import { maskCpf, onlyDigits } from '../lib/format';

function getArrayFromPage(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.content)) return response.content;
  return [];
}

export function getClientId(client) {
  return client?.id ?? client?.clientId ?? client?.uuid ?? null;
}

function isSameCpf(client, cpf) {
  return onlyDigits(client?.cpf) === onlyDigits(cpf);
}

function isSameEmail(client, email) {
  return email && String(client?.email || '').toLowerCase() === String(email).toLowerCase();
}

function isSameName(client, name) {
  return name && String(client?.name || '').trim().toLowerCase() === String(name).trim().toLowerCase();
}

function getClientResolution(clients, caseItem) {
  const byCpf = clients.filter((client) => onlyDigits(caseItem?.cpf) && isSameCpf(client, caseItem?.cpf));
  if (byCpf.length === 1) return { client: byCpf[0] };
  if (byCpf.length > 1) return { ambiguous: true, reason: 'CPF' };

  const byEmail = clients.filter((client) => isSameEmail(client, caseItem?.email));
  if (byEmail.length === 1) return { client: byEmail[0] };
  if (byEmail.length > 1) return { ambiguous: true, reason: 'e-mail' };

  const byName = clients.filter((client) => isSameName(client, caseItem?.name));
  if (byName.length === 1) return { client: byName[0] };
  if (byName.length > 1) return { ambiguous: true, reason: 'nome' };

  return { client: null };
}

export async function resolveClientForCase(caseItem) {
  if (caseItem.clientId) {
    const client = await clientsApi.getById(caseItem.clientId);
    return { client, id: getClientId(client) || caseItem.clientId };
  }

  const cpf = onlyDigits(caseItem.cpf);
  const focusedResponse = await clientsApi.list({ q: cpf || caseItem.email || caseItem.name, page: 0, size: 20 });
  const focusedClients = getArrayFromPage(focusedResponse);
  let resolution = getClientResolution(focusedClients, caseItem);

  if (!resolution.client && !resolution.ambiguous) {
    const allResponse = await clientsApi.list({ page: 0, size: 100 });
    resolution = getClientResolution(getArrayFromPage(allResponse), caseItem);
  }

  if (resolution.ambiguous) {
    const error = new Error(`Mais de um cliente encontrado pelo mesmo ${resolution.reason}.`);
    error.code = 'ambiguous';
    throw error;
  }

  const id = getClientId(resolution.client);
  if (!id) {
    const error = new Error('Cliente não encontrado na aba Clientes.');
    error.code = 'not_found';
    throw error;
  }

  return { client: resolution.client, id };
}

// Monta a fila combinando casos locais com clientes que existem apenas na API.
// institutionsByClientId (clientId -> nomes de bancos, vindo dos vínculos da
// API) preenche a coluna de bancos: casos locais sem bancos registrados são
// enriquecidos e clientes só da API já nascem com os bancos resolvidos.
export function buildQueueCases(clients, cases, institutionsByClientId = {}) {
  const banksFor = (clientId) => institutionsByClientId[String(clientId ?? '')] || [];

  const localCases = (cases || []).map((item) => {
    if ((item.banks || []).length || !item.clientId) return item;
    const banks = banksFor(item.clientId);
    return banks.length ? { ...item, banks } : item;
  });

  const apiOnly = (clients || [])
    .filter((client) => {
      const id = getClientId(client);
      return !localCases.some((item) =>
        (item.clientId && id && String(item.clientId) === String(id))
        || (onlyDigits(item.cpf) && isSameCpf(client, item.cpf)));
    })
    .map((client) => {
      const id = getClientId(client);
      return {
        id: `client-${id}`,
        externalCaseId: '—',
        name: client.name || '—',
        cpf: client.cpf || '',
        cpfMasked: maskCpf(client.cpf || ''),
        phone: '',
        email: client.email || '',
        group: '—',
        quota: '—',
        product: '—',
        letterValue: '—',
        contemplationDate: null,
        banks: banksFor(id),
        status: client.akropoliLinkId ? 'conectado' : 'aguardando',
        updatedAtLabel: '—',
        clientId: id,
        consentLink: '',
        consent: null,
        notes: '',
        fromApi: true,
      };
    });

  return [...localCases, ...apiOnly];
}

export async function createOrFindClient(form) {
  const cpf = onlyDigits(form.cpf);
  const search = await clientsApi.list({ q: cpf, page: 0, size: 20 });
  const existing = getArrayFromPage(search).find((client) => isSameCpf(client, cpf));

  if (existing) return existing;

  return clientsApi.create({
    name: form.name.trim(),
    email: form.email.trim(),
    cpf,
  });
}
