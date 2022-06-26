/**
 * @package grayscale
 * @author Alexandre ELISÉ <contact@alexandree.io>
 * @copyright (c) 2022 - present. Alexandre ELISÉ. All rights reserved.
 * @license MIT
 * @link https://alexandree.io
 */
(function (CORE) {
    "use strict";
    
    /**
     * Grayscale processor based on a known formula
     *
     * @see https://en.wikipedia.org/wiki/SRGB
     * @param pixel (count: how many per frame, red: red channel, green: green channel, blue: blue channel, alpha: alpha channel)
     * @returns {number}
     */
    function formula (pixel) {
        // Global flag to immediately disable velvet if necessary
        if (!CORE.IS_ENABLED) {
            throw new Error("Velvet is disabled. Cannot continue.");
        }
        let { red, green, blue } = pixel;
        let Clinear = (0.2126 * (red / 255.0)) + (0.7152 * (green / 255.0)) + (0.0722 * (blue / 255.0));
        if (Clinear <= 0.0031308) {
            return Math.floor((12.92 * Clinear) * 255);
        }
        if (Clinear > 0.0031308) {
            return Math.floor((1.055 * Math.pow(Clinear, (1 / 2.4)) - 0.055) * 255);
        }
        return 255;
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
        let grayscale = formula(pixel);
        pixel.red = grayscale;
        pixel.green = grayscale;
        pixel.blue = grayscale;
        pixel.alpha = 255;
        return pixel;
    }
    
    // Public api
    CORE.processor = CORE.processor || {};
    CORE.processor.grayscale = compute;
    
    return CORE;
    
}(window.VELVET || {}));
