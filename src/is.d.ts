export declare const hasOwnProperty: (v: PropertyKey) => boolean;
export declare function isArray(obj: unknown): obj is Array<any>;
export declare function isString(obj: unknown): obj is string;
export declare function isObject(obj: unknown): obj is Record<any, any>;
export declare function isFunction(obj: unknown): obj is Function;
export declare function isPrimitive(arg: unknown): arg is string | number | bigint | boolean | symbol;
export declare function isDate(obj: unknown): obj is Date;
export declare function isSymbol(obj: unknown): obj is symbol;
export declare function isBoolean(obj: unknown): obj is boolean;
export declare function isPromise<T>(obj: unknown): obj is Promise<T>;
export declare function isEmpty(obj: object): boolean;
