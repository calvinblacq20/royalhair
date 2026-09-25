import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SALON } from "../data/business";
import { spring } from "../motion";
import { AppIcon } from "./Brand";

interface Note {
  id: number;
  title: string;
  body: string;
}

const NotifyContext = createContext<(title: string, body: string) => void>(() => {});

export const useNotify = () => useContext(NotifyContext);

/** Push-style banner from the studio, standing in for real phone notifications in the demo. */
export function NotifyProvider({ children }: { children: ReactNode }) {
  const [note, setNote] = useState<Note | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const notify = useCallback((title: string, body: string) => {
    window.clearTimeout(timer.current);
    setNote({ id: Date.now(), title, body });
    timer.current = window.setTimeout(() => setNote(null), 5200);
  }, []);

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      {createPortal(
        <div className="toast-layer" aria-live="polite">
          <AnimatePresence>
            {note && (
              <motion.button
                key={note.id}
                className="toast"
                initial={{ y: -120, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -120, opacity: 0 }}
                transition={spring.small}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.6, bottom: 0 }}
                onDragEnd={(_, info) => info.offset.y < -30 && setNote(null)}
                onClick={() => setNote(null)}
                aria-label={`${SALON.name}: ${note.title}. Dismiss`}
              >
                <AppIcon size={38} />
                <span className="toast-body">
                  <span className="between">
                    <strong>{SALON.name}</strong>
                    <span className="subtle t-cap">now</span>
                  </span>
                  <span style={{ display: "block", fontWeight: 500 }}>{note.title}</span>
                  <span className="muted">{note.body}</span>
                </span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </NotifyContext.Provider>
  );
}
