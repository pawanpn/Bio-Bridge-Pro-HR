import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "react-hot-toast";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-center"
      reverseOrder={false}
      toastOptions={{
        duration: 4000,
        style: {
          borderRadius: '8px',
          padding: '12px 16px',
          fontSize: '14px',
          fontWeight: 500,
          maxWidth: '500px',
          zIndex: 999999,
        },
        success: {
          style: {
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #6ee7b7',
          },
          iconTheme: {
            primary: '#059669',
            secondary: '#ecfdf5',
          },
        },
        error: {
          style: {
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fca5a5',
          },
          iconTheme: {
            primary: '#dc2626',
            secondary: '#fef2f2',
          },
          duration: 6000,
        },
        loading: {
          style: {
            background: '#eff6ff',
            color: '#1e40af',
            border: '1px solid #93c5fd',
          },
        },
      }}
      containerStyle={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 999999,
      }}
    />
  </React.StrictMode>,
);
