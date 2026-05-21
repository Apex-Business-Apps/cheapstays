# Responsive UX

## Breakpoints

| Name    | Min Width | Usage                              |
|---------|-----------|------------------------------------|
| Mobile  | 375px     | Base styles, single-column layouts |
| Tablet  | 768px     | `md:` prefix — two-column, desktop nav revealed |
| Desktop | 1440px    | `xl:` prefix — max container width, multi-column |

Tailwind's default breakpoint scale is used (`sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, `2xl` 1536px). The 375px mobile base targets iPhone SE and small Android devices; no custom breakpoint is needed as Tailwind's base styles apply below `sm`.

## Mobile Hamburger Nav

`src/components/Navbar.tsx` implements a full hamburger menu for screens narrower than `md` (768px):

- **Toggle button**: rendered with `block md:hidden`, uses `Menu` / `X` icons from `lucide-react`. Minimum tap target is 44×44px (`min-h-[44px] min-w-[44px]`).
- **State**: `const [mobileOpen, setMobileOpen] = useState(false)` controls drawer visibility.
- **Drawer**: conditionally rendered `<nav className="md:hidden ...">` below the header bar. Contains the same links as the desktop nav, each with `min-h-[44px]` tap targets and `py-3` padding.
- **Close on navigate**: each mobile `NavLink` calls `onClick={() => setMobileOpen(false)}` to dismiss the drawer after navigation.
- **Admin link**: shown in both desktop and mobile nav only when the authenticated user has the `admin` role.

## Design System Rules

- **Tap targets**: all interactive elements must be at least 44×44px on mobile (WCAG 2.5.5). Use `min-h-[44px]` or sufficient padding.
- **Spacing scale**: use Tailwind's 4px base unit (1 = 4px). Avoid arbitrary values unless absolutely required.
- **Font sizes**: minimum `text-sm` (14px) for body copy; never below `text-xs` (12px) for secondary labels.
- **Container**: `className="container"` sets responsive horizontal padding and max-width. Do not add extra horizontal padding inside container children.
- **Dark mode**: use semantic tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`) from the Tailwind theme. Never hardcode colour values.
- **Motion**: prefer `transition-colors` / `transition-transform` for hover states. Respect `prefers-reduced-motion` by keeping animation opt-in (framer-motion variants gate on the media query automatically).
