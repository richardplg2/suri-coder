# UI Primitives Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build all primitive and composed components in `packages/ui` (`@agent-coding/ui`) following the macOS-style design system, covering every component needed across all 7 features (Foundation, Sessions, Skills, Worktrees, Figma Pipeline, Cypress Testing, File Review).

**Architecture:** Layered component library — shadcn/ui primitives (Radix UI + CVA) as foundation, custom design-system components on top, then feature-specific composed components. All exported from a single barrel. CSS custom properties define the macOS dark/light theme; Tailwind v4 consumes them via `@theme inline` in the desktop app.

**Tech Stack:** React 19, Radix UI (unified `radix-ui` package), CVA, Tailwind CSS v4, Lucide React, shiki (syntax highlighting), react-resizable-panels (split pane)

**Design refs:**
- `docs/design/design-system.md` — Color palette, typography, spacing, shadows, border radius
- `docs/design/components.md` — Full component catalog with macOS references
- `docs/design/app-shell.md` — Layout structure (3-panel, sidebar, toolbar)
- `docs/design/pages/*.md` — Per-feature component mapping and states

**Existing code:**
- `packages/ui/src/components/button.tsx` — Button with CVA variants (shadcn pattern)
- `packages/ui/src/components/alert.tsx` — Alert with CVA variants
- `packages/ui/src/globals.css` — CSS variables (currently shadcn defaults, needs macOS override)
- `packages/ui/src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `packages/ui/tsup.config.ts` — Build config with `@` alias → `./src`

**Component inventory (from `docs/design/components.md`):**

| Category | Components | Source |
|----------|-----------|--------|
| Navigation | SegmentedControl, Breadcrumb | Custom, shadcn |
| Data Display | DataTable, SourceList, StatusBadge, EmptyState, KVRow | Custom |
| Input | SearchField, CommandPalette, TextArea, Select, Toggle | Custom + shadcn |
| Feedback | Sheet, Popover, Toast, ProgressBar, Spinner | shadcn + custom |
| Session | ChatBubble, StreamingText, ToolCallCard, CostBadge, SessionStatusBar | Custom |
| Code & Review | DiffViewer, CodeBlock, InlineComment, FileTree | Custom |
| Layout | SplitPane, Panel, TabBar | Custom |
| Base (shadcn) | Input, Label, Textarea, Badge, Card, Separator, ScrollArea, Select, Switch, Tabs, Dialog, Sheet, Popover, Tooltip, DropdownMenu, Command, Table, Breadcrumb, Progress, Sonner | shadcn install |

---

### Task 1: Update CSS design tokens to macOS palette

**Files:**
- Modify: `packages/ui/src/globals.css`

**Step 1: Read the current globals.css**

Read `packages/ui/src/globals.css` to understand current oklch values.

**Step 2: Replace with macOS design system colors**

Overwrite `packages/ui/src/globals.css` with the macOS palette mapped to shadcn variable names. Keep the shadcn naming convention (--background, --foreground, --primary, etc.) but use our design system hex values. Add extra variables for design-system-specific tokens (--success, --warning, --surface, --surface-hover, shadows, spacing).

```css
:root {
  /* Light mode (default for :root, shadcn convention) */
  --background: #F5F5F7;
  --foreground: #1D1D1F;
  --card: #FFFFFF;
  --card-foreground: #1D1D1F;
  --popover: #FFFFFF;
  --popover-foreground: #1D1D1F;
  --primary: #007AFF;
  --primary-foreground: #FFFFFF;
  --secondary: #F0F0F0;
  --secondary-foreground: #1D1D1F;
  --muted: #F0F0F0;
  --muted-foreground: #6E6E73;
  --accent: rgba(0,122,255,0.12);
  --accent-foreground: #007AFF;
  --destructive: #FF3B30;
  --destructive-foreground: #FFFFFF;
  --border: #D1D1D6;
  --input: #D1D1D6;
  --ring: #007AFF;

  /* Design system extras — light */
  --surface: #FFFFFF;
  --surface-hover: #FAFAFA;
  --sidebar-bg: rgba(240,240,240,0.85);
  --text-secondary: #6E6E73;
  --accent-hover: #409CFF;
  --selection: rgba(0,122,255,0.12);
  --success: #28CD41;
  --warning: #FFCC00;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 30px rgba(0,0,0,0.12);

  /* Spacing (4px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* Border radius */
  --radius: 0.375rem;
  --radius-button: 6px;
  --radius-card: 8px;
  --radius-modal: 10px;
  --radius-input: 6px;
  --radius-pill: 9999px;

  /* Typography */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;

  /* Sidebar (shadcn sidebar vars) */
  --sidebar: rgba(240,240,240,0.85);
  --sidebar-foreground: #1D1D1F;
  --sidebar-primary: #007AFF;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: rgba(0,122,255,0.12);
  --sidebar-accent-foreground: #007AFF;
  --sidebar-border: #D1D1D6;
  --sidebar-ring: #007AFF;
}

.dark {
  --background: #1E1E1E;
  --foreground: #E5E5E5;
  --card: #252526;
  --card-foreground: #E5E5E5;
  --popover: #252526;
  --popover-foreground: #E5E5E5;
  --primary: #0A84FF;
  --primary-foreground: #FFFFFF;
  --secondary: #2D2D2D;
  --secondary-foreground: #E5E5E5;
  --muted: #2D2D2D;
  --muted-foreground: #999999;
  --accent: rgba(10,132,255,0.15);
  --accent-foreground: #0A84FF;
  --destructive: #FF453A;
  --destructive-foreground: #FFFFFF;
  --border: #3C3C3C;
  --input: #3C3C3C;
  --ring: #0A84FF;

  /* Design system extras — dark */
  --surface: #252526;
  --surface-hover: #2D2D2D;
  --sidebar-bg: rgba(27,27,31,0.85);
  --text-secondary: #999999;
  --accent-hover: #409CFF;
  --selection: rgba(10,132,255,0.15);
  --success: #32D74B;
  --warning: #FFD60A;

  /* Shadows (stronger in dark mode) */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.15);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.2);
  --shadow-lg: 0 10px 30px rgba(0,0,0,0.25);

  /* Sidebar */
  --sidebar: rgba(27,27,31,0.85);
  --sidebar-foreground: #E5E5E5;
  --sidebar-primary: #0A84FF;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: rgba(10,132,255,0.15);
  --sidebar-accent-foreground: #0A84FF;
  --sidebar-border: #3C3C3C;
  --sidebar-ring: #0A84FF;
}
```

**Step 3: Verify build**

Run: `cd packages/ui && pnpm build`
Expected: Build succeeds (CSS is exported via `"./globals.css": "./src/globals.css"`)

**Step 4: Commit**

```bash
git add packages/ui/src/globals.css
git commit -m "feat(ui): update CSS design tokens to macOS palette"
```

---

### Task 2: Add dependencies

**Files:**
- Modify: `packages/ui/package.json`

**Step 1: Add lucide-react as peer dependency and new production deps**

```bash
cd packages/ui && pnpm add -D lucide-react && pnpm add react-resizable-panels
```

Then manually move `lucide-react` from devDependencies to peerDependencies in package.json (matching `react` pattern):

```json
"peerDependencies": {
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "lucide-react": ">=0.400.0"
}
```

**Step 2: Verify**

Run: `cd packages/ui && pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add packages/ui/package.json packages/ui/pnpm-lock.yaml
git commit -m "feat(ui): add lucide-react peer dep and react-resizable-panels"
```

---

### Task 3: Install all shadcn primitives

**Files:**
- Create: Multiple files in `packages/ui/src/components/`

**Step 1: Run shadcn CLI to install all base primitives**

Run from the `packages/ui` directory:

```bash
cd packages/ui && npx shadcn@latest add input label textarea badge card separator scroll-area select switch tabs dialog sheet popover tooltip dropdown-menu command table breadcrumb progress sonner --yes
```

This installs ~20 shadcn components. Each becomes a file in `packages/ui/src/components/`.

**Step 2: Verify all files were created**

Run: `ls packages/ui/src/components/`
Expected: See files for each installed component (input.tsx, label.tsx, textarea.tsx, badge.tsx, card.tsx, separator.tsx, scroll-area.tsx, select.tsx, switch.tsx, tabs.tsx, dialog.tsx, sheet.tsx, popover.tsx, tooltip.tsx, dropdown-menu.tsx, command.tsx, table.tsx, breadcrumb.tsx, progress.tsx, sonner.tsx)

**Step 3: Fix any import issues**

If any component imports from `@radix-ui/react-*` scoped packages instead of the unified `radix-ui` package, update the imports. Example:

```typescript
// Before (scoped):
import * as SelectPrimitive from "@radix-ui/react-select"
// After (unified):
import { Select as SelectPrimitive } from "radix-ui"
```

Check each generated file and fix imports if needed. The unified `radix-ui` package re-exports everything.

**Step 4: Verify build**

Run: `cd packages/ui && pnpm build`
Expected: Build succeeds with no errors

**Step 5: Commit**

```bash
git add packages/ui/
git commit -m "feat(ui): install all shadcn base primitives"
```

---

### Task 4: Update exports barrel

**Files:**
- Modify: `packages/ui/src/index.ts`

**Step 1: Read current index.ts**

Read `packages/ui/src/index.ts` to see current exports.

**Step 2: Add exports for all installed components**

Update `packages/ui/src/index.ts` to export all shadcn primitives:

```typescript
// Utilities
export { cn } from './lib/utils'

// Base primitives (shadcn)
export { Alert, AlertTitle, AlertDescription } from './components/alert'
export { Badge, badgeVariants } from './components/badge'
export {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from './components/breadcrumb'
export { Button, buttonVariants } from './components/button'
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './components/card'
export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './components/command'
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './components/dialog'
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './components/dropdown-menu'
export { Input } from './components/input'
export { Label } from './components/label'
export { Popover, PopoverContent, PopoverTrigger } from './components/popover'
export { Progress } from './components/progress'
export { ScrollArea, ScrollBar } from './components/scroll-area'
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './components/select'
export { Separator } from './components/separator'
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './components/sheet'
export { Switch } from './components/switch'
export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './components/table'
export { Tabs, TabsContent, TabsList, TabsTrigger } from './components/tabs'
export { Textarea } from './components/textarea'
export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './components/tooltip'
export { Toaster } from './components/sonner'
```

**Step 3: Verify build**

Run: `cd packages/ui && pnpm build`
Expected: Build succeeds, `dist/index.d.ts` contains all exports

**Step 4: Commit**

```bash
git add packages/ui/src/index.ts
git commit -m "feat(ui): export all shadcn primitives from barrel"
```

---

### Task 5: SegmentedControl

Used by: Skills (filter tabs), Figma Pipeline (step indicator), Cypress Testing (view filter)

**Files:**
- Create: `packages/ui/src/components/segmented-control.tsx`

**Step 1: Implement SegmentedControl**

Create `packages/ui/src/components/segmented-control.tsx`:

```tsx
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const segmentedControlVariants = cva(
  'inline-flex items-center rounded-lg bg-muted p-0.5 text-muted-foreground',
  {
    variants: {
      size: {
        default: 'h-8',
        sm: 'h-7',
        lg: 'h-9',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
)

interface SegmentedControlProps
  extends React.ComponentProps<'div'>,
    VariantProps<typeof segmentedControlVariants> {
  value: string
  onValueChange: (value: string) => void
  items: { value: string; label: string; disabled?: boolean }[]
}

function SegmentedControl({
  className,
  size,
  value,
  onValueChange,
  items,
  ...props
}: SegmentedControlProps) {
  return (
    <div
      className={cn(segmentedControlVariants({ size }), className)}
      role="tablist"
      data-slot="segmented-control"
      {...props}
    >
      {items.map((item) => (
        <button
          key={item.value}
          role="tab"
          type="button"
          aria-selected={value === item.value}
          disabled={item.disabled}
          onClick={() => onValueChange(item.value)}
          className={cn(
            'inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50',
            size === 'sm' ? 'h-6 px-2 text-xs' : size === 'lg' ? 'h-7 px-4' : 'h-6.5 px-3',
            value === item.value
              ? 'bg-background text-foreground shadow-sm'
              : 'hover:text-foreground'
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export { SegmentedControl, segmentedControlVariants }
export type { SegmentedControlProps }
```

**Step 2: Add export to index.ts**

Add to `packages/ui/src/index.ts`:

```typescript
export { SegmentedControl, segmentedControlVariants, type SegmentedControlProps } from './components/segmented-control'
```

**Step 3: Verify build**

Run: `cd packages/ui && pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/ui/src/components/segmented-control.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add SegmentedControl component"
```

---

### Task 6: StatusBadge + CostBadge

Used by: All feature screens for status indicators, Sessions for cost display

**Files:**
- Create: `packages/ui/src/components/status-badge.tsx`
- Create: `packages/ui/src/components/cost-badge.tsx`

**Step 1: Implement StatusBadge**

Create `packages/ui/src/components/status-badge.tsx`:

```tsx
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      status: {
        running: 'bg-primary/10 text-primary',
        passed: 'bg-[var(--success)]/10 text-[var(--success)]',
        failed: 'bg-destructive/10 text-destructive',
        pending: 'bg-muted text-muted-foreground',
        warning: 'bg-[var(--warning)]/10 text-[var(--warning)]',
        idle: 'bg-muted text-muted-foreground',
        connected: 'bg-[var(--success)]/10 text-[var(--success)]',
        disconnected: 'bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: {
      status: 'idle',
    },
  }
)

const dotColorMap: Record<string, string> = {
  running: 'bg-primary',
  passed: 'bg-[var(--success)]',
  failed: 'bg-destructive',
  pending: 'bg-muted-foreground',
  warning: 'bg-[var(--warning)]',
  idle: 'bg-muted-foreground',
  connected: 'bg-[var(--success)]',
  disconnected: 'bg-destructive',
}

interface StatusBadgeProps
  extends React.ComponentProps<'span'>,
    VariantProps<typeof statusBadgeVariants> {
  showDot?: boolean
}

function StatusBadge({
  className,
  status = 'idle',
  showDot = true,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(statusBadgeVariants({ status }), className)}
      data-slot="status-badge"
      {...props}
    >
      {showDot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full', dotColorMap[status ?? 'idle'])}
          aria-hidden
        />
      )}
      {children ?? status}
    </span>
  )
}

export { StatusBadge, statusBadgeVariants }
export type { StatusBadgeProps }
```

**Step 2: Implement CostBadge**

Create `packages/ui/src/components/cost-badge.tsx`:

```tsx
import * as React from 'react'
import { DollarSign } from 'lucide-react'

import { cn } from '@/lib/utils'

interface CostBadgeProps extends React.ComponentProps<'span'> {
  amount: number
  currency?: string
}

function CostBadge({ className, amount, currency = '$', ...props }: CostBadgeProps) {
  const formatted = amount < 0.01 ? '<$0.01' : `${currency}${amount.toFixed(2)}`

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground',
        className
      )}
      data-slot="cost-badge"
      {...props}
    >
      <DollarSign className="size-3" />
      {formatted}
    </span>
  )
}

export { CostBadge }
export type { CostBadgeProps }
```

**Step 3: Add exports to index.ts**

```typescript
export { StatusBadge, statusBadgeVariants, type StatusBadgeProps } from './components/status-badge'
export { CostBadge, type CostBadgeProps } from './components/cost-badge'
```

**Step 4: Verify build**

Run: `cd packages/ui && pnpm build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add packages/ui/src/components/status-badge.tsx packages/ui/src/components/cost-badge.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add StatusBadge and CostBadge components"
```

---

### Task 7: EmptyState + KVRow + Spinner

Small display components used across all features.

**Files:**
- Create: `packages/ui/src/components/empty-state.tsx`
- Create: `packages/ui/src/components/kv-row.tsx`
- Create: `packages/ui/src/components/spinner.tsx`

**Step 1: Implement EmptyState**

Create `packages/ui/src/components/empty-state.tsx`:

```tsx
import * as React from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface EmptyStateProps extends React.ComponentProps<'div'> {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

function EmptyState({
  className,
  icon: Icon,
  title,
  description,
  action,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-12 text-center',
        className
      )}
      data-slot="empty-state"
      {...props}
    >
      {Icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Icon className="size-6 text-muted-foreground" />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-[13px] font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-[12px] text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export { EmptyState }
export type { EmptyStateProps }
```

**Step 2: Implement KVRow**

Create `packages/ui/src/components/kv-row.tsx`:

```tsx
import * as React from 'react'

import { cn } from '@/lib/utils'

interface KVRowProps extends React.ComponentProps<'div'> {
  label: string
  value: React.ReactNode
}

function KVRow({ className, label, value, ...props }: KVRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 py-1.5 text-[12px]',
        className
      )}
      data-slot="kv-row"
      {...props}
    >
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

export { KVRow }
export type { KVRowProps }
```

**Step 3: Implement Spinner**

Create `packages/ui/src/components/spinner.tsx`:

```tsx
import * as React from 'react'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SpinnerProps extends React.ComponentProps<'div'> {
  size?: 'sm' | 'default' | 'lg'
  label?: string
}

const sizeMap = {
  sm: 'size-3',
  default: 'size-4',
  lg: 'size-6',
}

function Spinner({ className, size = 'default', label, ...props }: SpinnerProps) {
  return (
    <div
      className={cn('inline-flex items-center gap-2 text-muted-foreground', className)}
      role="status"
      data-slot="spinner"
      {...props}
    >
      <Loader2 className={cn('animate-spin', sizeMap[size])} />
      {label && <span className="text-[12px]">{label}</span>}
      <span className="sr-only">{label ?? 'Loading...'}</span>
    </div>
  )
}

export { Spinner }
export type { SpinnerProps }
```

**Step 4: Add exports to index.ts**

```typescript
export { EmptyState, type EmptyStateProps } from './components/empty-state'
export { KVRow, type KVRowProps } from './components/kv-row'
export { Spinner, type SpinnerProps } from './components/spinner'
```

**Step 5: Verify build**

Run: `cd packages/ui && pnpm build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add packages/ui/src/components/empty-state.tsx packages/ui/src/components/kv-row.tsx packages/ui/src/components/spinner.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add EmptyState, KVRow, and Spinner components"
```

---

### Task 8: SearchField

Used by: Toolbar search trigger, filtering in all list views.

**Files:**
- Create: `packages/ui/src/components/search-field.tsx`

**Step 1: Implement SearchField**

Create `packages/ui/src/components/search-field.tsx`:

```tsx
import * as React from 'react'
import { Search, X } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SearchFieldProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  onClear?: () => void
  shortcut?: string
}

function SearchField({
  className,
  value,
  onClear,
  shortcut,
  ...props
}: SearchFieldProps) {
  const hasValue = value !== undefined && value !== ''

  return (
    <div className={cn('relative', className)} data-slot="search-field">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        className={cn(
          'h-8 w-full rounded-md border border-input bg-background pl-8 pr-8 text-[13px] text-foreground outline-none transition-colors duration-150',
          'placeholder:text-muted-foreground',
          'focus:border-primary focus:ring-2 focus:ring-ring/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          '[&::-webkit-search-cancel-button]:hidden'
        )}
        {...props}
      />
      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-3" />
        </button>
      )}
      {!hasValue && shortcut && (
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
          {shortcut}
        </kbd>
      )}
    </div>
  )
}

export { SearchField }
export type { SearchFieldProps }
```

**Step 2: Add export to index.ts**

```typescript
export { SearchField, type SearchFieldProps } from './components/search-field'
```

**Step 3: Verify build**

Run: `cd packages/ui && pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/ui/src/components/search-field.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add SearchField component"
```

---

### Task 9: SplitPane

Used by: File Review (FileTree | DiffViewer), App Shell (Sidebar | Main | Inspector).

**Files:**
- Create: `packages/ui/src/components/split-pane.tsx`

**Step 1: Implement SplitPane**

Uses `react-resizable-panels` (installed in Task 2). Create `packages/ui/src/components/split-pane.tsx`:

```tsx
import * as React from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

import { cn } from '@/lib/utils'

interface SplitPaneProps extends React.ComponentProps<typeof PanelGroup> {
  children: React.ReactNode
}

function SplitPane({ className, ...props }: SplitPaneProps) {
  return (
    <PanelGroup
      className={cn('flex h-full', className)}
      data-slot="split-pane"
      {...props}
    />
  )
}

interface SplitPanePanelProps extends React.ComponentProps<typeof Panel> {
  children: React.ReactNode
}

function SplitPanePanel({ className, ...props }: SplitPanePanelProps) {
  return <Panel className={cn('overflow-auto', className)} {...props} />
}

interface SplitPaneHandleProps extends React.ComponentProps<typeof PanelResizeHandle> {}

function SplitPaneHandle({ className, ...props }: SplitPaneHandleProps) {
  return (
    <PanelResizeHandle
      className={cn(
        'relative flex w-px items-center justify-center bg-border transition-colors duration-150',
        'after:absolute after:inset-y-0 after:-left-0.5 after:-right-0.5 after:cursor-col-resize',
        'data-[resize-handle-active]:bg-primary',
        'hover:bg-primary/50',
        // Vertical variant styles
        'data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full',
        'data-[panel-group-direction=vertical]:after:inset-x-0 data-[panel-group-direction=vertical]:after:-top-0.5 data-[panel-group-direction=vertical]:after:-bottom-0.5 data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:right-0 data-[panel-group-direction=vertical]:after:cursor-row-resize',
        className
      )}
      data-slot="split-pane-handle"
      {...props}
    />
  )
}

export { SplitPane, SplitPanePanel, SplitPaneHandle }
export type { SplitPaneProps, SplitPanePanelProps, SplitPaneHandleProps }
```

**Step 2: Add exports to index.ts**

```typescript
export { SplitPane, SplitPanePanel, SplitPaneHandle, type SplitPaneProps, type SplitPanePanelProps, type SplitPaneHandleProps } from './components/split-pane'
```

**Step 3: Verify build**

Run: `cd packages/ui && pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/ui/src/components/split-pane.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add SplitPane component with resizable panels"
```

---

### Task 10: Panel + TabBar

Used by: App Shell (content panels), Sessions (tab navigation for multiple sessions).

**Files:**
- Create: `packages/ui/src/components/panel.tsx`
- Create: `packages/ui/src/components/tab-bar.tsx`

**Step 1: Implement Panel**

Create `packages/ui/src/components/panel.tsx`:

```tsx
import * as React from 'react'

import { cn } from '@/lib/utils'

interface PanelProps extends React.ComponentProps<'div'> {
  children: React.ReactNode
}

function PanelRoot({ className, ...props }: PanelProps) {
  return (
    <div
      className={cn('flex h-full flex-col overflow-hidden', className)}
      data-slot="panel"
      {...props}
    />
  )
}

interface PanelHeaderProps extends React.ComponentProps<'div'> {
  children: React.ReactNode
}

function PanelHeader({ className, ...props }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        'flex h-9 shrink-0 items-center justify-between border-b border-border px-3',
        className
      )}
      data-slot="panel-header"
      {...props}
    />
  )
}

function PanelTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      className={cn('text-[11px] font-semibold uppercase tracking-wide text-muted-foreground', className)}
      data-slot="panel-title"
      {...props}
    />
  )
}

function PanelActions({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center gap-1', className)}
      data-slot="panel-actions"
      {...props}
    />
  )
}

function PanelContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex-1 overflow-auto', className)}
      data-slot="panel-content"
      {...props}
    />
  )
}

const Panel = Object.assign(PanelRoot, {
  Header: PanelHeader,
  Title: PanelTitle,
  Actions: PanelActions,
  Content: PanelContent,
})

export { Panel, PanelHeader, PanelTitle, PanelActions, PanelContent }
export type { PanelProps, PanelHeaderProps }
```

**Step 2: Implement TabBar**

Create `packages/ui/src/components/tab-bar.tsx`:

```tsx
import * as React from 'react'
import { Plus, X } from 'lucide-react'

import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
  closable?: boolean
}

interface TabBarProps extends React.ComponentProps<'div'> {
  tabs: Tab[]
  activeTab: string
  onTabChange: (id: string) => void
  onTabClose?: (id: string) => void
  onNewTab?: () => void
}

function TabBar({
  className,
  tabs,
  activeTab,
  onTabChange,
  onTabClose,
  onNewTab,
  ...props
}: TabBarProps) {
  return (
    <div
      className={cn(
        'flex h-9 items-center gap-0 border-b border-border bg-card',
        className
      )}
      role="tablist"
      data-slot="tab-bar"
      {...props}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'group relative flex h-full cursor-pointer items-center gap-1.5 border-r border-border px-3 text-[13px] transition-colors duration-150',
            activeTab === tab.id
              ? 'bg-background text-foreground'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          )}
        >
          {tab.icon}
          <span className="max-w-[120px] truncate">{tab.label}</span>
          {tab.closable !== false && onTabClose && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onTabClose(tab.id)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation()
                  onTabClose(tab.id)
                }
              }}
              className="ml-1 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
              aria-label={`Close ${tab.label}`}
            >
              <X className="size-3" />
            </span>
          )}
          {activeTab === tab.id && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
          )}
        </button>
      ))}
      {onNewTab && (
        <button
          type="button"
          onClick={onNewTab}
          className="flex h-full cursor-pointer items-center px-2 text-muted-foreground transition-colors duration-150 hover:text-foreground"
          aria-label="New tab"
        >
          <Plus className="size-4" />
        </button>
      )}
    </div>
  )
}

export { TabBar }
export type { TabBarProps, Tab }
```

**Step 3: Add exports to index.ts**

```typescript
export { Panel, PanelHeader, PanelTitle, PanelActions, PanelContent, type PanelProps, type PanelHeaderProps } from './components/panel'
export { TabBar, type TabBarProps, type Tab } from './components/tab-bar'
```

**Step 4: Verify build**

Run: `cd packages/ui && pnpm build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add packages/ui/src/components/panel.tsx packages/ui/src/components/tab-bar.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add Panel and TabBar components"
```

---

### Task 11: DataTable

Used by: Skills (skill list), Cypress Testing (test results), Sessions list (if needed).

**Files:**
- Create: `packages/ui/src/components/data-table.tsx`

**Step 1: Implement DataTable**

Create `packages/ui/src/components/data-table.tsx`:

```tsx
import * as React from 'react'

import { cn } from '@/lib/utils'

interface Column<T> {
  key: string
  header: string
  width?: string
  render?: (item: T, index: number) => React.ReactNode
  className?: string
}

interface DataTableProps<T> extends React.ComponentProps<'div'> {
  columns: Column<T>[]
  data: T[]
  rowKey: (item: T) => string
  selectedKey?: string
  onRowClick?: (item: T) => void
  emptyState?: React.ReactNode
}

function DataTable<T>({
  className,
  columns,
  data,
  rowKey,
  selectedKey,
  onRowClick,
  emptyState,
  ...props
}: DataTableProps<T>) {
  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  return (
    <div className={cn('w-full overflow-auto', className)} data-slot="data-table" {...props}>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'h-8 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground',
                  col.className
                )}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const key = rowKey(item)
            const isSelected = selectedKey === key
            return (
              <tr
                key={key}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  'h-8 cursor-pointer border-b border-border transition-colors duration-150',
                  isSelected
                    ? 'bg-[var(--selection)]'
                    : 'even:bg-[rgba(255,255,255,0.02)] hover:bg-secondary',
                  onRowClick && 'cursor-pointer'
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-3', col.className)}>
                    {col.render
                      ? col.render(item, index)
                      : String((item as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export { DataTable }
export type { DataTableProps, Column }
```

**Step 2: Add export to index.ts**

```typescript
export { DataTable, type DataTableProps, type Column } from './components/data-table'
```

**Step 3: Verify build**

Run: `cd packages/ui && pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/ui/src/components/data-table.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add DataTable component with selection and sorting"
```

---

### Task 12: SourceList + FileTree

Used by: Worktrees (worktree list), File Review (changed files tree).

**Files:**
- Create: `packages/ui/src/components/source-list.tsx`
- Create: `packages/ui/src/components/file-tree.tsx`

**Step 1: Implement SourceList**

Create `packages/ui/src/components/source-list.tsx`:

```tsx
import * as React from 'react'
import { ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SourceListItem {
  id: string
  label: string
  icon?: React.ReactNode
  badge?: React.ReactNode
  children?: SourceListItem[]
}

interface SourceListProps extends React.ComponentProps<'div'> {
  items: SourceListItem[]
  selectedId?: string
  onSelect?: (id: string) => void
  expandedIds?: Set<string>
  onToggleExpand?: (id: string) => void
}

function SourceListRow({
  item,
  depth,
  selectedId,
  onSelect,
  expandedIds,
  onToggleExpand,
}: {
  item: SourceListItem
  depth: number
  selectedId?: string
  onSelect?: (id: string) => void
  expandedIds?: Set<string>
  onToggleExpand?: (id: string) => void
}) {
  const hasChildren = item.children && item.children.length > 0
  const isExpanded = expandedIds?.has(item.id) ?? false
  const isSelected = selectedId === item.id

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (hasChildren) onToggleExpand?.(item.id)
          onSelect?.(item.id)
        }}
        className={cn(
          'flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[13px] transition-colors duration-150',
          isSelected
            ? 'bg-[var(--selection)] text-primary'
            : 'text-foreground hover:bg-secondary'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren && (
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform duration-150',
              isExpanded && 'rotate-90'
            )}
          />
        )}
        {!hasChildren && <span className="w-3.5" />}
        {item.icon && <span className="shrink-0">{item.icon}</span>}
        <span className="flex-1 truncate text-left">{item.label}</span>
        {item.badge && <span className="shrink-0">{item.badge}</span>}
      </button>
      {hasChildren && isExpanded &&
        item.children!.map((child) => (
          <SourceListRow
            key={child.id}
            item={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            expandedIds={expandedIds}
            onToggleExpand={onToggleExpand}
          />
        ))}
    </>
  )
}

function SourceList({
  className,
  items,
  selectedId,
  onSelect,
  expandedIds,
  onToggleExpand,
  ...props
}: SourceListProps) {
  return (
    <div
      className={cn('space-y-0.5 py-1', className)}
      role="tree"
      data-slot="source-list"
      {...props}
    >
      {items.map((item) => (
        <SourceListRow
          key={item.id}
          item={item}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          expandedIds={expandedIds}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </div>
  )
}

export { SourceList }
export type { SourceListProps, SourceListItem }
```

**Step 2: Implement FileTree**

Create `packages/ui/src/components/file-tree.tsx`:

```tsx
import * as React from 'react'
import { ChevronRight, File, Folder } from 'lucide-react'

import { cn } from '@/lib/utils'

type FileStatus = 'modified' | 'added' | 'deleted' | 'unchanged'

interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  status?: FileStatus
  children?: FileTreeNode[]
}

interface FileTreeProps extends React.ComponentProps<'div'> {
  nodes: FileTreeNode[]
  selectedPath?: string
  onSelect?: (path: string) => void
  expandedPaths?: Set<string>
  onToggleExpand?: (path: string) => void
}

const statusColors: Record<FileStatus, string> = {
  modified: 'text-[var(--warning)]',
  added: 'text-[var(--success)]',
  deleted: 'text-destructive',
  unchanged: 'text-muted-foreground',
}

const statusIcons: Record<FileStatus, string> = {
  modified: '\u25CF',
  added: '+',
  deleted: '\u2212',
  unchanged: '',
}

function FileTreeRow({
  node,
  depth,
  selectedPath,
  onSelect,
  expandedPaths,
  onToggleExpand,
}: {
  node: FileTreeNode
  depth: number
  selectedPath?: string
  onSelect?: (path: string) => void
  expandedPaths?: Set<string>
  onToggleExpand?: (path: string) => void
}) {
  const isDir = node.type === 'directory'
  const isExpanded = expandedPaths?.has(node.path) ?? false
  const isSelected = selectedPath === node.path
  const status = node.status ?? 'unchanged'

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isDir) onToggleExpand?.(node.path)
          else onSelect?.(node.path)
        }}
        className={cn(
          'flex w-full cursor-pointer items-center gap-1.5 rounded-sm px-2 py-0.5 text-[13px] transition-colors duration-150',
          isSelected
            ? 'bg-[var(--selection)] text-primary'
            : 'text-foreground hover:bg-secondary'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isDir ? (
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform duration-150',
              isExpanded && 'rotate-90'
            )}
          />
        ) : (
          <span className="w-3.5" />
        )}
        {isDir ? (
          <Folder className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <File className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1 truncate text-left">{node.name}</span>
        {status !== 'unchanged' && (
          <span className={cn('shrink-0 text-xs font-bold', statusColors[status])}>
            {statusIcons[status]}
          </span>
        )}
      </button>
      {isDir && isExpanded &&
        node.children?.map((child) => (
          <FileTreeRow
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
            expandedPaths={expandedPaths}
            onToggleExpand={onToggleExpand}
          />
        ))}
    </>
  )
}

function FileTree({
  className,
  nodes,
  selectedPath,
  onSelect,
  expandedPaths,
  onToggleExpand,
  ...props
}: FileTreeProps) {
  return (
    <div
      className={cn('space-y-px py-1 font-mono text-[12px]', className)}
      role="tree"
      data-slot="file-tree"
      {...props}
    >
      {nodes.map((node) => (
        <FileTreeRow
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
          expandedPaths={expandedPaths}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </div>
  )
}

export { FileTree }
export type { FileTreeProps, FileTreeNode, FileStatus }
```

**Step 3: Add exports to index.ts**

```typescript
export { SourceList, type SourceListProps, type SourceListItem } from './components/source-list'
export { FileTree, type FileTreeProps, type FileTreeNode, type FileStatus } from './components/file-tree'
```

**Step 4: Verify build**

Run: `cd packages/ui && pnpm build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add packages/ui/src/components/source-list.tsx packages/ui/src/components/file-tree.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add SourceList and FileTree tree components"
```

---

### Task 13: ChatBubble + StreamingText

Used by: Sessions (chat messages and real-time AI streaming).

**Files:**
- Create: `packages/ui/src/components/chat-bubble.tsx`
- Create: `packages/ui/src/components/streaming-text.tsx`

**Step 1: Implement ChatBubble**

Create `packages/ui/src/components/chat-bubble.tsx`:

```tsx
import * as React from 'react'

import { cn } from '@/lib/utils'

interface ChatBubbleProps extends React.ComponentProps<'div'> {
  role: 'user' | 'assistant' | 'system'
  children: React.ReactNode
  timestamp?: string
}

function ChatBubble({
  className,
  role,
  children,
  timestamp,
  ...props
}: ChatBubbleProps) {
  return (
    <div
      className={cn(
        'flex w-full gap-3',
        role === 'user' ? 'justify-end' : 'justify-start',
        className
      )}
      data-slot="chat-bubble"
      data-role={role}
      {...props}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed',
          role === 'user' && 'bg-primary/10 text-foreground',
          role === 'assistant' && 'bg-card text-foreground border border-border',
          role === 'system' && 'bg-destructive/10 text-destructive text-[12px] italic'
        )}
      >
        {children}
        {timestamp && (
          <div className="mt-1 text-right text-[10px] text-muted-foreground">
            {timestamp}
          </div>
        )}
      </div>
    </div>
  )
}

export { ChatBubble }
export type { ChatBubbleProps }
```

**Step 2: Implement StreamingText**

Create `packages/ui/src/components/streaming-text.tsx`:

```tsx
import * as React from 'react'

import { cn } from '@/lib/utils'

interface StreamingTextProps extends React.ComponentProps<'div'> {
  content: string
  isStreaming?: boolean
}

function StreamingText({
  className,
  content,
  isStreaming = false,
  ...props
}: StreamingTextProps) {
  return (
    <div
      className={cn('text-[13px] leading-relaxed text-foreground', className)}
      data-slot="streaming-text"
      {...props}
    >
      <span className="whitespace-pre-wrap">{content}</span>
      {isStreaming && (
        <span
          className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-text-bottom"
          aria-hidden
        />
      )}
    </div>
  )
}

export { StreamingText }
export type { StreamingTextProps }
```

**Step 3: Add exports to index.ts**

```typescript
export { ChatBubble, type ChatBubbleProps } from './components/chat-bubble'
export { StreamingText, type StreamingTextProps } from './components/streaming-text'
```

**Step 4: Verify build**

Run: `cd packages/ui && pnpm build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add packages/ui/src/components/chat-bubble.tsx packages/ui/src/components/streaming-text.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add ChatBubble and StreamingText components"
```

---

### Task 14: ToolCallCard + SessionStatusBar

Used by: Sessions (tool call visualization, bottom status bar).

**Files:**
- Create: `packages/ui/src/components/tool-call-card.tsx`
- Create: `packages/ui/src/components/session-status-bar.tsx`

**Step 1: Implement ToolCallCard**

Create `packages/ui/src/components/tool-call-card.tsx`:

```tsx
import * as React from 'react'
import { useState } from 'react'
import { ChevronDown, Terminal } from 'lucide-react'

import { cn } from '@/lib/utils'

interface ToolCallCardProps extends React.ComponentProps<'div'> {
  toolName: string
  toolIcon?: React.ReactNode
  params?: Record<string, unknown>
  result?: string
  status?: 'running' | 'completed' | 'error'
  defaultExpanded?: boolean
}

function ToolCallCard({
  className,
  toolName,
  toolIcon,
  params,
  result,
  status = 'completed',
  defaultExpanded = false,
  ...props
}: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-card text-[12px] transition-colors',
        status === 'running' && 'border-primary/30',
        status === 'error' && 'border-destructive/30',
        className
      )}
      data-slot="tool-call-card"
      {...props}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left"
      >
        <span className="shrink-0 text-muted-foreground">
          {toolIcon ?? <Terminal className="size-3.5" />}
        </span>
        <span className="flex-1 truncate font-medium font-mono text-foreground">
          {toolName}
        </span>
        {status === 'running' && (
          <span className="size-2 shrink-0 animate-pulse rounded-full bg-primary" />
        )}
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform duration-150',
            expanded && 'rotate-180'
          )}
        />
      </button>
      {expanded && (
        <div className="space-y-2 border-t border-border px-3 py-2">
          {params && Object.keys(params).length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Parameters
              </p>
              <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-[11px] text-foreground">
                {JSON.stringify(params, null, 2)}
              </pre>
            </div>
          )}
          {result && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Result
              </p>
              <pre className="max-h-48 overflow-auto rounded bg-muted p-2 font-mono text-[11px] text-foreground">
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export { ToolCallCard }
export type { ToolCallCardProps }
```

**Step 2: Implement SessionStatusBar**

Create `packages/ui/src/components/session-status-bar.tsx`:

```tsx
import * as React from 'react'
import { Clock, Coins, Zap } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SessionStatusBarProps extends React.ComponentProps<'div'> {
  status: 'idle' | 'running' | 'completed' | 'error'
  duration?: string
  tokenCount?: number
  cost?: number
}

const statusConfig = {
  idle: { color: 'bg-muted-foreground', label: 'Idle' },
  running: { color: 'bg-primary animate-pulse', label: 'Running' },
  completed: { color: 'bg-[var(--success)]', label: 'Completed' },
  error: { color: 'bg-destructive', label: 'Error' },
}

function SessionStatusBar({
  className,
  status,
  duration,
  tokenCount,
  cost,
  ...props
}: SessionStatusBarProps) {
  const { color, label } = statusConfig[status]

  return (
    <div
      className={cn(
        'flex h-7 items-center justify-between border-t border-border bg-card px-3 text-[11px] text-muted-foreground',
        className
      )}
      data-slot="session-status-bar"
      {...props}
    >
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className={cn('inline-block size-1.5 rounded-full', color)} />
          {label}
        </span>
        {duration && (
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {duration}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {tokenCount !== undefined && (
          <span className="flex items-center gap-1">
            <Zap className="size-3" />
            {tokenCount.toLocaleString()} tokens
          </span>
        )}
        {cost !== undefined && (
          <span className="flex items-center gap-1">
            <Coins className="size-3" />
            ${cost.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  )
}

export { SessionStatusBar }
export type { SessionStatusBarProps }
```

**Step 3: Add exports to index.ts**

```typescript
export { ToolCallCard, type ToolCallCardProps } from './components/tool-call-card'
export { SessionStatusBar, type SessionStatusBarProps } from './components/session-status-bar'
```

**Step 4: Verify build**

Run: `cd packages/ui && pnpm build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add packages/ui/src/components/tool-call-card.tsx packages/ui/src/components/session-status-bar.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add ToolCallCard and SessionStatusBar components"
```

---

### Task 15: CodeBlock

Used by: Sessions (code in chat), Figma Pipeline (generated code), File Review (inline code).

**Files:**
- Create: `packages/ui/src/components/code-block.tsx`
- Modify: `packages/ui/package.json` (add shiki dependency)

**Step 1: Install shiki**

```bash
cd packages/ui && pnpm add shiki
```

**Step 2: Implement CodeBlock**

Create `packages/ui/src/components/code-block.tsx`:

```tsx
import * as React from 'react'
import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { createHighlighter, type Highlighter } from 'shiki'

import { cn } from '@/lib/utils'

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: ['typescript', 'javascript', 'python', 'json', 'bash', 'css', 'html', 'tsx', 'jsx', 'yaml', 'markdown'],
    })
  }
  return highlighterPromise
}

interface CodeBlockProps extends React.ComponentProps<'div'> {
  code: string
  language?: string
  showLineNumbers?: boolean
  showCopyButton?: boolean
}

function CodeBlock({
  className,
  code,
  language = 'typescript',
  showLineNumbers = false,
  showCopyButton = true,
  ...props
}: CodeBlockProps) {
  const [html, setHtml] = useState<string>('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let mounted = true
    getHighlighter().then((highlighter) => {
      if (!mounted) return
      const result = highlighter.codeToHtml(code, {
        lang: language,
        themes: { dark: 'github-dark', light: 'github-light' },
      })
      setHtml(result)
    })
    return () => { mounted = false }
  }, [code, language])

  function handleCopy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={cn('group relative rounded-md border border-border bg-card', className)}
      data-slot="code-block"
      {...props}
    >
      <div className="flex h-7 items-center justify-between border-b border-border px-3">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {language}
        </span>
        {showCopyButton && (
          <button
            type="button"
            onClick={handleCopy}
            className="cursor-pointer rounded-sm p-1 text-muted-foreground opacity-0 transition-all duration-150 hover:text-foreground group-hover:opacity-100"
            aria-label="Copy code"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
        )}
      </div>
      {html ? (
        <div
          className={cn(
            'overflow-x-auto p-3 text-[12px] leading-relaxed [&_pre]:!bg-transparent [&_code]:!bg-transparent',
            showLineNumbers && '[&_.line::before]:mr-4 [&_.line::before]:inline-block [&_.line::before]:w-4 [&_.line::before]:text-right [&_.line::before]:text-muted-foreground [&_.line::before]:content-[counter(line)] [&_.line]:counter-increment-[line] [&_code]:counter-reset-[line]'
          )}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto p-3 font-mono text-[12px] text-foreground">
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}

export { CodeBlock }
export type { CodeBlockProps }
```

**Step 3: Add export to index.ts**

```typescript
export { CodeBlock, type CodeBlockProps } from './components/code-block'
```

**Step 4: Add shiki to tsup externals if needed**

Read `packages/ui/tsup.config.ts` and ensure shiki is NOT externalized (it should be bundled, or alternatively keep it external and let the consuming app install it). Given shiki is large, keep it as a dependency and let tree-shaking handle it.

**Step 5: Verify build**

Run: `cd packages/ui && pnpm build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add packages/ui/src/components/code-block.tsx packages/ui/package.json packages/ui/src/index.ts
git commit -m "feat(ui): add CodeBlock component with shiki syntax highlighting"
```

---

### Task 16: DiffViewer + InlineComment

Used by: File Review (code diffs with AI annotations), Figma Pipeline (generated code review).

**Files:**
- Create: `packages/ui/src/components/diff-viewer.tsx`
- Create: `packages/ui/src/components/inline-comment.tsx`

**Step 1: Implement DiffViewer**

Create `packages/ui/src/components/diff-viewer.tsx`:

```tsx
import * as React from 'react'

import { cn } from '@/lib/utils'

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  content: string
  lineNumber?: { old?: number; new?: number }
}

interface DiffViewerProps extends React.ComponentProps<'div'> {
  lines: DiffLine[]
  mode?: 'unified' | 'side-by-side'
  renderLineAnnotation?: (lineIndex: number) => React.ReactNode
}

const lineTypeStyles: Record<DiffLine['type'], string> = {
  added: 'bg-[var(--success)]/8 text-[var(--success)]',
  removed: 'bg-destructive/8 text-destructive',
  unchanged: 'text-foreground',
}

const lineTypePrefix: Record<DiffLine['type'], string> = {
  added: '+',
  removed: '-',
  unchanged: ' ',
}

function DiffViewer({
  className,
  lines,
  mode = 'unified',
  renderLineAnnotation,
  ...props
}: DiffViewerProps) {
  return (
    <div
      className={cn('overflow-auto rounded-md border border-border font-mono text-[12px]', className)}
      data-slot="diff-viewer"
      {...props}
    >
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, index) => (
            <React.Fragment key={index}>
              <tr className={cn('leading-5', lineTypeStyles[line.type])}>
                <td className="w-10 select-none border-r border-border px-2 text-right text-muted-foreground/50">
                  {line.lineNumber?.old ?? ''}
                </td>
                {mode === 'side-by-side' && (
                  <td className="w-10 select-none border-r border-border px-2 text-right text-muted-foreground/50">
                    {line.lineNumber?.new ?? ''}
                  </td>
                )}
                {mode === 'unified' && (
                  <td className="w-10 select-none border-r border-border px-2 text-right text-muted-foreground/50">
                    {line.lineNumber?.new ?? ''}
                  </td>
                )}
                <td className="w-5 select-none text-center">
                  {lineTypePrefix[line.type]}
                </td>
                <td className="whitespace-pre px-2">
                  {line.content}
                </td>
              </tr>
              {renderLineAnnotation?.(index)}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export { DiffViewer }
export type { DiffViewerProps, DiffLine }
```

**Step 2: Implement InlineComment**

Create `packages/ui/src/components/inline-comment.tsx`:

```tsx
import * as React from 'react'
import { Bot, MessageSquare } from 'lucide-react'

import { cn } from '@/lib/utils'

interface InlineCommentProps extends React.ComponentProps<'div'> {
  author?: 'ai' | 'user'
  content: string
  actions?: React.ReactNode
}

function InlineComment({
  className,
  author = 'ai',
  content,
  actions,
  ...props
}: InlineCommentProps) {
  return (
    <tr>
      <td colSpan={4}>
        <div
          className={cn(
            'mx-3 my-1 rounded-md border border-primary/20 bg-primary/5 p-3',
            className
          )}
          data-slot="inline-comment"
          {...props}
        >
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-primary">
            {author === 'ai' ? (
              <Bot className="size-3.5" />
            ) : (
              <MessageSquare className="size-3.5" />
            )}
            {author === 'ai' ? 'AI Review' : 'Comment'}
          </div>
          <p className="text-[12px] leading-relaxed text-foreground">{content}</p>
          {actions && (
            <div className="mt-2 flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

export { InlineComment }
export type { InlineCommentProps }
```

**Step 3: Add exports to index.ts**

```typescript
export { DiffViewer, type DiffViewerProps, type DiffLine } from './components/diff-viewer'
export { InlineComment, type InlineCommentProps } from './components/inline-comment'
```

**Step 4: Verify build**

Run: `cd packages/ui && pnpm build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add packages/ui/src/components/diff-viewer.tsx packages/ui/src/components/inline-comment.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add DiffViewer and InlineComment components"
```

---

### Task 17: Final exports and build verification

**Files:**
- Verify: `packages/ui/src/index.ts` (all exports present)
- Verify: `packages/ui/package.json` (all deps correct)

**Step 1: Review complete index.ts**

Read `packages/ui/src/index.ts` and verify it exports ALL components:

**shadcn base (20):** Alert, Badge, Breadcrumb, Button, Card, Command, Dialog, DropdownMenu, Input, Label, Popover, Progress, ScrollArea, Select, Separator, Sheet, Switch, Table, Tabs, Textarea, Tooltip, Toaster/Sonner

**Custom primitives (16):** SegmentedControl, StatusBadge, CostBadge, EmptyState, KVRow, Spinner, SearchField, SplitPane, Panel, TabBar, DataTable, SourceList, FileTree, ChatBubble, StreamingText, ToolCallCard, SessionStatusBar, CodeBlock, DiffViewer, InlineComment

**Utility:** cn

**Step 2: Full build**

Run: `cd packages/ui && pnpm build`
Expected: Build succeeds, `dist/index.js` and `dist/index.d.ts` generated

**Step 3: TypeScript check**

Run: `cd packages/ui && pnpm typecheck`
Expected: No type errors

**Step 4: Verify dist output size is reasonable**

Run: `ls -la packages/ui/dist/`
Expected: `index.js` (bundled output), `index.d.ts` (type declarations)

**Step 5: Test import from desktop app**

Run: `cd apps/desktop && pnpm typecheck`
Expected: No errors — existing imports from `@agent-coding/ui` still work

**Step 6: Commit**

```bash
git add packages/ui/
git commit -m "feat(ui): complete UI primitives library with all components"
```

---

## Summary

| Task | Components | Type |
|------|-----------|------|
| 1 | CSS design tokens | Foundation |
| 2 | Dependencies | Foundation |
| 3 | 20 shadcn primitives | shadcn install |
| 4 | Barrel exports | Foundation |
| 5 | SegmentedControl | Custom |
| 6 | StatusBadge, CostBadge | Custom |
| 7 | EmptyState, KVRow, Spinner | Custom |
| 8 | SearchField | Custom |
| 9 | SplitPane | Custom |
| 10 | Panel, TabBar | Custom |
| 11 | DataTable | Custom |
| 12 | SourceList, FileTree | Custom |
| 13 | ChatBubble, StreamingText | Custom |
| 14 | ToolCallCard, SessionStatusBar | Custom |
| 15 | CodeBlock | Custom |
| 16 | DiffViewer, InlineComment | Custom |
| 17 | Final verify | Verification |

**Total: 36+ components (20 shadcn + 16 custom) across 17 tasks.**
