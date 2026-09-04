export const IpcChannels = {
  products: {
    list: "products:list",
    get: "products:get",
    create: "products:create",
    update: "products:update",
    setActive: "products:setActive",
    delete: "products:delete",
    currentStock: "products:currentStock",
  },
  suppliers: {
    list: "suppliers:list",
  },
  invoices: {
    list: "invoices:list",
    get: "invoices:get",
    create: "invoices:create",
    update: "invoices:update",
    delete: "invoices:delete",
  },
  stockOuts: {
    list: "stockOuts:list",
    get: "stockOuts:get",
    create: "stockOuts:create",
    update: "stockOuts:update",
    delete: "stockOuts:delete",
  },
  inventory: {
    monthlyReport: "inventory:monthlyReport",
    rangeReport: "inventory:rangeReport",
  },
  periods: {
    listYears: "periods:listYears",
    list: "periods:list",
    status: "periods:status",
    close: "periods:close",
    reopen: "periods:reopen",
  },
  dashboard: {
    stats: "dashboard:stats",
  },
  audit: {
    list: "audit:list",
    search: "audit:search",
  },
  pdf: {
    exportMonthly: "pdf:exportMonthly",
    exportYearly: "pdf:exportYearly",
    exportCustom: "pdf:exportCustom",
  },
  backup: {
    list: "backup:list",
    createManual: "backup:createManual",
    restore: "backup:restore",
    delete: "backup:delete",
    chooseRestoreFile: "backup:chooseRestoreFile",
    openBackupsFolder: "backup:openBackupsFolder",
  },
  settings: {
    get: "settings:get",
    update: "settings:update",
  },
  system: {
    getLogPath: "system:getLogPath",
  },
} as const;
