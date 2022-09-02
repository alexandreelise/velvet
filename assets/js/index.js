/**
 * Front controller
 * @package index.js
 * @author Alexandre ELISÉ <contact@alexandree.io>
 * @copyright (c) 2022 - present. Alexandre ELISÉ. All rights reserved.
 * @license MIT
 * @link https://alexandree.io
 */
(function (CORE) {
    "use strict";
    try {
        // Global flag to immediately disable velvet if necessary
        if (!CORE.IS_ENABLED) {
            CORE.elements.output.innerText = "Velvet is disabled. Cannot continue.";
            CORE.elements.output.style.color = "red";
            return;
        }
        CORE.getProcessors().forEach((currentProcessor) => {
            CORE.disableProcessor(currentProcessor);
            CORE.unloadProcessor(currentProcessor);
        });
        CORE.loadProcessor("grayscale");
        CORE.loadProcessor("modulus");
        CORE.init();
    } catch (exception) {
        CORE.elements.output.innerText = exception.message;
        CORE.elements.output.style.color = "red";
        console.error(exception);
        CORE.getProcessors().forEach((currentProcessor) => {
           CORE.disableProcessor(currentProcessor);
           CORE.unloadProcessor(currentProcessor);
        });
        CORE.stop(CORE.elements.original);
    }
}(window.VELVET || {}));
