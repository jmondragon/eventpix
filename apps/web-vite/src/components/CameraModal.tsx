import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

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
    const rotationRef = useRef(0);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [activeDeviceId, setActiveDeviceId] = useState<string>('');
    const [error, setError] = useState<string>('');
    const isNative = Capacitor.isNativePlatform();

    // Track mounted state
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // For Native: use Capacitor Camera directly and close
    useEffect(() => {
        if (isNative) {
            const takePhoto = async () => {
                try {
                    const image = await Camera.getPhoto({
                        quality: 90,
                        allowEditing: false,
                        resultType: CameraResultType.Uri,
                        source: CameraSource.Camera
                    });

                    if (image.webPath) {
                        const response = await fetch(image.webPath);
                        const blob = await response.blob();
                        const file = new File([blob], `capture-${Date.now()}.${image.format}`, { type: `image/${image.format}` });
                        onCapture(file);
                    }
                } catch (err) {
                    console.error("Capacitor camera error", err);
                } finally {
                    onClose();
                }
            };
            takePhoto();
        }
    }, [isNative, onCapture, onClose]);

    // --- Web Implementation ---

    // Track physical device orientation using accelerometer (fallback for UI lock)
    useEffect(() => {
        if (isNative) return;

        const handleOrientation = (event: DeviceOrientationEvent) => {
            const { gamma } = event;
            if (gamma === null) return;

            if (gamma > 45) {
                rotationRef.current = 90;
            } else if (gamma < -45) {
                rotationRef.current = -90;
            } else {
                rotationRef.current = 0;
            }
        };

        if (window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', handleOrientation);
        }

        return () => {
            if (window.DeviceOrientationEvent) {
                window.removeEventListener('deviceorientation', handleOrientation);
            }
        };
    }, [isNative]);

    const stopMediaStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const startCamera = useCallback(async (deviceId?: string) => {
        if (isNative) return;

        const currentRequestId = initRequestId.current + 1;
        initRequestId.current = currentRequestId;
        stopMediaStream();

        try {
            const constraints: MediaStreamConstraints = {
                video: deviceId
                    ? { deviceId: { exact: deviceId } }
                    : { facingMode: 'environment' }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            if (!isMounted.current || currentRequestId !== initRequestId.current) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err: any) {
            if (!isMounted.current || currentRequestId !== initRequestId.current) return;
            console.error("Camera error:", err);
            setError("Could not access camera. Please check permissions.");
        }
    }, [isNative]);

    useEffect(() => {
        if (isNative) return;

        const handleResize = () => {
            startCamera(activeDeviceId || undefined);
        };

        window.addEventListener('orientationchange', handleResize);
        return () => {
            window.removeEventListener('orientationchange', handleResize);
        };
    }, [startCamera, activeDeviceId, isNative]);

    useEffect(() => {
        if (isNative) return;

        const getDevices = async () => {
            try {
                const permStream = await navigator.mediaDevices.getUserMedia({ video: true });
                permStream.getTracks().forEach(track => track.stop());

                const allDevices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
                setDevices(videoDevices);

                if (videoDevices.length > 0) {
                    startCamera();
                }
            } catch (err) {
                console.error("Device enumeration error:", err);
                startCamera();
            }
        };

        getDevices();

        return () => {
            stopMediaStream();
        };
    }, [startCamera, isNative]);

    const handleSwitchCamera = () => {
        if (devices.length < 2) return;
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

        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const isStreamPortrait = videoHeight > videoWidth;
        const physicalRotation = rotationRef.current;
        const isPhysicalLandscape = Math.abs(physicalRotation) === 90;

        let finalWidth = videoWidth;
        let finalHeight = videoHeight;
        let needsRotation = false;

        if (isStreamPortrait && isPhysicalLandscape) {
            needsRotation = true;
            finalWidth = videoHeight;
            finalHeight = videoWidth;
        }

        canvas.width = finalWidth;
        canvas.height = finalHeight;

        if (needsRotation) {
            context.translate(finalWidth / 2, finalHeight / 2);
            context.rotate((physicalRotation * Math.PI) / 180);
            context.drawImage(video, -videoWidth / 2, -videoHeight / 2, videoWidth, videoHeight);
        } else {
            context.drawImage(video, 0, 0, finalWidth, finalHeight);
        }

        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                onCapture(file);
                onClose();
            }
        }, 'image/jpeg', 0.9);
    };

    if (isNative) return null; // Modal will be replaced by native camera UI

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
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
