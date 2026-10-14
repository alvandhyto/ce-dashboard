/** Props every vendor configurator receives from the host app. */
export interface ConfiguratorProps {
    onBack: () => void;
    isDarkMode: boolean;
    toggleTheme: () => void;
}
