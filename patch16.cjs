const fs = require('fs');
let code = fs.readFileSync('src/pages/MyBookings.tsx', 'utf8');

code = code.replace(
  `      if (data?.checkout_url) {\n        window.location.href = data.checkout_url as string;\n        return;\n      }\n      if (data?.error) throw new Error(data.error);\n      throw new Error("Payment provider unavailable. Booking cannot stay secured without payment authorization.");`,
  `      if (data?.checkout_url) {\n        window.location.href = data.checkout_url as string;\n        return;\n      }\n      if (data?.error) throw new Error(data.error);\n      throw new Error("Payment provider unavailable");`
);

fs.writeFileSync('src/pages/MyBookings.tsx', code);
