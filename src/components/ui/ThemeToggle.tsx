import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { IconButton } from "./Button";

export function ThemeToggle() {
    const { isDarkMode, toggleTheme } = useTheme();

    return (
        <IconButton
            label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
        >
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </IconButton>
    );
}
