const fs = require('fs');
let code = fs.readFileSync('src/pages/MyBookings.tsx', 'utf8');

code = code.replace(
  `      const { data, error } = await supabase.functions.invoke("booking-checkout", {\n        body: { booking_id: bookingId, payment_method: "gcash" },\n      });\n      if (error) throw error;\n      if (data?.checkout_url) {\n        window.location.href = data.checkout_url as string;\n        return;\n      }\n      throw new Error("Payment provider unavailable. Booking cannot stay secured without payment authorization.");`,
  `      const { data, error } = await supabase.functions.invoke("booking-checkout", {\n        body: { booking_id: bookingId, payment_method: "gcash" },\n      });\n      if (error) throw error;\n      if (data?.checkout_url) {\n        window.location.href = data.checkout_url as string;\n        return;\n      }\n      if (data?.error) throw new Error(data.error);\n      throw new Error("Payment provider unavailable. Booking cannot stay secured without payment authorization.");`
);

fs.writeFileSync('src/pages/MyBookings.tsx', code);
