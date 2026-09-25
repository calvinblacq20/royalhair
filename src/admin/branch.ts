import { useSyncExternalStore } from "react";
import { BRANCHES } from "../data/business";

/**
 * Which branch this device is running. The front desk at West Hills should open straight onto
 * West Hills, so the choice is remembered per device rather than per session.
 * "all" is the owner's view across every branch.
 */
export type BranchScope = string | "all";

const KEY = "royalhair-admin-branch";
const listeners = new Set<() => void>();

function read(): BranchScope {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "all" || BRANCHES.some((b) => b.id === saved)) return saved!;
  } catch (error) {
    console.warn("Could not read the saved branch.", error);
  }
  return "all";
}

let scope: BranchScope = read();

export function setBranchScope(next: BranchScope) {
  scope = next;
  try {
    localStorage.setItem(KEY, next);
  } catch (error) {
    console.warn("Could not save the branch choice.", error);
  }
  listeners.forEach((listener) => listener());
}

export function useBranchScope(): BranchScope {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => scope,
    () => scope,
  );
}

/** A concrete branch for screens that can only show one (the diary): the chosen one, or the first. */
export function concreteBranchId(scope: BranchScope): string {
  return scope === "all" ? BRANCHES[0]!.id : scope;
}

export function scopeLabel(scope: BranchScope): string {
  return scope === "all" ? "All branches" : BRANCHES.find((b) => b.id === scope)?.name ?? "All branches";
}
