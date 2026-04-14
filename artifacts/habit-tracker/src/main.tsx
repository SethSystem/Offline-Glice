import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('SW registrado, escopo:', registration.scope);
      },
      (err) => {
        console.log('Falha ao registrar SW:', err);
      }
    );
  });
}

createRoot(document.getElementById("root")!).render(<App />);
