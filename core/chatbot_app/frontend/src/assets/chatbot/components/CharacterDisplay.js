import React, { useRef, useState, useEffect, useCallback } from 'react';
import Draggable from 'react-draggable';

const debounce = (func, delay) => {
    let debounceTimer;
    return function (...args) {
        const context = this;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(context, args), delay);
    }
}

function CharacterDisplay({
    viewportWidth,
    viewportHeight,
    imagePaths, defaultImagePath, position, scale, onPositionChange, onScaleChange, draggableEnabled = true, apiBaseUrl }) {
    const imageRef = useRef(null);
    const draggableNodeRef = useRef(null);

    const [displayedImage, setDisplayedImage] = useState({ url: '', naturalWidth: 0, naturalHeight: 0, error: false });
    const [loadingImage, setLoadingImage] = useState({ url: '', loading: false, error: false });

    const animationIntervalRef = useRef(null);
    const currentImageIndexRef = useRef(0);
    const imageUrlsRef = useRef([]);
    const defaultImageUrlRef = useRef('');
    const lastGoodImageUrlRef = useRef('');
    const [isInitialLayoutDone, setIsInitialLayoutDone] = useState(false);

    const animationDelay = 600;
    const lastImageHoldDelay = 1200;

    const buildImageUrlFromToken = useCallback((token) => {
        if (!token) return '';
        const cleanApiBaseUrl = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
        return `${cleanApiBaseUrl}/serve_image?token=${token}`;
    }, [apiBaseUrl]);

    // useEffect(() => {
    //     const defaultUrl = buildImageUrlFromToken(defaultImagePath);
    //     defaultImageUrlRef.current = defaultUrl;
    //     if (defaultUrl && !currentImage.url && !imagePaths?.length) {
    //         console.log("Setting initial default image:", defaultUrl);
    //         setCurrentImage({ url: defaultUrl, naturalWidth: 0, naturalHeight: 0, error: false, loading: true });
    //         if (!lastGoodImageUrlRef.current) {
    //             lastGoodImageUrlRef.current = defaultUrl;
    //         }
    //     } else if (!defaultUrl && !imagePaths?.length && !currentImage.url) {
    //          setCurrentImage({ url: '', naturalWidth: 0, naturalHeight: 0, error: false, loading: false });
    //     }
    // }, [defaultImagePath, buildImageUrlFromToken]);

    useEffect(() => {
        const defaultUrl = buildImageUrlFromToken(defaultImagePath);
        defaultImageUrlRef.current = defaultUrl;
        if (defaultUrl && !displayedImage.url && !imagePaths?.length) {
            console.log("Setting initial default image:", defaultUrl);
            setLoadingImage({ url: defaultUrl, loading: true, error: false });
            if (!lastGoodImageUrlRef.current) {
                lastGoodImageUrlRef.current = defaultUrl;
            }
        } else if (!defaultUrl && !imagePaths?.length && !displayedImage.url) {
            setDisplayedImage({ url: '', naturalWidth: 0, naturalHeight: 0, error: false });
            setLoadingImage({ url: '', loading: false, error: false });
        }
    }, [defaultImagePath, buildImageUrlFromToken, displayedImage.url, imagePaths?.length]);

    const calculateAndSetLayout = useCallback((imgNaturalWidth, imgNaturalHeight) => {
        if (!imgNaturalWidth || !imgNaturalHeight || imgNaturalWidth === 0 || imgNaturalHeight === 0 || viewportWidth === 0 || viewportHeight === 0) {
            console.log("Calculate layout skipped: Invalid dimensions", imgNaturalWidth, imgNaturalHeight, viewportWidth, viewportHeight);
            return false;
        }
        let calculatedScale = Math.min(viewportWidth / imgNaturalWidth, viewportHeight / imgNaturalHeight, 1) * 1.8;
        const renderedWidth = imgNaturalWidth * calculatedScale;
        const renderedHeight = imgNaturalHeight * calculatedScale;
        const targetLeft = (viewportWidth - renderedWidth) / 2;
        const targetTop = viewportHeight - (renderedHeight * 0.8);
        console.log(`Calculate Layout: Viewport(${viewportWidth}x${viewportHeight}), Img(${imgNaturalWidth}x${imgNaturalHeight}), Scale(${calculatedScale}), Pos(${targetLeft}, ${targetTop})`);
        onScaleChange(calculatedScale);
        onPositionChange({ x: targetLeft, y: targetTop });
        return true;
    }, [viewportWidth, viewportHeight, onScaleChange, onPositionChange]);


    // const debouncedCalculateLayout = useCallback(debounce(() => {
    //     if (currentImage.naturalWidth > 0 && isInitialLayoutDone) {
    //         console.log("Debounced recalculate triggered by viewport change");
    //         calculateAndSetLayout(currentImage.naturalWidth, currentImage.naturalHeight);
    //     } 
    // }, 150), [currentImage.naturalWidth, currentImage.naturalHeight, calculateAndSetLayout, isInitialLayoutDone]);

    const debouncedCalculateLayout = useCallback(debounce(() => {
        if (displayedImage.naturalWidth > 0 && isInitialLayoutDone) {
            console.log("Debounced recalculate triggered by viewport change");
            calculateAndSetLayout(displayedImage.naturalWidth, displayedImage.naturalHeight);
        }
    }, 150), [displayedImage.naturalWidth, displayedImage.naturalHeight, calculateAndSetLayout, isInitialLayoutDone]);

    useEffect(() => {
        console.log("Viewport props changed:", viewportWidth, viewportHeight);
        debouncedCalculateLayout();
    }, [viewportWidth, viewportHeight, debouncedCalculateLayout]);

    // useEffect(() => {
    //     window.addEventListener('resize', debouncedCalculateLayout);
    //     return () => window.removeEventListener('resize', debouncedCalculateLayout);
    // }, [debouncedCalculateLayout]);

    useEffect(() => {
        console.log("Effect: Image paths changed:", imagePaths);
        if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;

        const newImageUrls = (imagePaths && imagePaths.length > 0)
            ? imagePaths.map(buildImageUrlFromToken).filter(url => url)
            : [];
        imageUrlsRef.current = newImageUrls;
        currentImageIndexRef.current = 0;
        setIsInitialLayoutDone(false);

        const firstUrl = newImageUrls.length > 0
            ? newImageUrls[0]
            : defaultImageUrlRef.current || '';

        console.log("Effect: Setting first URL:", firstUrl);
        // setCurrentImage({ url: firstUrl, naturalWidth: 0, naturalHeight: 0, error: false, loading: !!firstUrl });
        setLoadingImage({ url: firstUrl, loading: !!firstUrl, error: false });

        // Function to advance to the next image
        const advanceImage = () => {
            if (imageUrlsRef.current.length <= 1) return; // No animation for single or no image

            const nextIndex = (currentImageIndexRef.current + 1) % imageUrlsRef.current.length;
            const nextUrl = imageUrlsRef.current[nextIndex];

            console.log("Advancing to index:", nextIndex, "URL:", nextUrl);
            // setCurrentImage(prev => ({ ...prev, url: nextUrl, naturalWidth: 0, naturalHeight: 0, error: false, loading: true }));
            setLoadingImage({ url: nextUrl, loading: true, error: false });
            currentImageIndexRef.current = nextIndex;

            clearInterval(animationIntervalRef.current);
            const delay = (nextIndex === imageUrlsRef.current.length - 1) ? lastImageHoldDelay : animationDelay;
            animationIntervalRef.current = setInterval(advanceImage, delay);
        };

        if (imageUrlsRef.current.length > 1) {
            console.log("Starting animation timer");
            animationIntervalRef.current = setInterval(advanceImage, animationDelay);
        }

        return () => {
            console.log("Clearing animation interval");
            if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
        };
    }, [imagePaths, buildImageUrlFromToken]);

    const handleImageLoad = useCallback((event) => {
        const loadedUrl = event.target.src;
        // if (loadedUrl !== currentImage.url) {
        //     console.log("Ignoring load event for old URL:", loadedUrl, "Current is:", currentImage.url);
        //     return;
        // }
        if (loadedUrl !== loadingImage.url) {
            console.log("Ignoring load event for old URL:", loadedUrl, "Loading is:", loadingImage.url);
            return;
        }
        const naturalWidth = event.target.naturalWidth;
        const naturalHeight = event.target.naturalHeight;
        console.log("Image loaded:", loadedUrl, "Size:", naturalWidth, "x", naturalHeight);

        lastGoodImageUrlRef.current = loadedUrl;

        // setCurrentImage(prev => ({ ...prev, naturalWidth, naturalHeight, error: false, loading: false }));
        setDisplayedImage({ url: loadedUrl, naturalWidth, naturalHeight, error: false });
        setLoadingImage(prev => ({ ...prev, loading: false, error: false }));

        if (!isInitialLayoutDone) {
            calculateAndSetLayout(naturalWidth, naturalHeight);
            setIsInitialLayoutDone(true);
        } else {
            // calculateAndSetLayout(naturalWidth, naturalHeight);
        }

    }, [calculateAndSetLayout, loadingImage.url, isInitialLayoutDone]);


    const handleImageError = useCallback(() => {
        // const failedUrl = currentImage.url;
        // console.error('Image Error:', failedUrl);

        // setLoadingImage(prev => ({ ...prev, loading: false, error: true }));
        const failedUrl = loadingImage.url;
        console.error('Image Error:', failedUrl);

        setLoadingImage(prev => ({ ...prev, loading: false, error: true }));
        // setCurrentImage(prev => ({ url: '', naturalWidth: 0, naturalHeight: 0, error: true, loading: false }));
        setIsInitialLayoutDone(false);

        let fallbackUrl = '';
        if (lastGoodImageUrlRef.current && lastGoodImageUrlRef.current !== failedUrl) {
            fallbackUrl = lastGoodImageUrlRef.current;
        } else if (defaultImageUrlRef.current && defaultImageUrlRef.current !== failedUrl) {
            fallbackUrl = defaultImageUrlRef.current;
        }

        if (fallbackUrl) {
            console.log("Attempting fallback to:", fallbackUrl);
            // setCurrentImage({ url: fallbackUrl, naturalWidth: 0, naturalHeight: 0, error: false, loading: true });
            setLoadingImage({ url: fallbackUrl, loading: true, error: false });
        } else {
            console.error("No fallback image available.");
            //  setCurrentImage({ url: '', naturalWidth: 0, naturalHeight: 0, error: true, loading: false });
            setDisplayedImage({ url: '', naturalWidth: 0, naturalHeight: 0, error: true });
        }

        if (animationIntervalRef.current) {
            clearInterval(animationIntervalRef.current);
            animationIntervalRef.current = null;
        }

    }, [loadingImage.url, displayedImage.url]);
    const handleDrag = (e, ui) => {
        if (!draggableEnabled) return;
        onPositionChange({ x: ui.x, y: ui.y });
    };

    const handleStop = (e, ui) => {
        if (!draggableEnabled) return;
        console.log("Drag stopped at:", ui.x, ui.y);
    };
    const handleStart = (e, ui) => {
        if (!draggableEnabled) return;
        console.log("Drag started");
    };

    const handleWheel = (event) => {
        // if (!draggableEnabled || !currentImage.url || currentImage.error) return; // Prevent zoom if no image or error
        if (!draggableEnabled || !displayedImage.url || displayedImage.error) return; // Prevent zoom if no image or error
        event.preventDefault();
        event.stopPropagation();
        const zoomIntensity = 0.05;
        const currentScale = scale;
        const newScale = currentScale * (1 + (event.deltaY > 0 ? -zoomIntensity : zoomIntensity));
        onScaleChange(Math.max(0.1, Math.min(5, newScale)));
    };

    // const displayOpacity = !currentImage.error && !currentImage.loading && currentImage.url && currentImage.naturalWidth > 0 ? 1 : 0;
    const displayOpacity = !displayedImage.error && displayedImage.url && displayedImage.naturalWidth > 0 ? 1 : 0;

    return (
        <div
            className="character-display-wrapper"
            style={{
                width: '100%', height: '100%', position: 'absolute',
                top: 0, left: 0,
                // pointerEvents: draggableEnabled ? 'auto' : 'none', // Let events through if draggable
                overflow: 'hidden'
            }}
            onWheel={handleWheel}
        >
            <Draggable
                disabled={!draggableEnabled}
                position={position}
                onStart={handleStart}
                onDrag={handleDrag}
                onStop={handleStop}
                nodeRef={draggableNodeRef}
            >

                <div
                    ref={draggableNodeRef}
                    className={`character-image-container ${draggableEnabled ? 'draggable-enabled' : ''}`}
                    style={{
                        position: 'absolute',
                        // width: currentImage.naturalWidth > 0 ? `${currentImage.naturalWidth * scale}px` : 'auto', // Set size based on loaded image and scale
                        // height: currentImage.naturalHeight > 0 ? `${currentImage.naturalHeight * scale}px` : 'auto',
                        width: displayedImage.naturalWidth > 0 ? `${displayedImage.naturalWidth * scale}px` : 'auto', // Set size based on loaded image and scale
                        height: displayedImage.naturalHeight > 0 ? `${displayedImage.naturalHeight * scale}px` : 'auto',
                        transformOrigin: 'center bottom',
                        pointerEvents: 'auto',
                        cursor: draggableEnabled ? 'grab' : 'default',
                        opacity: displayOpacity,
                        transition: 'none', // Ensure instant display, no fading
                        pointerEvents: draggableEnabled ? 'auto' : 'none', // Allow drag events
                        visibility: displayOpacity === 1 ? 'visible' : 'hidden',
                    }}
                >
                    {/* <img
                        ref={imageRef}
                        src={currentImage.url}
                        alt={currentImage.url && !currentImage.error ? "Character" : ""}
                        style={{
                            display: 'block',
                            width: '100%',
                            height: '100%',
                            maxWidth: 'none',
                            maxHeight: 'none',
                            // opacity: isDisplayed && !imageError ? 1 : 0,
                            // transition: `opacity ${fadeDuration}ms ease-in-out`,
                            userSelect: 'none',
                            WebkitUserDrag: 'none',
                            imageRendering: 'pixelated', // Keep crisp pixels
                            pointerEvents: 'auto', // Image itself should receive pointer events for load/error
                            visibility: 'inherit',
                        }}
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                        key={currentImage.url}
                    />
                </div> */}
                    {displayedImage.url && (
                        <img
                            src={displayedImage.url}
                            alt={displayedImage.url && !displayedImage.error ? "Character" : ""}
                            style={{
                                display: 'block',
                                width: '100%',
                                height: '100%',
                                maxWidth: 'none',
                                maxHeight: 'none',
                                userSelect: 'none',
                                WebkitUserDrag: 'none',
                                imageRendering: 'pixelated', // Keep crisp pixels
                                pointerEvents: 'auto', // Image itself should receive pointer events
                                visibility: 'inherit',
                            }}
                        />
                    )}

                    {loadingImage.url && loadingImage.loading && (
                        <img
                            src={loadingImage.url}
                            alt=""
                            style={{
                                position: 'absolute',
                                top: '-9999px',
                                left: '-9999px',
                                visibility: 'hidden',
                            }}
                            onLoad={handleImageLoad}
                            onError={handleImageError}
                            key={loadingImage.url}
                        />
                    )}

                </div>
                {/* <img
                    ref={imageRef}
                    src={currentImageUrl}
                    alt={currentImageUrl ? "Character" : ""}
                    style={{
                        display: currentImageUrl ? 'block' : 'none',
                        // position: 'absolute',
                        // top: 0, left: 0, 
                        transform: `scale(${scale})`,
                        transformOrigin: 'center bottom',
                        maxWidth: 'none', maxHeight: 'none',
                        cursor: draggableEnabled ? 'grab' : 'default',
                        opacity: isDisplayed && !imageError ? 1 : 0,
                        transition: `opacity ${fadeDuration}ms ease-in-out`,
                        pointerEvents: 'auto',
                        userSelect: 'none', WebkitUserDrag: 'none',
                        imageRendering: 'pixelated',
                    }}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                /> */}
            </Draggable>

            {/* {currentImage.loading && (<div className="image-status-indicator">Loading...</div>)}
            {currentImage.error && (<div className="image-status-indicator error">Error Loading Image</div>)}
            {!currentImage.url && !currentImage.loading && !currentImage.error && (<div className="image-status-indicator">No image</div>)} */}
            {loadingImage.loading && (<div className="image-status-indicator">Loading...</div>)}
            {displayedImage.error && (<div className="image-status-indicator error">Error Loading Image</div>)}
            {!displayedImage.url && !loadingImage.loading && !displayedImage.error && (<div className="image-status-indicator">No image</div>)}
        </div>
    );
}

export default CharacterDisplay;