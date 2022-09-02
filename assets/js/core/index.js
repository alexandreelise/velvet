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
     * Media Source Constraints
     * @type {{audio: boolean, video: {width: {min: number, ideal: number, max: number}, height: {min: number, ideal: number, max: number}}, preferCurrentTab: boolean}}
     */
    const constraints = {
        audio: false,
        preferCurrentTab: true,
        video: {
            width: {
                min: 480,
                ideal: 1920,
                max: 2560
            },
            height: {
                min: 270,
                ideal: 1080,
                max: 1440
            }
        }
    };
    
    /**
     * Video is playing flag
     * @type {boolean}
     */
    let IS_PLAYING = false;
    
    /**
     * List of processors to load to do realtime video processing
     * The order might be important. Hence, the use of an array for that purpose.
     * @type {*[]}
     */
    let processors = [];
    
    /**
     * List of "active" processors allows us to intersect with the list of processors
     * @type {*[]}
     */
    let activeProcessors = [];
    
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
                return processWithVelvet()(currentVideo, ctx1, ctx2, CORE.getProcessors());
            });
        };
    }
    
    /**
     * Activate video stream from webcam
     */
    function activateVideo (chosenDeviceId) {
        // Global flag to immediately disable velvet if necessary
        if (!CORE.IS_ENABLED) {
            throw new Error("Velvet is disabled. Cannot continue.");
        }
        
        let updatedConstraints = {
            ...constraints,
            deviceId: {
                exact: chosenDeviceId
            }
        };
        
        myGlobal.navigator.mediaDevices.getUserMedia(updatedConstraints)
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
                    
                    if (IS_PLAYING) {
                        console.warn("Video seems to be already playing.");
                        return;
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
                        IS_PLAYING = true;
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
        return activeProcessors;
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
    
    
    /**
     * Add realtime video processor to activeProcessors array
     * Each processor will be executed in array order
     * //TODO: load more than one processor at once
     * //NOTE: there might be a better way to handle this rather than duplicating code but for now leave it as is.
     * @param value
     * @returns {*[]}
     */
    CORE.enableProcessor = function enableProcessor (value) {
        // Global flag to immediately disable velvet if necessary
        if (!CORE.IS_ENABLED) {
            throw new Error("Velvet is disabled. Cannot continue.");
        }
        
        // If processor array is empty cannot remove so throw Underflow Exception
        if (activeProcessors.length > PROCESSOR_MAX_COUNT) {
            throw new Error(`Overflow Exception: Cannot add more than ${PROCESSOR_MAX_COUNT} processors for now.`);
        }
        
        // If processor already exists stop here
        if (activeProcessors.indexOf(value) !== -1) {
            throw new Error(`${value} processor already exists.`);
        }
        activeProcessors.push(value);
        myGlobal.console.info(`${value} processor enabled.`);
        return activeProcessors;
    };
    
    /**
     * Add realtime video processor to processors array
     * Each processor will be executed in array order
     * //TODO: disable more than one processor at once
     * //NOTE: there might be a better way to handle this rather than duplicating code but for now leave it as is.
     * @param value
     * @returns {*[]}
     */
    CORE.disableProcessor = function disableProcessor (value) {
        // If activeProcessor array is empty cannot remove so throw Underflow Exception
        if (!activeProcessors.length) {
            throw new Error("Underflow Exception: Cannot remove item from empty array. No active processor at the moment.");
        }
        
        // If processor does not exist stop here
        let index = activeProcessors.indexOf(value);
        if (index === -1) {
            throw new Error(`${value} processor does not exists yet.`);
        }
        activeProcessors.splice(index, 1);
        myGlobal.console.info(`${value} processor disabled.`);
        return activeProcessors;
    };
    
    
    // Stop streaming video
    CORE.stop = stopStreamedVideo;
    
    // Initial kick-off of the app
    CORE.init = function init () {
    
        myGlobal.addEventListener("DOMContentLoaded", function contentLoadedHandler () {
        
            // HTML elements used in this app
            CORE.elements = {
                original: document.querySelector(".velvet__video.velvet__video--constraints"),
                reader: document.querySelector(".velvet__canvas--1.velvet__video--constraints"),
                writer: document.querySelector(".velvet__canvas--2.velvet__video--constraints"),
                streamer: document.querySelector(".velvet__video--streamer"),
                play: document.querySelector(".velvet__video--play"),
                output: document.querySelector(".velvet__output"),
                cap: document.querySelector(".velvet__capabilities")
            };
        
            const output = CORE.elements.output;
            output.style.color = "dodgerblue";
            try {
                if (myGlobal.navigator.mediaDevices === undefined) {
                    throw new Error("mediaDevices() doesn't seem to be available on your browser.");
                }
            
                /**
                 * @see https://www.digitalocean.com/community/tutorials/front-and-rear-camera-access-with-javascripts-getusermedia
                 * @returns {Promise<void>}
                 */
                const getCameraSelection = async () => {
                    const devices = await myGlobal.navigator.mediaDevices.enumerateDevices();
                    const videoDevices = devices.filter(device => device.kind === "videoinput");
                    const options = videoDevices.map(videoDevice => {
                        return `<option value="${videoDevice.deviceId}">${videoDevice.label}</option>`;
                    });
                    CORE.elements.streamer.innerHTML = options.join("");
                };
            
                const mediaSourceHandler = () => {
                    // Global flag to immediately disable velvet if necessary
                    if (!CORE.IS_ENABLED) {
                        output.innerText = "Velvet is disabled. Cannot continue.";
                        output.style.color = "red";
                        myGlobal.console.error("Velvet is disabled. Cannot continue.");
                        return;
                    }
                    CORE.enableProcessor("grayscale");
                    activateVideo(CORE.elements.streamer.value);
                };
            
                // Show camera selection right away
                getCameraSelection();
            
                CORE.elements.streamer.addEventListener("change", mediaSourceHandler, false);
            
                CORE.elements.play.addEventListener("click", mediaSourceHandler, false);
            
                // Should stop video when out of focus to prevent it running continuously for no valid reason
                myGlobal.addEventListener("visibilitychange", stopVideoProcessingWhenOutOfFocus, false);
            
            } catch (exception) {
                output.innerText = exception.message;
                output.style.color = "red";
                myGlobal.console.error(exception);
                stopStreamedVideo(CORE.elements.original);
            }
        }, false);
    };
    
    return CORE;
}(window));
