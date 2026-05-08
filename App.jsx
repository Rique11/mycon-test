import React from 'react';
import './lizard.css';
import ScreenCliente from './ScreenCliente.jsx';
import ScreenComposicao from './ScreenComposicao.jsx';

export default function App() {
  const [tela, setTela] = React.useState('cliente');

  return tela === 'composicao'
    ? <ScreenComposicao onVoltar={() => setTela('cliente')} />
    : <ScreenCliente onVerComposicao={() => setTela('composicao')} />;
}
