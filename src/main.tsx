import { createRoot } from "react-dom/client";
import "./i18n"; // Initialize i18n before App
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
