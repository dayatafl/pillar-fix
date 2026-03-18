"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

const Toaster = ({ ...props }) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
    theme={theme}
    position={props.position ?? "bottom-center"}
    offset={props.offset ?? 96}
    mobileOffset={props.mobileOffset ?? 110}
    toastOptions={
      props.toastOptions ?? {
        style: {
          width: "fit-content",
          maxWidth: "min(42rem, calc(100vw - 2rem))",
          whiteSpace: "nowrap",
          margin: "0 auto",       // ← add this
        },
      }
    }
    className="toaster group"
    style={
      {
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        left: "50%",              // ← add this
        transform: "translateX(-50%)",  // ← add this
      }
    }
    {...props}
  />
  );
};

export { Toaster };
