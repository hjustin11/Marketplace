import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline, GlobalStyles, ThemeProvider, createTheme } from "@mui/material";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#5B7CFA",
    },
    secondary: {
      main: "#12B981",
    },
    background: {
      default: "#f4f7ff",
      paper: "#ffffff",
    },
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    h5: {
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    h6: {
      fontWeight: 700,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "0 12px 30px rgba(43, 58, 103, 0.08)",
          border: "1px solid rgba(91, 124, 250, 0.12)",
        },
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          body: {
            background:
              "radial-gradient(1000px 420px at 95% -5%, rgba(91,124,250,0.25), transparent 58%), radial-gradient(760px 420px at -10% 15%, rgba(16,185,129,0.16), transparent 60%), #f4f7ff",
          },
        }}
      />
      <App />
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  </React.StrictMode>,
);
