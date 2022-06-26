/**
 * @package modulus
 * @author Alexandre ELISÉ <contact@alexandree.io>
 * @copyright (c) 2009 - present. Alexandre ELISÉ. All rights reserved.
 * @license MIT
 * @link https://alexandree.io
 */
(function (CORE) {
    "use strict";
    
    /**
     * Modulus processor to try out a pattern
     *
     * @param pixel (count: how many per frame, red: red channel, green: green channel, blue: blue channel, alpha: alpha channel)
     * @returns {number}
     */
    function formula (pixel) {
        // Global flag to immediately disable velvet if necessary
        if (!CORE.IS_ENABLED) {
            throw new Error("Velvet is disabled. Cannot continue.");
        }
        let x = ((pixel.red / 255 + pixel.green / 255 + pixel.blue / 255) / 3);
        pixel.red = (x * pixel.start) % 256;
        pixel.green = (x * pixel.start) % 256;
        pixel.blue = (x * pixel.start) % 256;
        pixel.alpha = 255;
        return pixel;
    }
    
    /**
     * Actual processing based on the formula
     * @param pixel
     */
    function compute (pixel) {
        // Global flag to immediately disable velvet if necessary
        if (!CORE.IS_ENABLED) {
            throw new Error("Velvet is disabled. Cannot continue.");
        }
        return formula(pixel);
    }
    
    // Public api
    CORE.processor = CORE.processor || {};
    CORE.processor.modulus = compute;
    
    return CORE;
    
}(window.VELVET || {}));
