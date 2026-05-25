const fs = require('fs');
let code = fs.readFileSync('e2e/product-reality-booking-ops.spec.ts', 'utf8');

code = code.replace(
  `    if (url.includes('/booking-checkout')) {\n      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Payment provider unavailable' }) });\n      return;\n    }`,
  `    if (url.includes('/booking-checkout')) {\n      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Payment provider unavailable' }) });\n      return;\n    }`
);

code = code.replace(
  `    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Payment provider unavailable' }).first()).toBeVisible();`,
  `    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Payment provider unavailable. Booking cannot stay secured without payment authorization.' }).first()).toBeVisible();`
);

fs.writeFileSync('e2e/product-reality-booking-ops.spec.ts', code);
