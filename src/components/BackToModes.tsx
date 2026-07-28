import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface BackToModesProps {
  onClick?: () => void;
  to?: string;
}

export function BackToModes({ onClick, to }: BackToModesProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const threshold = typeof window !== "undefined" ? window.innerHeight * 0.25 : 400;
      setVisible(window.scrollY > threshold);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      window.location.href = to;
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.9 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={cn(
            "fixed z-30 right-6 bottom-36 sm:bottom-40",
            "pointer-events-none"
          )}
        >
          <Button
            onClick={handleClick}
            size="icon"
            aria-label="Back to modes"
            className={cn(
              "pointer-events-auto h-11 w-11 rounded-full",
              "glass-panel bg-card/80 hover:bg-card",
              "border border-border/50 shadow-lg",
              "text-foreground hover:text-primary",
              "transition-colors duration-200"
            )}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
