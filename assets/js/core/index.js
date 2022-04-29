/**
 * @package
 * @author Alexandre ELISÉ <contact@alexandree.io>
 * @copyright (c) 2022 - present. Alexandre ELISÉ. All rights reserved.
 * @license MIT
 * @link https://alexandree.io
 */
(function (myGlobal) {
    "use strict";
    myGlobal.VELVET = myGlobal.VELVET || {};
    
    /**
     * Global flag to enable/disable Velvet processing instantly if necessary
     * @type {boolean}
     */
    myGlobal.VELVET.IS_ENABLED = true;
    
    /**
     * How many processors (or filters) can we use to process raw video data
     * @type {number}
     */
    const PROCESSOR_MAX_COUNT = 10;
    
    /**
     * List of processors to load to do realtime video processing
     * The order might be important. Hence, the use of an array for that purpose.
     * @type {*[]}
     */
    let processors = [];
    
    /**
     * Variable holding the whole app root "namespace"
     * @type {*|{}}
     */
    let CORE = myGlobal.VELVET;
    
    /**
     * Actual realtime video processing using javascript
     * @returns {(function(*, *, *): void)|*}
     */
    function processWithVelvet () {
        return function (currentVideo, ctx1, ctx2, givenProcessors) {
            // Global flag to immediately disable velvet if necessary
            if (!CORE.IS_ENABLED) {
                // Stop video processing
                stopStreamedVideo(currentVideo);
                ctx1.clearRect(0, 0, ctx1.canvas.width, ctx1.canvas.height);
                ctx2.clearRect(0, 0, ctx2.canvas.width, ctx2.canvas.height);
                return;
            }
            ctx1.drawImage(currentVideo, 0, 0, currentVideo.videoWidth, currentVideo.videoHeight);
            // 32bits image raw data
            let frame = ctx1.getImageData(0, 0, currentVideo.videoWidth, currentVideo.videoHeight);
            // How many pixels in the current image 4 bytes per pixel (r,g,b,a)
            let l = Math.floor(frame.data.length / 4);
            
            for (let i = 0; i < l; i++) {
                let pixel = {
                    count: l,
                    start: 0,
                    red: 0,
                    green: 0,
                    blue: 0,
                    alpha: 0
                };
                pixel.start = (i * 4);
                pixel.red = frame.data[pixel.start];
                pixel.green = frame.data[pixel.start + 1];
                pixel.blue = frame.data[pixel.start + 2];
                pixel.alpha = frame.data[pixel.start + 3];
                
                // If no processor ignore this step
                if (!givenProcessors.length) {
                    continue;
                }
                
                // Execute all processor in array order
                givenProcessors.forEach((currentProcessor) => {
                    if (typeof CORE.processor[currentProcessor] !== "function") {
                        return;
                    }
                    // Do processing
                    pixel = CORE.processor[currentProcessor](pixel);
                    
                    // Assign back the output of the current processor
                    frame.data[pixel.start] = pixel.red;
                    frame.data[pixel.start + 1] = pixel.green;
                    frame.data[pixel.start + 2] = pixel.blue;
                    frame.data[pixel.start + 3] = pixel.alpha;
                });
                
            }
            ctx2.putImageData(frame, 0, 0);
            requestAnimationFrame(function () {
                return processWithVelvet()(currentVideo, ctx1, ctx2, processors);
            });
        };
    }
    
    /**
     * Activate video stream from webcam
     */
    function activateVideo () {
        // Global flag to immediately disable velvet if necessary
        if (!CORE.IS_ENABLED) {
            throw new Error("Velvet is disabled. Cannot continue.");
        }
        // Prefer camera resolution nearest to 1280x720.
        const constraints = { audio: false, video: { width: 1280, height: 720 } };
        navigator.mediaDevices.getUserMedia(constraints)
            .then(
                function (mediaStream) {
                    const video = CORE.elements.original;
                    const velvetCanvas1 = CORE.elements.reader;
                    const velvetCanvas2 = CORE.elements.writer;
                    let ctx1 = velvetCanvas1.getContext("2d");
                    let ctx2 = velvetCanvas2.getContext("2d");
                    
                    if (!(mediaStream instanceof MediaStream)) {
                        throw new Error("Unfortunately this is not a recognized MediaStream. Cannot continue.");
                    }
                    
                    // Get active processors
                    processors = CORE.getProcessors();
                    
                    video.srcObject = mediaStream;
                    
                    video.onloadeddata = function () {
                        velvetCanvas1.width = video.videoWidth;
                        velvetCanvas1.height = video.videoHeight;
                        
                        velvetCanvas2.width = video.videoWidth;
                        velvetCanvas2.height = video.videoHeight;
                    };
                    
                    video.onloadedmetadata = function () {
                        video.play();
                    };
                    
                    video.onplay = function () {
                        requestAnimationFrame(function () {
                            return processWithVelvet()(video, ctx1, ctx2, processors);
                        });
                    };
                })
            .catch((err) => {
                    throw err;
                }
            ); // always check for errors at the end.
    }
    
    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop
     * @param videoElem
     */
    function stopStreamedVideo (videoElem) {
        const stream = videoElem.srcObject;
        const tracks = stream.getTracks();
        
        tracks.forEach(function (track) {
            track.stop();
        });
        
        videoElem.srcObject = null;
    }
    
    /**
     * Should stop video when out of focus to prevent it running continuously for no valid reason
     * @param evtStopVideoProcessing
     */
    function stopVideoProcessingWhenOutOfFocus (evtStopVideoProcessing) {
        evtStopVideoProcessing.preventDefault();
        evtStopVideoProcessing.stopPropagation();
        
        // Detect when current page is still visible
        if (myGlobal.document.visibilityState === "visible") {
            return;
        }
        // Simple trick but works for now. Stop video processing when changing tab
        myGlobal.location.reload();
        CORE.IS_ENABLED = false;
    }
    
    // Public api
    
    /**
     * Get the array of active processors
     * @returns {*[]}
     */
    CORE.getProcessors = function getProcessors () {
        return processors;
    };
    
    /**
     * Add realtime video processor to processors array
     * Each processor will be executed in array order
     * //TODO: load more than one processor at once
     *
     * @param value
     * @returns {*[]}
     */
    CORE.loadProcessor = function loadProcessor (value) {
        // Global flag to immediately disable velvet if necessary
        if (!CORE.IS_ENABLED) {
            throw new Error("Velvet is disabled. Cannot continue.");
        }
        
        // If processor array is empty cannot remove so throw Underflow Exception
        if (processors.length > PROCESSOR_MAX_COUNT) {
            throw new Error(`Overflow Exception: Cannot add more than ${PROCESSOR_MAX_COUNT} processors for now.`);
        }
        
        // If processor already exists stop here
        if (processors.indexOf(value) !== -1) {
            throw new Error(`${value} processor already exists.`);
        }
        processors.push(value);
        myGlobal.console.info(`${value} processor loaded.`);
        return processors;
    };
    
    /**
     * Add realtime video processor to processors array
     * Each processor will be executed in array order
     * //TODO: unload more than one processor at once
     *
     * @param value
     * @returns {*[]}
     */
    CORE.unloadProcessor = function unloadProcessor (value) {
        // If processor array is empty cannot remove so throw Underflow Exception
        if (!processors.length) {
            throw new Error("Underflow Exception: Cannot remove item from empty array. No processor at the moment.");
        }
        
        // If processor does not exist stop here
        let index = processors.indexOf(value);
        if (index === -1) {
            throw new Error(`${value} processor does not exists yet.`);
        }
        processors.splice(index, 1);
        myGlobal.console.info(`${value} processor unloaded.`);
        return processors;
    };
    
    // Stop streaming video
    CORE.stop = stopStreamedVideo;
    
    // Initial kick-off of the app
    CORE.init = function init () {
        myGlobal.addEventListener("DOMContentLoaded", function () {
            // HTML elements used in this app
            CORE.elements = {
                original: document.querySelector(".velvet__video"),
                reader: document.querySelector(".velvet__canvas--1"),
                writer: document.querySelector(".velvet__canvas--2"),
                play: document.querySelector(".velvet__video--play"),
                output: document.querySelector(".velvet__output")
            };
            
            CORE.elements.play.addEventListener("click", function (eventClickPlayVideo) {
                eventClickPlayVideo.preventDefault();
                eventClickPlayVideo.stopPropagation();
                const output = CORE.elements.output;
                output.style.color = "dodgerblue";
                try {
                    // Global flag to immediately disable velvet if necessary
                    if (!CORE.IS_ENABLED) {
                        output.innerText = "Velvet is disabled. Cannot continue.";
                        output.style.color = "red";
                        myGlobal.console.error("Velvet is disabled. Cannot continue.");
                        return;
                    }
                    CORE.loadProcessor("grayscale");
                    activateVideo();
                } catch (exception) {
                    output.innerText = exception.message;
                    output.style.color = "red";
                    myGlobal.console.error(exception);
                    stopStreamedVideo(CORE.elements.original);
                }
            }, false);
            
            // Should stop video when out of focus to prevent it running continuously for no valid reason
            myGlobal.addEventListener("visibilitychange", stopVideoProcessingWhenOutOfFocus, false);
            
        }, false);
        
        return CORE;
    };
}(window));
