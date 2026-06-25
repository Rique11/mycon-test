// Raiz da aplicação: controla autenticação e a navegação entre as telas de login,
// lista de clientes, análise do cliente e composição da renda.

import React from 'react';
import './lizard.css';
import ScreenCliente from './ScreenCliente.jsx';
import ScreenComposicao from './ScreenComposicao.jsx';
import LoginScreen from './screens/LoginScreen.jsx';
import ClientListScreen from './screens/ClientListScreen.jsx';
import { useAuth } from './hooks/useAuth.ts';

export default function App() {
  const { isAuthenticated, logout } = useAuth();
  const [tela, setTela] = React.useState('cliente');
  const [selectedClientId, setSelectedClientId] = React.useState(null);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (!selectedClientId) {
    return <ClientListScreen onSelectClient={setSelectedClientId} onLogout={logout} />;
  }

  return tela === 'composicao'
    ? <ScreenComposicao onVoltar={() => setTela('cliente')} />
    : <ScreenCliente clientId={selectedClientId} onVoltar={() => setSelectedClientId(null)} onVerComposicao={() => setTela('composicao')} />;
}
