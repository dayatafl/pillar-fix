import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";


const container = document.getElementById("root");

if (container) {
  createRoot(container).render(<App />);
} else {
  console.error("Root element with ID 'root' not found in the document.");
}