import { motion } from "framer-motion"
import { DockSpacer } from "./Dock";

export const DesktopContent = () => {
    //const { pathname } = useLocation();

    return (
        <motion.div className="flex h-full w-full select-none flex-col items-center justify-between" initial={{ opacity: 0 }} transition={{ duration: 0.15, ease: "easeOut" }}>
            <div className="pt-6 md:pt-8" />
            <header />
            <div className="pt-6 md:pt-8" />
            <motion.div className="flex w-full grow overflow-hidden" initial={{ opacity: 0, scale: 1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1 }} transition={{ duration: 0.2, ease: "easeOut", delay: 0.2 }}></motion.div>
            <div className="pt-6" />
            <DockSpacer />
        </motion.div>
    );
};
