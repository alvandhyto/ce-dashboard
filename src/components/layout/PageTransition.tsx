import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/** Short cross-fade between pages. Wrap in <AnimatePresence mode="wait"> and give it a key per page. */
export function PageTransition({ children }: { children: ReactNode }) {
    const reduceMotion = useReducedMotion();
    const duration = reduceMotion ? 0 : 0.16;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration, ease: "easeOut" }}
            className="min-h-screen"
        >
            {children}
        </motion.div>
    );
}
