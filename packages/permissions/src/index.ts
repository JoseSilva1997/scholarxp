// Package entry: re-exports the evaluator and feature catalog.
// This file exists so bundlers/builders emit a predictable `dist/index.*` output.
// Keep this thin to avoid duplicating domain logic.
export * from './permissions';
