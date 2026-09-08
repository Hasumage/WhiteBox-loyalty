"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import styles from "./arena.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  description: ReactNode;
};

export function ActionButton({
  description,
  disabled,
  onClick,
  children,
  ...props
}: Props) {
  const [open, setOpen] = useState(false);
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);
  const reduced = useReducedMotion();
  const id = useId();
  function clearTimer() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  function release() {
    clearTimer();
    setOpen(false);
    setHolding(false);
  }
  useEffect(() => clearTimer, []);

  return (
    <>
      <button
        {...props}
        type="button"
        aria-disabled={disabled || undefined}
        aria-describedby={open ? id : undefined}
        data-action-help
        data-holding={holding || undefined}
        onPointerDown={(event) => {
          clearTimer();
          suppressClick.current = false;
          if (!event.isPrimary || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          origin.current = { x: event.clientX, y: event.clientY };
          setHolding(true);
          timer.current = setTimeout(() => {
            suppressClick.current = true;
            setOpen(true);
          }, 400);
        }}
        onPointerMove={(event) => {
          if (
            Math.hypot(
              event.clientX - origin.current.x,
              event.clientY - origin.current.y,
            ) > 12
          ) {
            release();
            suppressClick.current = true;
          }
        }}
        onPointerUp={release}
        onPointerCancel={() => {
          release();
          suppressClick.current = true;
        }}
        onLostPointerCapture={release}
        onBlur={release}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ")
            suppressClick.current = false;
          if (event.key === "F1") {
            event.preventDefault();
            setOpen(true);
          }
          if (event.key === "Escape") release();
        }}
        onKeyUp={(event) => {
          if (event.key === "F1") release();
        }}
        onClick={(event) => {
          if (suppressClick.current || disabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.(event);
        }}
      >
        {children}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role="tooltip"
            className={styles.holdInfo}
            initial={{ opacity: 0, y: reduced ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : 4 }}
            transition={{ duration: reduced ? 0 : 0.18, ease: "easeOut" }}
          >
            <strong>{props["aria-label"]}</strong>
            <div className={styles.holdDescription}>{description}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
