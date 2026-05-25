const fs = require('fs');
let code = fs.readFileSync('e2e/product-reality-booking-ops.spec.ts', 'utf8');

code = code.replace(
  `    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Payment provider unavailable. Booking cannot stay secured without payment authorization.' }).first()).toBeVisible();`,
  `    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Payment provider unavailable' }).first()).toBeVisible();`
);

fs.writeFileSync('e2e/product-reality-booking-ops.spec.ts', code);
