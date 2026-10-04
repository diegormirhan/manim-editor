import React from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { App } from "./app/App";
import "./app/theme.css";
import "./app/style.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={400} skipDelayDuration={200}>
      <App />
    </TooltipProvider>
  </React.StrictMode>,
);
