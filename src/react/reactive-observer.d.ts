import { Selector } from '@legendapp/state';
import { FC } from 'react';
import type { BindKeys } from './reactInterfaces';
export type ShapeWith$<T, T2 extends keyof T = keyof T> = Partial<T> & {
    [K in T2 as K extends `$${string & K}` ? K : `$${string & K}`]?: Selector<T[K]>;
};
export type ObjectShapeWith$<T> = {
    [K in keyof T]: T[K] extends FC<infer P> ? FC<ShapeWith$<P>> : T[K];
};
export declare const hasSymbol: false | ((key: string) => symbol);
export declare function observer<P = object>(component: FC<P>): FC<P>;
export declare function reactive<P = object, P2 extends keyof P = keyof P>(component: FC<P>, bindKeys?: BindKeys<P>): FC<ShapeWith$<P, P2>>;
export declare function reactiveObserver<P = object>(component: FC<P>, bindKeys?: BindKeys<P>): FC<ShapeWith$<P, keyof P>>;
export declare function reactiveComponents<P extends Record<string, FC>>(components: P): ObjectShapeWith$<P>;
