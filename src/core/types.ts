/** Every app, generator or not, is registered under one of these ids. */
export type AppId = "speedtest" | "placeholder" | "fortigate" | "kfc";

/** Where an app lives. "generators" apps sit behind the access gate. */
export type Section = "main" | "generators";

export type Route =
    | { name: "dashboard" }
    | { name: "generators" }
    | { name: "app"; appId: AppId };

/** Props the shell passes to every app. Theme comes from useTheme(), not props. */
export interface AppProps {
    onBack: () => void;
}
