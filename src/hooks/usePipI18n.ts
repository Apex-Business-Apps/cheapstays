import { useTranslation } from "react-i18next";

/**
 * Typed hook that pre-packages every translation key Pip uses.
 * Import this instead of calling useTranslation + t() directly in AiChatBubble.
 */
export function usePipI18n() {
  const { t, i18n } = useTranslation();

  return {
    i18n,
    lang: i18n.language,

    // Chat widget chrome
    greeting:    t("pip.greeting"),
    thinking:    t("pip.thinking"),
    online:      t("pip.online"),
    placeholder: t("pip.placeholder"),
    mute:        t("pip.mute"),
    unmute:      t("pip.unmute"),
    close:       t("pip.close"),
    listen:      t("pip.listen"),
    stopListen:  t("pip.stopListen"),
    open:        t("pip.open"),
    role:        t("pip.role"),
    error:       t("pip.error"),

    // Quick-prompt chips
    q1: t("pip.q1"),
    q2: t("pip.q2"),
    q3: t("pip.q3"),

    // Agentic search & booking UI
    searchResults:    t("pip.searchResults"),
    noResults:        t("pip.noResults"),
    viewListing:      t("pip.viewListing"),
    bookThis:         t("pip.bookThis"),
    instantBookBadge: t("pip.instantBookBadge"),
    ownerDirectBadge: t("pip.ownerDirectBadge"),
    perNight:         (price: number) => t("pip.perNight", { price }),
    confirmBooking:   t("pip.confirmBooking"),
    bookingSummary:   t("pip.bookingSummary"),
    nights:           (count: number) => t("pip.nights", { count }),
    subtotal:         t("pip.subtotal"),
    serviceFee:       t("pip.serviceFee"),
    total:            t("pip.total"),
    confirmBtn:       t("pip.confirmBtn"),
    cancelBtn:        t("pip.cancelBtn"),
    paymentTitle:     t("pip.paymentTitle"),
    payWith:          (method: string) => t("pip.payWith", { method }),
    bookingCreated:   t("pip.bookingCreated"),
    bookingPending:   t("pip.bookingPending"),
    bookingSuccess:   t("pip.bookingSuccess"),
    authRequired:     t("pip.authRequired"),
    notAvailable:     t("pip.notAvailable"),
    memberOnly:       t("pip.memberOnly"),

    // Voice navigation responses (evaluated lazily so language is current)
    voice: {
      search:         () => t("pip.voice.search"),
      membership:     () => t("pip.voice.membership"),
      host:           () => t("pip.voice.host"),
      support:        () => t("pip.voice.support"),
      home:           () => t("pip.voice.home"),
      auth:           () => t("pip.voice.auth"),
      bookings:       () => t("pip.voice.bookings"),
      confirmBooking: () => t("pip.voice.confirmBooking"),
      rateGuest:      () => t("pip.voice.rateGuest"),
      filters:        () => t("pip.voice.filters"),
      instantBook:    () => t("pip.voice.instantBook"),
      ratings:        () => t("pip.voice.ratings"),
      langSwitch:     (language: string) => t("pip.voice.langSwitch", { language }),
    },
  } as const;
}
