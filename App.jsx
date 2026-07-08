// Raiz da aplicação: controla autenticação e a navegação entre as telas de login,
// lista de clientes, análise do cliente e composição da renda.

import React from 'react';
import './lizard.css';
import ScreenCliente from './ScreenCliente.jsx';
import ScreenComposicao from './ScreenComposicao.jsx';
import LoginScreen from './screens/LoginScreen.jsx';
import ClientListScreen from './screens/ClientListScreen.jsx';
import PocContempladosScreen from './screens/PocContempladosScreen.jsx';
import { useAuth } from './hooks/useAuth';

export default function App() {
  const { isAuthenticated, logout } = useAuth();
  const [section, setSection] = React.useState('poc');
  const [tela, setTela] = React.useState('cliente');
  const [selectedClientId, setSelectedClientId] = React.useState(null);

  function handleNavigate(label) {
    if (label === 'POC Contemplados') {
      setSection('poc');
      setSelectedClientId(null);
      setTela('cliente');
    }

    if (label === 'Clientes') {
      setSection('clientes');
      setSelectedClientId(null);
      setTela('cliente');
    }
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (selectedClientId) {
    return tela === 'composicao'
      ? (
        <ScreenComposicao
          clientId={selectedClientId}
          onVoltar={() => setTela('cliente')}
          onNavigate={handleNavigate}
        />
      )
      : (
        <ScreenCliente
          clientId={selectedClientId}
          onVoltar={() => setSelectedClientId(null)}
          onVerComposicao={() => setTela('composicao')}
          onNavigate={handleNavigate}
          backLabel={section === 'poc' ? 'Voltar para POC' : 'Voltar para clientes'}
        />
      );
  }

  if (section === 'clientes') {
    return (
      <ClientListScreen
        onSelectClient={setSelectedClientId}
        onLogout={logout}
        activeItem="Clientes"
        onNavigate={handleNavigate}
      />
    );
  }

  return (
    <PocContempladosScreen
      onLogout={logout}
      onNavigate={handleNavigate}
      onSelectClient={setSelectedClientId}
    />
  );
}
