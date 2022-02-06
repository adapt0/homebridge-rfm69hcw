/////////////////////////////////////////////////////////////////////////////
/** @file
Utility functions

\copyright Copyright (c) 2022 Chris Byrne. All rights reserved.
Licensed under the MIT License. Refer to LICENSE file in the project root. */
/////////////////////////////////////////////////////////////////////////////

/**
 * asynchronously delay by ms milliseconds
 * @param ms milliseconds to delay for
 * @returns void
 */
export async function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
