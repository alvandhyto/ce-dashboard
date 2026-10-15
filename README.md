# Dashboard Delivery

An internal web dashboard that bundles small tools for the delivery team: a network speedtest, standardized configuration generators for network devices (FortiGate today, more vendors later), and a sandbox app.

Everything shares one design system and one registry, so adding a new tool or generator means writing the tool itself, not rebuilding the page around it.

## Contents

- [Tools](#tools)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Files the app expects in `public/`](#files-the-app-expects-in-public)
- [Project structure](#project-structure)
- [How it fits together](#how-it-fits-together)
- [Adding a tool](#adding-a-tool)
- [Adding a configuration generator](#adding-a-configuration-generator)
- [The FortiGate generator](#the-fortigate-generator)
- [Access control](#access-control)
- [Conventions](#conventions)
- [License and credits](#license-and-credits)

## Tools

| Tool            | What it does                                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Speedtest**   | Measures latency, jitter, download and upload with a live gauge. Built on the [LibreSpeed](https://github.com/librespeed/speedtest/) engine. |
| **Generators**  | Menu of configuration generators, behind an access key. Currently: **FortiGate** (30G and 40F, FortiOS 7.2 and 7.4, single or dual link).    |
| **Placeholder** | Tic-tac-toe against the computer. A slot for whatever comes next.                                                                            |

## Tech stack

- [React](https://react.dev) with TypeScript, bundled by [Vite](https://vite.dev)
- [Tailwind CSS](https://tailwindcss.com) v4, class-based dark mode
- [Motion](https://motion.dev) (`motion/react`) for page transitions
- [Lucide](https://lucide.dev) icons

## Getting started

You need a current LTS release of Node.js.

```bash
npm install
npm run dev
```

| Command           | Purpose                                   |
| ----------------- | ----------------------------------------- |
| `npm run dev`     | Start the dev server with hot reload      |
| `npm run build`   | Type-check and produce a production build |
| `npm run preview` | Serve the production build locally        |

### Environment variables

Create `.env.local` in the project root:

```bash
VITE_GENERATOR_PASSWORD=your-access-key
```

This is the key that unlocks the Generators section. Restart the dev server after changing it. If the variable is not set, a built-in default from `src/hooks/useAccessGate.ts` is used, so always set your own. Read [Access control](#access-control) before relying on it.

## Files the app expects in `public/`

The app loads these at runtime. If one is missing, the matching feature shows an error instead of crashing.

| Path                                                    | Used by                           |
| ------------------------------------------------------- | --------------------------------- |
| `icons/fortilogo.ico`                                   | FortiGate card and header         |
| `icons/lintaslogo.png`                                  | Speedtest header                  |
| `speedtest_worker.js`                                   | Speedtest (the LibreSpeed worker) |
| `templates/fortigate/Template <series> <firmware>.conf` | FortiGate generator               |

FortiGate templates are named after the model and firmware chosen in the form, for example:

```
public/templates/fortigate/Template 30G 7.2.conf
public/templates/fortigate/Template 30G 7.4.conf
public/templates/fortigate/Template 40F 7.2.conf
public/templates/fortigate/Template 40F 7.4.conf
```

The speedtest worker talks to a LibreSpeed backend. Its endpoints and options are configured through the worker and the engine's `setParameter`; see the LibreSpeed documentation for what the backend needs to serve.

## Project structure

```
src/
├── main.tsx                  Entry point
├── App.tsx                   Router: current route, access gate, page transitions
├── index.css                 Tailwind import, dark variant, scrollbar styles
├── utils.ts                  IP string helpers used by the FortiGate generator
│
├── core/                     The core: knows which tools exist
│   ├── registry.tsx          Single source of truth for every tool and generator
│   └── types.ts              AppId, Route, AppProps
│
├── pages/                    DashboardPage, GeneratorsPage, AccessGatePage
│
├── tools/                    Standalone tools
│   ├── speedtest/            model.ts, useSpeedtest.ts, SpeedGauge, SpeedtestApp, engine
│   └── placeholder/          tictactoe.ts, useTicTacToe.ts, Board, PlaceholderApp
│
├── configurators/            Configuration generators, one folder per vendor
│   └── fortigate/            definition.ts, syntax.ts, FortigateConfigurator.tsx
│
├── components/               Shared UI, knows nothing about any specific tool
│   ├── layout/               AppShell, AppHeader, PageFooter, PageTransition
│   ├── launcher/             AppCard, EmptySlot, LauncherGrid
│   ├── configurator/         ConfiguratorLayout, FieldGrid, ConfigPreview, TemplateStatus
│   └── ui/                   Button, Panel, TextField, SelectField, ToggleCard, Toast, ...
│
├── hooks/                    useTheme, useAccessGate, useConfigForm, useTemplate, ...
└── lib/                      Plain functions: templating, validation, clipboard, accent colours
```

The three top-level groups that are easy to mix up:

- **`core/`** is the shell. It holds the registry and shared types, and is not a tool itself.
- **`tools/`** holds standalone tools such as the speedtest.
- **`configurators/`** holds the generator family. Each vendor gets a folder.

## How it fits together

```
App.tsx ──reads──▶ core/registry.tsx ──imports──▶ tools/*  configurators/*
   │                                                  │
   ├── pages/ (dashboard, menu, gate)                 └── build on components/ + hooks/ + lib/
   └── ThemeProvider (light/dark, saved to localStorage)
```

- **Routing** is a small piece of state in `App.tsx`: the dashboard, the generator menu, or one tool. A tool's back button returns to the page it was opened from.
- **The registry** (`core/registry.tsx`) describes every tool once: title, description, icon, accent colour, section, component. The dashboard and the generator menu are generated from it.
- **Sections.** A tool in the `"generators"` section is only reachable after the access key is entered. Leaving the section locks it again.
- **Theme.** `ThemeProvider` toggles the `dark` class on `<html>`. Components read it through `useTheme()`, so tools only receive `onBack`.
- **Accent colours.** Each tool has an accent (`blue`, `rose`, `amber`) defined in `lib/accent.ts`. It tints the tool's icon tile and primary button; the rest of the UI stays neutral.
- **Logic and UI are separate.** Anything worth testing lives in plain functions (`tools/speedtest/model.ts`, `tools/placeholder/tictactoe.ts`, `lib/*`) with the React glue in hooks and components.

## Adding a tool

1. Create `src/tools/my-tool/` with a default-exported component that takes `AppProps`:

    ```tsx
    import type { AppProps } from "../../core/types";
    import { AppHeader } from "../../components/layout/AppHeader";
    import { AppShell } from "../../components/layout/AppShell";
    import { containerClass } from "../../components/layout/container";
    import { cn } from "../../lib/cn";

    export default function MyTool({ onBack }: AppProps) {
        return (
            <AppShell>
                <AppHeader
                    title="My tool"
                    subtitle="What it does"
                    onBack={onBack}
                    width="narrow"
                />
                <main className={cn(containerClass("narrow"), "flex-1 py-10")}>
                    …
                </main>
            </AppShell>
        );
    }
    ```

2. Add the id to `AppId` in `src/core/types.ts`.
3. Add one entry to `APPS` in `src/core/registry.tsx`:

    ```tsx
    "my-tool": {
        id: "my-tool",
        title: "My tool",
        description: "One or two sentences for the card.",
        icon: <Wrench className="h-5 w-5" />,
        accent: "blue",
        section: "main", // or "generators" to put it behind the access key
        component: MyTool,
    },
    ```

The dashboard card, navigation and back behaviour come from the registry. Reuse `Button`, `Panel`, `StatTile`, `TextField` and friends from `components/` so the tool matches the rest.

## Adding a configuration generator

A generator is a form that fills a text template. The vendor-specific parts are data in one file; the form, validation, preview, copy and download are shared.

1. Copy `src/configurators/fortigate/` to `src/configurators/<vendor>/`.
2. **`definition.ts`** is where the vendor lives. Change:
    - the model and version options,
    - `FIELDS`, the form description,
    - `buildReplacements`, which maps form values to template placeholders,
    - `templateUrl`, which points at the template file.

    A field looks like this:

    ```ts
    {
        key: "hostname",
        label: "Hostname",
        placeholder: "e.g. SW-BRANCH-01",
        span: "full",                      // "full" = both columns, default is half
        required: true,
        rules: [
            rules.maxLength(63),
            rules.pattern(/^[A-Za-z0-9-]+$/, "Use letters, numbers and hyphens only."),
        ],
        visible: (options) => options.dualLink, // optional: hide based on toggles
    }
    ```

    Built-in rules are `rules.ipv4()`, `rules.maxLength(n)` and `rules.pattern(regex, message)`. Hidden fields are neither shown nor validated.

3. **`syntax.ts`** colours the preview. Return one of `keyword`, `setting`, `end`, `comment` or `plain` for each line. Cisco IOS, for example, would treat `!` as a comment.
4. Adjust the component for the vendor's own controls (selects, toggles). `useConfigForm`, `useTemplate`, `FieldGrid`, `ConfigPreview` and `ConfiguratorLayout` do the rest.
5. Register it in `registry.tsx` with `section: "generators"`, and put the templates under `public/templates/<vendor>/`.

## The FortiGate generator

Pick a model and firmware, choose single or dual link, fill in the parameters and generate. The output can be copied or downloaded as `<hostname>.conf`.

**Template placeholders.** The generator replaces these in the template:

| Placeholder              | Value                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `[HOSTNAME]`             | Hostname                                                                                       |
| `[sid_primary]`          | Main link SID                                                                                  |
| `[sid_secondary]`        | Secondary link SID (empty on single link)                                                      |
| `[ip_primary]`           | Main link IP                                                                                   |
| `[IP_GATEWAY_INTERNET]`  | Main link IP minus one                                                                         |
| `[IP_secondary]`         | Secondary link IP, or `0.0.0.0` on single link                                                 |
| `[IP_GATEWAY_secondary]` | Secondary link IP minus one, or `0.0.0.0`                                                      |
| `[IP_LAN]`               | LAN network: first three octets of the LAN IP followed by `.0` (default LAN IP `192.168.1.99`) |
| `[IP_LOOPBACK205]`       | Loopback 205 IP                                                                                |

Replacement happens in a single pass, so a value can never be re-scanned as a placeholder. If the generated config still contains something shaped like `[NAME]`, a warning lists it. That usually means a template and `buildReplacements` have drifted apart.

**Validation.** Hostname, main link SID, main link IP and Loopback 205 IP are required; so are the secondary link fields on dual link. All IPs must be valid IPv4 addresses. A FortiOS hostname is limited to 35 characters of letters, digits, hyphens and underscores. The LAN IP is optional and falls back to the default.

**Good to know**

- The SD-WAN toggle is forced on when dual link is on. It is not used to build the output yet.
- The preview shows whether it still matches the form. Change a field after generating and it is marked as outdated.
- Templates are cached per session. If a template file is missing, the form shows an error with a Retry button.

## Access control

The Generators section asks for an access key, but **this is a convenience gate, not security**:

- `VITE_*` variables are inlined into the JavaScript bundle at build time, so anyone can read the key in the browser.
- Files in `public/`, including the config templates, are downloadable directly by URL without passing the gate.

If the templates or generated configs are sensitive, enforce access on the server or reverse proxy (basic auth, SSO or similar) and treat the in-app gate as a UI nicety.

## Conventions

- **Formatting:** Prettier, 4-space indentation.
- **Tailwind classes are written out in full.** Do not build class names from variables (`` `bg-${color}-600` ``); Tailwind can only generate classes it finds as complete strings. See `lib/accent.ts`.
- **Dark mode** uses the `dark` class on `<html>` (`@variant dark` in `index.css`). Add `dark:` variants for anything that has a colour.
- **Keep logic out of components.** Put rules and calculations in plain functions next to the tool so they can be tested without rendering anything.
- **Reuse before you build.** Check `components/ui` and `components/layout` first.

## License and credits

- The speedtest engine in `src/tools/speedtest/speedtest.ts` is adapted from [LibreSpeed](https://github.com/librespeed/speedtest/) by Federico Dossena, licensed under the GNU LGPL v3.
- Developed by AVU.
- This repository does not declare its own license yet. Add a `LICENSE` file before sharing it outside the team.
