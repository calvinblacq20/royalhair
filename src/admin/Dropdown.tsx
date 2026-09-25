import { Check, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { spring } from "../motion";

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  /** Small text on the right of the option, e.g. a price. */
  hint?: string;
  /** Options with the same group are listed under a heading. */
  group?: string;
}

interface DropdownProps<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  /** Accessible name when there is no visible <label htmlFor={id}>. */
  label?: string;
  id?: string;
  /** pill: white pill (toolbars). soft: grey pill. field: underline form field, like the other inputs. */
  variant?: "pill" | "soft" | "field";
  /** Text before the value on the button, e.g. "Sort: ". */
  prefix?: string;
  placeholder?: string;
  align?: "start" | "end";
  className?: string;
}

/**
 * A listbox styled like the rest of the app, instead of the browser's own menu.
 * Keyboard: arrows move, Enter or Space picks, Escape closes, letters jump to matching options.
 */
export function Dropdown<T extends string>({ value, options, onChange, label, id, variant = "pill", prefix = "", placeholder = "Choose", align = "start", className = "" }: DropdownProps<T>) {
  const autoId = useId();
  const buttonId = id ?? `${autoId}-button`;
  const listId = `${autoId}-list`;
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [up, setUp] = useState(false);
  const [end, setEnd] = useState(align === "end");
  const typed = useRef({ text: "", at: 0 });
  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];

  const show = (index = Math.max(0, selectedIndex)) => {
    const rect = button.current?.getBoundingClientRect();
    const menuHeight = Math.min(options.length * 40 + 16, 320);
    setUp(Boolean(rect && rect.bottom + menuHeight + 12 > window.innerHeight && rect.top > menuHeight + 12));
    // Open towards whichever side has room, so the menu never runs off a phone screen.
    if (rect) {
      const menuWidth = Math.max(rect.width, 220);
      const fitsEnd = rect.right - menuWidth >= 8;
      const fitsStart = rect.left + menuWidth <= window.innerWidth - 8;
      setEnd(align === "end" ? fitsEnd || !fitsStart : !fitsStart && fitsEnd);
    }
    setActive(index);
    setOpen(true);
  };
  const close = (refocus = false) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };
  const pick = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    close(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        if (!open) return show();
        setActive((i) => Math.min(last, Math.max(0, i + step)));
        return;
      }
      case "Home":
      case "End":
        if (!open) return;
        e.preventDefault();
        setActive(e.key === "Home" ? 0 : last);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) pick(active);
        else show();
        return;
      case "Escape":
        if (open) {
          e.preventDefault();
          close(true);
        }
        return;
      case "Tab":
        if (open) close();
        return;
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) {
          const now = Date.now();
          typed.current = { text: now - typed.current.at < 700 ? typed.current.text + e.key.toLowerCase() : e.key.toLowerCase(), at: now };
          const from = open ? active + (typed.current.text.length === 1 ? 1 : 0) : 0;
          const order = [...options.keys()].map((k) => (k + from) % options.length);
          const match = order.find((i) => options[i]!.label.toLowerCase().startsWith(typed.current.text));
          if (match !== undefined) {
            if (open) setActive(match);
            else onChange(options[match]!.value);
          }
        }
    }
  };

  let lastGroup: string | undefined;

  return (
    <div ref={wrap} className={`dd ${variant === "field" ? "is-block" : ""} ${open ? "is-open" : ""} ${className}`}>
      <button
        ref={button}
        id={buttonId}
        type="button"
        className={`dd-btn is-${variant}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={label ? `${label}: ${selected?.label ?? placeholder}` : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={onKeyDown}
      >
        <span className={`dd-value ${selected ? "" : "is-placeholder"}`}>
          {prefix}
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" className="dd-chevron" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            ref={list}
            id={listId}
            role="listbox"
            aria-labelledby={buttonId}
            className={`dd-menu ${up ? "is-up" : ""} ${end ? "is-end" : ""}`}
            initial={{ opacity: 0, y: up ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: up ? 4 : -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={spring.micro}
            style={{ transformOrigin: up ? "bottom" : "top" }}
          >
            {options.map((option, index) => {
              const heading = option.group && option.group !== lastGroup ? option.group : null;
              lastGroup = option.group;
              const isSelected = option.value === value;
              return (
                <li key={option.value} role="presentation">
                  {heading && (
                    <span className="dd-group" aria-hidden="true">
                      {heading}
                    </span>
                  )}
                  <div
                    id={`${listId}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    className={`dd-opt ${index === active ? "is-active" : ""} ${isSelected ? "is-selected" : ""}`}
                    onPointerEnter={() => setActive(index)}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => pick(index)}
                  >
                    <span className="dd-label">{option.label}</span>
                    {option.hint && <span className="dd-hint">{option.hint}</span>}
                    <span className={`dd-check ${isSelected ? "is-on" : ""}`} aria-hidden="true">
                      {isSelected && <Check size={12} strokeWidth={2.6} />}
                    </span>
                  </div>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
