export declare const SHARED_PROPERTIES: Record<string, { minimum?: number; maximum?: number }>;
export declare const ELEMENTS: Record<string, { required: string[]; properties: Record<string, unknown> }>;
export declare const ANIMATION_KINDS: string[];
export declare const ANIMATION_FIELDS: Record<string, string>;
export declare function buildSchema(): Record<string, unknown>;
