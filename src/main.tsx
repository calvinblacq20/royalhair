import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/ui.css";
import "./styles/screens.css";
import "./styles/motion.css";
import "./styles/salon.css";
import "./styles/responsive.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root is missing from index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
