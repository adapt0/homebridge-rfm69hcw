/////////////////////////////////////////////////////////////////////////////
/** @file
Standalone development

\copyright Copyright (c) 2022 Chris Byrne. All rights reserved.
Licensed under the MIT License. Refer to LICENSE file in the project root. */
/////////////////////////////////////////////////////////////////////////////

import Rfm69 from '@/hw/rfm69';

(async () => {
    const rfm69 = new Rfm69();
    await rfm69.init();

})().catch((e) => console.error(e));
