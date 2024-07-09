// import ReactDOM from 'react-dom';

import { createRoot } from 'react-dom/client';
import 'semantic-ui-css/semantic.min.css';
import App from './App';
import React from 'react';

// New Version Writing
const root = document.getElementById('root');
const rootElement = createRoot(root);
rootElement.render(<App />);

// ReactDOM.render(<App />, document.getElementById('root')); 舊版寫法