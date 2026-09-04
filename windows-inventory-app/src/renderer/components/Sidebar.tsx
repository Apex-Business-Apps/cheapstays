import React from "react";
import type { PageKey } from "../App";

const NAV_ITEMS: { key: PageKey; icon: string; label: string }[] = [
  { key: "dashboard", icon: "🏠", label: "Табло" },
  { key: "products", icon: "📦", label: "Продукти" },
  { key: "receiving", icon: "🧾", label: "Приемане на стоки" },
  { key: "stockOut", icon: "📤", label: "Изписване" },
  { key: "inventory", icon: "📊", label: "Наличности" },
  { key: "monthlyReports", icon: "📅", label: "Месечни отчети" },
  { key: "yearlyReports", icon: "📈", label: "Годишни отчети" },
  { key: "pdfReports", icon: "📄", label: "PDF отчети" },
  { key: "backup", icon: "💾", label: "Backup" },
  { key: "settings", icon: "⚙", label: "Настройки" },
];

export function Sidebar({ page, onNavigate }: { page: PageKey; onNavigate: (p: PageKey) => void }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <span className="logo-dot">IM</span>
        <span>Inventory Manager</span>
      </div>
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          className={`nav-item ${page === item.key ? "active" : ""}`}
          onClick={() => onNavigate(item.key)}
        >
          <span className="nav-icon">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
