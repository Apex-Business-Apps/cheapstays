import React, { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { ToastProvider } from "./components/Toast";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Receiving from "./pages/Receiving";
import StockOut from "./pages/StockOut";
import Inventory from "./pages/Inventory";
import MonthlyReports from "./pages/MonthlyReports";
import YearlyReports from "./pages/YearlyReports";
import PdfReports from "./pages/PdfReports";
import Backup from "./pages/Backup";
import Settings from "./pages/Settings";

export type PageKey =
  | "dashboard"
  | "products"
  | "receiving"
  | "stockOut"
  | "inventory"
  | "monthlyReports"
  | "yearlyReports"
  | "pdfReports"
  | "backup"
  | "settings";

const PAGE_TITLES: Record<PageKey, string> = {
  dashboard: "Табло",
  products: "Продукти",
  receiving: "Приемане на стоки",
  stockOut: "Изписване на стоки",
  inventory: "Наличности",
  monthlyReports: "Месечни отчети",
  yearlyReports: "Годишни отчети",
  pdfReports: "PDF отчети",
  backup: "Backup и възстановяване",
  settings: "Настройки",
};

function PageBody({ page, onNavigate }: { page: PageKey; onNavigate: (p: PageKey) => void }) {
  switch (page) {
    case "dashboard":
      return <Dashboard onNavigate={onNavigate} />;
    case "products":
      return <Products />;
    case "receiving":
      return <Receiving />;
    case "stockOut":
      return <StockOut />;
    case "inventory":
      return <Inventory />;
    case "monthlyReports":
      return <MonthlyReports />;
    case "yearlyReports":
      return <YearlyReports />;
    case "pdfReports":
      return <PdfReports />;
    case "backup":
      return <Backup />;
    case "settings":
      return <Settings />;
    default:
      return null;
  }
}

export default function App() {
  const [page, setPage] = useState<PageKey>("dashboard");

  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar page={page} onNavigate={setPage} />
        <div className="main-area">
          <div className="topbar">
            <h1>{PAGE_TITLES[page]}</h1>
          </div>
          <div className="content">
            <PageBody page={page} onNavigate={setPage} />
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
