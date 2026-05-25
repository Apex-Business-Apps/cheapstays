const fs = require('fs');
let code = fs.readFileSync('e2e/product-reality-booking-ops.spec.ts', 'utf8');

code = code.replace(
  `    if (url.includes('/booking-checkout')) {\n      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Payment provider unavailable' }) });\n      return;\n    }`,
  `    if (url.includes('/booking-checkout')) {\n      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Payment provider unavailable' }) });\n      return;\n    }`
);

// wait the toast in product says: err as Error .message
// MyBookings.tsx: if (data?.error) throw new Error(data.error);

fs.writeFileSync('e2e/product-reality-booking-ops.spec.ts', code);
