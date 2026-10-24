import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ProgramOutputView } from "./components/ProgramOutputView";
import "./index.css";

// The fullscreen second-monitor window loads this same bundle with #program-output.
const isProgramOutput = window.location.hash === "#program-output";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{isProgramOutput ? <ProgramOutputView /> : <App />}</React.StrictMode>
);
