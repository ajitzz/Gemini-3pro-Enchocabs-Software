import React from "react";

type AnyProps = Record<string, any>;

const motionProps = new Set([
  "initial",
  "animate",
  "exit",
  "transition",
  "variants",
  "whileHover",
  "whileTap",
  "whileInView",
  "whileFocus",
  "whileDrag",
  "layout",
  "layoutId",
  "onLayoutAnimationStart",
  "onLayoutAnimationComplete",
  "onViewportBoxUpdate",
  "onAnimationStart",
  "onAnimationComplete",
  "onUpdate",
  "onDragStart",
  "onDrag",
  "onDragEnd",
  "onDirectionLock",
  "onDragTransitionEnd",
  "drag",
  "dragControls",
  "dragListener",
  "dragMomentum",
  "dragElastic",
  "dragDirectionLock",
  "dragPropagation",
  "dragConstraints",
  "dragSnapToOrigin",
  "_dragValueX",
  "_dragValueY",
  "dragTransition",
  "onPan",
  "onPanStart",
  "onPanSessionStart",
  "onPanEnd",
  "onTap",
  "onTapStart",
  "onTapCancel",
  "viewport",
  "custom",
  "inherit",
]);

function createMotion(tag: keyof JSX.IntrinsicElements) {
  return React.forwardRef<HTMLElement, AnyProps>((props, ref) => {
    const filteredProps: AnyProps = {};
    Object.keys(props).forEach((key) => {
      if (!motionProps.has(key)) {
        filteredProps[key] = props[key];
      }
    });
    return React.createElement(tag, { ref, ...filteredProps }, props.children);
  }) as unknown as React.FC<AnyProps>;
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
