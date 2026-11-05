import type {Technique} from './speed-math.mjs';
export const SPEED_MATH_CHECKED_AT:string;
export type MathSource={id:string;institution:string;kind:string;title:string;publishedAt:string|null;checkedAt:string;url:string;scope:string};
export const speedMathSources:MathSource[];
export function sourcesForTechnique(technique?:Technique):MathSource[];
