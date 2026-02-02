import { useEffect, useRef, useState, useCallback } from 'react';

interface CameraModalProps {
    onCapture: (file: File) => void;
    onClose: () => void;
}

export default function CameraModal({ onCapture, onClose }: CameraModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const isMounted = useRef(true);
    const initRequestId = useRef(0);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [activeDeviceId, setActiveDeviceId] = useState<string>('');
    const [error, setError] = useState<string>('');

    // Track mounted state
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Cleanup function helper
    const stopMediaStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    // Initialize camera
    const startCamera = useCallback(async (deviceId?: string) => {
        const currentRequestId = initRequestId.current + 1;
        initRequestId.current = currentRequestId;

        // Note: We don't stop the *existing* stream here immediately if we want smooth transition, 
        // but to be safe and simple, we stop it.
        // However, stopping it here doesn't stop the one that is *currently pending* (the race condition).
        stopMediaStream();

        try {
            const isLandscape = window.innerWidth > window.innerHeight;
            const constraints: MediaStreamConstraints = {
                video: deviceId
                    ? { deviceId: { exact: deviceId } }
                    : {
                        facingMode: 'environment',
                        // Force aspect ratio preference based on current window orientation
                        width: { ideal: isLandscape ? 1920 : 1080 },
                        height: { ideal: isLandscape ? 1080 : 1920 }
                    }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            // Check if component unmounted OR if a newer request started
            if (!isMounted.current || currentRequestId !== initRequestId.current) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }

            streamRef.current = stream; // Store for cleanup

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err: any) {
            // Only report error if this is still the active request and mounted
            if (!isMounted.current || currentRequestId !== initRequestId.current) return;

            console.error("Camera error:", err);
            setError("Could not access camera. Please check permissions.");
        }
    }, []);

    // Restart camera on orientation change to ensure correct aspect ratio (Landscape/Portrait)
    useEffect(() => {
        const handleResize = () => {
            // We debounce or just trigger. 
            // Ideally we check if aspect ratio class changed?
            // Simplest: just restart. The user won't rotate constantly.
            startCamera(activeDeviceId || undefined);
        };

        window.addEventListener('orientationchange', handleResize);
        // Sometimes resize fires on rotation too, but orientationchange is specific.
        // On modern browsers screens.orientation.addEventListener('change', ...) is better but less supported?
        // Let's stick to orientationchange or resize if height/width swaps.

        return () => {
            window.removeEventListener('orientationchange', handleResize);
        };
    }, [startCamera, activeDeviceId]);

    // Load available devices
    useEffect(() => {
        const getDevices = async () => {
            try {
                // Request permission first to get labels
                const permStream = await navigator.mediaDevices.getUserMedia({ video: true });
                // Stop this initial stream immediately - we just needed the permission grant
                permStream.getTracks().forEach(track => track.stop());

                const allDevices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
                setDevices(videoDevices);

                // If we have devices, start with the first one (or environment if default logic applies)
                if (videoDevices.length > 0) {
                    startCamera();
                }
            } catch (err) {
                console.error("Device enumeration error:", err);
                // Fallback to basic start if enumeration fails
                startCamera();
            }
        };

        getDevices();

        return () => {
            stopMediaStream();
        };
    }, [startCamera]);

    const handleSwitchCamera = () => {
        if (devices.length < 2) return;

        // Find current index and pick next
        // Note: activeDeviceId might be empty if we used default constraint
        // This is a simple toggle logic
        // For robustness, better to track index. 
        // Let's simplified assumption: toggle between first two or simple find logic.

        // Better: just fetch current track settings or just blindly toggle between found devices
        // For MVP, let's just cycle through device list
        const currentIndex = devices.findIndex(d => d.deviceId === activeDeviceId);
        const nextIndex = (currentIndex + 1) % devices.length;
        const nextDevice = devices[nextIndex];

        setActiveDeviceId(nextDevice.deviceId);
        startCamera(nextDevice.deviceId);
    };

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        // Detect orientation mismatch (User holding landscape, stream sending portrait)
        const isLandscape = window.innerWidth > window.innerHeight;
        const isStreamPortrait = video.videoWidth < video.videoHeight;

        let width = video.videoWidth;
        let height = video.videoHeight;
        let rotation = 0;

        if (isLandscape && isStreamPortrait) {
            // Need to rotate 90 degrees or -90 depending on device orientation
            // Default to -90 (counter-clockwise) for standard "Home button right" landscape
            // videoWidth < videoHeight, so we swap for canvas dimensions
            width = video.videoHeight;
            height = video.videoWidth;
            rotation = -90;

            // Check specific rotation if supported
            if (window.orientation === 90 || (screen.orientation && screen.orientation.type === 'landscape-primary')) {
                rotation = -90; // Top of phone is to the left. Sensor top is left. Rotate CCW.
            } else if (window.orientation === -90 || (screen.orientation && screen.orientation.type === 'landscape-secondary')) {
                rotation = 90;
            }
        }

        canvas.width = width;
        canvas.height = height;

        // Apply rotation
        if (rotation !== 0) {
            context.translate(width / 2, height / 2);
            context.rotate((rotation * Math.PI) / 180);
            context.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2, video.videoWidth, video.videoHeight);
        } else {
            context.drawImage(video, 0, 0, width, height);
        }

        // Convert to file
        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                onCapture(file);
                onClose(); // Close modal after capture
            }
        }, 'image/jpeg', 0.9);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
            {/* Header / Controls */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
                <button onClick={onClose} className="text-white p-2 bg-black/20 rounded-full backdrop-blur-md">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                {devices.length > 1 && (
                    <button onClick={handleSwitchCamera} className="text-white p-2 bg-black/20 rounded-full backdrop-blur-md">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Video Preview */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
                {error ? (
                    <div className="text-red-500 p-4 text-center">{error}</div>
                ) : (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                    />
                )}
                <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Bottom Bar / Shutter */}
            <div className="p-8 pb-10 flex justify-center bg-black/20 backdrop-blur-sm">
                <button
                    onClick={handleCapture}
                    disabled={!!error}
                    className="h-20 w-20 rounded-full border-4 border-white bg-white/20 flex items-center justify-center active:scale-95 transition-transform"
                >
                    <div className="h-16 w-16 bg-white rounded-full"></div>
                </button>
            </div>
        </div>
    );
}
