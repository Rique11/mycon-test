// Raiz da aplicação: controla autenticação e a navegação entre as telas de login,
// lista de clientes, análise do cliente e composição da renda. Ao abrir a análise
// a partir da fila da POC, guarda também o caso selecionado para que a tela de
// análise exiba o contexto de consórcio (grupo, cota, produto, valor da carta).
// Renderiza ainda o widget global de reports (botão flutuante no canto inferior
// direito), presente em todas as telas.

import React from 'react';
import './lizard.css';
import ScreenCliente from './ScreenCliente.jsx';
import ScreenComposicao from './ScreenComposicao.jsx';
import LoginScreen from './screens/LoginScreen.jsx';
import ClientListScreen from './screens/ClientListScreen.jsx';
import PocContempladosScreen from './screens/PocContempladosScreen.jsx';
import ReportWidget from './components/ReportWidget.jsx';
import { useAuth } from './hooks/useAuth';

export default function App() {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const [section, setSection] = React.useState('poc');
  const [tela, setTela] = React.useState('cliente');
  const [selectedClientId, setSelectedClientId] = React.useState(null);
  const [selectedCase, setSelectedCase] = React.useState(null);

  const handleSelectClient = React.useCallback((clientId, caseItem = null) => {
    setSelectedCase(caseItem);
    setSelectedClientId(clientId);
  }, []);

  function clearSelection() {
    setSelectedClientId(null);
    setSelectedCase(null);
  }

  function handleNavigate(label) {
    if (label === 'POC Contemplados') {
      setSection('poc');
      clearSelection();
      setTela('cliente');
    }

    if (label === 'Clientes') {
      setSection('clientes');
      clearSelection();
      setTela('cliente');
    }
  }

  let content;
  if (isLoading) {
    content = null;
  } else if (!isAuthenticated) {
    content = <LoginScreen />;
  } else if (selectedClientId) {
    content = tela === 'composicao'
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
          caseItem={selectedCase}
          onVoltar={clearSelection}
          onVerComposicao={() => setTela('composicao')}
          onNavigate={handleNavigate}
          backLabel={section === 'poc' ? 'Voltar para POC' : 'Voltar para clientes'}
        />
      );
  } else if (section === 'clientes') {
    content = (
      <ClientListScreen
        onSelectClient={handleSelectClient}
        onLogout={logout}
        activeItem="Clientes"
        onNavigate={handleNavigate}
      />
    );
  } else {
    content = (
      <PocContempladosScreen
        onLogout={logout}
        onNavigate={handleNavigate}
        onSelectClient={handleSelectClient}
      />
    );
  }

  return (
    <>
      {content}
      <ReportWidget />
    </>
  );
}
