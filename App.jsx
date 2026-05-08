import React from 'react';
import ScreenCliente from './ScreenCliente.jsx';
import ScreenComposicao from './screen-composiçao.jsx';

export default function App() {
  const [tela, setTela] = React.useState('cliente');

  return tela === 'composicao'
    ? <ScreenComposicao onVoltar={() => setTela('cliente')} />
    : <ScreenCliente    onVerComposicao={() => setTela('composicao')} />;
}
