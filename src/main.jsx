import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom"; // 👈 change here
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HashRouter>
      {" "}
      {/* 👈 use HashRouter */}
      <App />
    </HashRouter>
  </StrictMode>
);
