# Mycon Page

React component package for the Mycon Open Finance proof of concept.

## Usage

```jsx
import MyconPage from 'mycon-page';

export default function Page() {
  return <MyconPage />;
}
```

You can also import the screens individually:

```jsx
import { ScreenCliente, ScreenComposicao } from 'mycon-page';
```

The package entrypoint imports `lizard.css` automatically. If your build does not process CSS imports from packages, import the stylesheet explicitly:

```jsx
import 'mycon-page/styles.css';
```

## Local Development

```bash
npm install
npm run dev
npm run build
```
