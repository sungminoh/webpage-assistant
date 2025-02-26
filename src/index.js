import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Ensure DOM is loaded before rendering
document.addEventListener("DOMContentLoaded", () => {
    const rootElement = document.getElementById("root");
    if (rootElement) {
        const root = ReactDOM.createRoot(rootElement);
        root.render(<App />);
    }
});