import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

export type ClassValue = string | number | null | false | undefined | ClassValue[];

export type WithChildren<T = unknown> = T & { children?: ReactNode };

export type PolymorphicProps<E extends ElementType, P = unknown> = P &
  Omit<ComponentPropsWithoutRef<E>, keyof P> & {
    as?: E;
  };