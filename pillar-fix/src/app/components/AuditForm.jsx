import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, MapPin, Upload, ArrowLeft, Check, X, RotateCcw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';
import api from "@/app/api";

const SIDES = [
  { side: 'front', label: 'Front' },
  { side: 'right', label: 'Right' },
  { side: 'back',  label: 'Back'  },
  { side: 'left',  label: 'Left'  },
];

export function AuditForm({ task, onBack, onSubmit }) {
  const [images, setImages] = useState({ front: '', right: '', back: '', left: '' });
  const [currentCoordinates, setCurrentCoordinates] = useState(null);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [activeSide, setActiveSide] = useState(null);
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [cameraError, setCameraError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const captureToastIdRef = useRef(null);

  useEffect(() => {
  window.scrollTo(0, 0);
}, []);

  const showSingleCaptureToast = (message) => {
    if (captureToastIdRef.current) toast.dismiss(captureToastIdRef.current);
    captureToastIdRef.current = toast.success(message, {
      id: "capture-progress-toast",
      position: "bottom-center",
      duration: 1200,
      style: {
        left: "50%",
        right: "auto",
        transform: "translateX(-50%)",
        margin: 0,
        width: "fit-content",
        maxWidth: "min(42rem, calc(100vw - 2rem))",
        whiteSpace: "nowrap",
      },
    });
  };

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const startCamera = useCallback(async (facing) => {
    setCameraError('');
    stopStream();
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = newStream;
      setStream(newStream);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError('Could not open camera: ' + err.message);
      }
    }
  }, [stopStream]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  const openCamera = async (side) => {
    setActiveSide(side);
    setCameraOpen(true);
    await startCamera(facingMode);
  };

  const closeCamera = () => {
    stopStream();
    setCameraOpen(false);
    setActiveSide(null);
    setCameraError('');
  };

  const flipCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    await startCamera(next);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !activeSide) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    setImages(prev => {
      const updated = { ...prev, [activeSide]: dataUrl };
      const currentIdx = SIDES.findIndex(s => s.side === activeSide);
      const nextSide = SIDES.slice(currentIdx + 1).find(s => !updated[s.side]);
      if (nextSide) {
        setActiveSide(nextSide.side);
        showSingleCaptureToast(`${activeSide.charAt(0).toUpperCase() + activeSide.slice(1)} captured — now capture ${nextSide.label}`);
      } else {
        closeCamera();
        showSingleCaptureToast('All 4 sides captured!');
      }
      return updated;
    });
  };

  const captureGPSLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    setIsCapturingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentCoordinates({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsCapturingLocation(false);
        toast.success('GPS location captured');
      },
      () => { setIsCapturingLocation(false); toast.error('Failed to capture location'); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async () => {
    if (!allImagesUploaded || !currentCoordinates) return;
    try {
      const { data } = await api.put(`/tasks/${task.id}/submit`, {
        image1: images.front, image2: images.right,
        image3: images.back,  image4: images.left,
        user_current_location: currentCoordinates,
      });
      onSubmit({
        id: data.photo_id, taskId: task.id,
        pillarId: task.pillarId, location: task.location, address: task.address,
        coordinates: currentCoordinates,
        images: [
          { side: 'front', imageUrl: images.front }, { side: 'right', imageUrl: images.right },
          { side: 'back',  imageUrl: images.back  }, { side: 'left',  imageUrl: images.left  },
        ],
        submittedBy: task.assignedTo, submittedAt: new Date().toISOString(),
        detectionStatus: 'Completed', detectionResults: data.detectionResults,
        overallRisk: data.overallRisk, validationStatus: 'Pending',
      });
      toast.success('Audit submitted — AI detection complete');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed');
    }
  };

  const allImagesUploaded = SIDES.every(s => images[s.side]);

  return (
    <div className="space-y-6">
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera fullscreen modal */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col w-screen h-[100dvh] overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/70">
            <span className="text-white font-semibold text-sm">
              Capturing: <span className="text-blue-400 uppercase tracking-wide">{activeSide} side</span>
            </span>
            <button onClick={closeCamera} className="text-white hover:text-red-400 transition-colors p-1">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Side progress pills */}
          <div className="flex items-center justify-center gap-2 py-2 bg-black/50">
            {SIDES.map(({ side, label }) => (
              <button
                key={side}
                onClick={() => setActiveSide(side)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                  activeSide === side ? 'bg-blue-500 text-white' :
                  images[side]       ? 'bg-green-600 text-white' :
                                       'bg-white/20 text-white/70'
                }`}
              >
                {images[side] && <Check className="h-3 w-3" />}
                {label}
              </button>
            ))}
          </div>

          {cameraError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <Camera className="h-16 w-16 text-gray-500" />
              <p className="text-white text-sm max-w-xs">{cameraError}</p>
              <Button onClick={() => startCamera(facingMode)} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          ) : (
            <div className="flex-1 relative overflow-hidden">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {/* Corner guides — bold red framing */}
              <div className="absolute inset-6 pointer-events-none">
                <div className="absolute top-0 left-0 w-20 h-20 border-t-[6px] border-l-[6px] border-red-500" />
                <div className="absolute top-0 right-0 w-20 h-20 border-t-[6px] border-r-[6px] border-red-500" />
                <div className="absolute bottom-0 left-0 w-20 h-20 border-b-[6px] border-l-[6px] border-red-500" />
                <div className="absolute bottom-0 right-0 w-20 h-20 border-b-[6px] border-r-[6px] border-red-500" />
                <div className="absolute inset-0 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)] pointer-events-none" />
              </div>
            </div>
          )}

          {/* Bottom controls */}
          <div className="flex items-center justify-between px-8 py-6 bg-black/70">
            <button onClick={flipCamera} className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors">
              <RotateCcw className="h-6 w-6" />
              <span className="text-xs">Flip</span>
            </button>
            <button
              onClick={capturePhoto}
              disabled={!!cameraError}
              className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 hover:bg-gray-100 active:scale-95 transition-transform disabled:opacity-40 shadow-xl"
            />
            <div className="w-12" />
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={onBack}
          className="h-9 w-9 p-0 sm:h-9 sm:w-auto sm:px-4 sm:py-2"
        >
          <ArrowLeft className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <div>
          <h2 className="text-3xl font-bold">Audit Feeder Pillar</h2>
          <p className="text-gray-600 mt-1">{task.pillarId} - {task.address}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Image capture */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-0">
              <CardTitle>Capture 4-Side Images</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <Button
                variant="outline"
                className="w-full h-14 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400"
                onClick={() => {
                  const firstEmpty = SIDES.find(s => !images[s.side]);
                  openCamera(firstEmpty ? firstEmpty.side : 'front');
                }}
              >
                <Camera className="h-5 w-5 mr-2" />
                Open Camera
              </Button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SIDES.map(({ side, label }) => (
                  <div key={side} className="space-y-2">
                    <Label className="flex items-center justify-between">
                      <span className="font-medium">{label} Side</span>
                      {images[side] && (
                        <Badge variant="default" className="gap-1">
                          <Check className="h-3 w-3" /> Captured
                        </Badge>
                      )}
                    </Label>
                    {images[side] ? (
                      <div className="relative">
                        <img src={images[side]} alt={`${label} side`} className="w-full h-48 object-cover rounded-lg border" />
                        <button
                          type="button"
                          onClick={() => setImages(prev => ({ ...prev, [side]: '' }))}
                          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/70 text-white hover:bg-red-600 transition-colors flex items-center justify-center"
                          aria-label={`Delete ${label} photo`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <Button size="sm" variant="secondary" className="absolute bottom-2 right-2" onClick={() => openCamera(side)}>
                          <Camera className="h-3 w-3 mr-1" /> Retake
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => openCamera(side)}
                        className="w-full h-48 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-colors flex flex-col items-center justify-center gap-2"
                      >
                        <Camera className="h-8 w-8 text-gray-400" />
                        <span className="text-sm text-gray-500">Tap to capture {label}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-0"><CardTitle>Pillar Details</CardTitle></CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div><Label className="text-gray-600 block mb-1.5">Pillar ID</Label><Input value={task.pillarId} readOnly className="bg-gray-50" /></div>
              <div><Label className="text-gray-600 block mb-1.5">Address</Label><Input value={task.address} readOnly className="bg-gray-50" /></div>
              <div><Label className="text-gray-600 block mb-1.5">Locality</Label><Input value={task.locality} readOnly className="bg-gray-50" /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-0"><CardTitle>GPS Location</CardTitle></CardHeader>
            <CardContent className="space-y-4 pt-4">
              {currentCoordinates ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium text-green-900">Location Captured</span>
                    <Check className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>Latitude: {currentCoordinates.lat.toFixed(6)}</p>
                    <p>Longitude: {currentCoordinates.lng.toFixed(6)}</p>
                  </div>
                  <Button size="sm" variant="outline" className="w-full" onClick={captureGPSLocation} disabled={isCapturingLocation}>
                    Recapture Location
                  </Button>
                </div>
              ) : (
                <Button onClick={captureGPSLocation} disabled={isCapturingLocation} className="w-full">
                  <MapPin className="h-4 w-4 mr-2" />
                  {isCapturingLocation ? 'Capturing...' : 'Capture GPS Location'}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-0"><CardTitle>Progress</CardTitle></CardHeader>
            <CardContent className="space-y-3 pt-4">
              {SIDES.map(({ side, label }) => (
                <div key={side} className="flex items-center justify-between">
                  <span className="text-sm">{label}</span>
                  {images[side] ? <Check className="h-4 w-4 text-green-600" /> : <div className="h-4 w-4 rounded-full border-2 border-gray-300" />}
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium">GPS Location</span>
                {currentCoordinates ? <Check className="h-4 w-4 text-green-600" /> : <div className="h-4 w-4 rounded-full border-2 border-gray-300" />}
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSubmit} disabled={!allImagesUploaded || !currentCoordinates} className="w-full" size="lg">
            <Upload className="h-5 w-5 mr-2" />
            Submit for AI Detection
          </Button>
        </div>
      </div>
    </div>
  );
}