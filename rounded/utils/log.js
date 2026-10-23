/** @file Provides wrapper functions for printing out debug messages. */
import { getPref } from './settings.js';
/**
 * Log a message with a [Tiling Rounded] prefix, but only
 * when debug mode is enabled.
 */
export function logDebug(...args) {
    if (getPref('debug-mode')) {
        console.log(`[Tiling Rounded] ${args}`);
    }
}
/**
 * Log an error with a [Tiling Rounded] prefix.
 */
export function logError(...args) {
    console.error(`[Tiling Rounded] ${args}`);
}
