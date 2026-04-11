import React from "react";

type AnyProps = Record<string, any>;

function createMotion(tag: keyof JSX.IntrinsicElements) {
  return React.forwardRef<HTMLElement, AnyProps>((props, ref) =>
    React.createElement(tag, { ref, ...props }, props.children)
  ) as unknown as React.FC<AnyProps>;
}

export const motion: any = new Proxy(
  {},
  {
    get: (_, key: string) => createMotion(key as keyof JSX.IntrinsicElements),
  }
) as any;

export const AnimatePresence: React.FC<AnyProps> = ({ children }) => <>{children}</>;

export type Variants = Record<string, any>;
export type Transition = Record<string, any>;

export function useInView(..._args: any[]): boolean {
  return true;
}

export function useReducedMotion(..._args: any[]): boolean {
  return false;
}
