import { useState, useRef } from 'react';
import { Camera, MapPin, Upload, ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';

const SIDES = [
  { side: 'front', label: 'Front' },
  { side: 'right', label: 'Right' },
  { side: 'back', label: 'Back' },
  { side: 'left', label: 'Left' },
];

export function AuditForm({ task, onBack, onSubmit }) {
  const [images, setImages] = useState({
    front: '',
    right: '',
    back: '',
    left: '',
  });
  const [currentCoordinates, setCurrentCoordinates] = useState(null);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);

  const fileInputRefs = {
    front: useRef(null),
    right: useRef(null),
    back: useRef(null),
    left: useRef(null),
  };

  const handleImageSelect = (side, file) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setImages((prev) => ({
        ...prev,
        [side]: reader.result,
      }));
      toast.success(`${side.charAt(0).toUpperCase() + side.slice(1)} image uploaded`);
    };
    reader.readAsDataURL(file);
  };

  const captureGPSLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setIsCapturingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setCurrentCoordinates(coords);
        setIsCapturingLocation(false);
        toast.success('GPS location captured');
      },
      (error) => {
        setIsCapturingLocation(false);
        toast.error('Failed to capture location');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = () => {
    const allImagesUploaded = SIDES.every((s) => images[s.side]);
    
    if (!allImagesUploaded) {
      toast.error('Please upload images for all 4 sides');
      return;
    }

    if (!currentCoordinates) {
      toast.error('Please capture GPS location');
      return;
    }

    const pillarImages = SIDES.map((s) => ({
      side: s.side,
      imageUrl: images[s.side],
      uploadedAt: new Date().toISOString(),
    }));

    const submission = {
      id: Date.now().toString(),
      taskId: task.id,
      pillarId: task.pillarId,
      location: task.location,
      address: task.address,
      coordinates: currentCoordinates,
      images: pillarImages,
      submittedBy: task.assignedTo,
      submittedAt: new Date().toISOString(),
      detectionStatus: 'Queued',
      validationStatus: 'Pending',
    };

    onSubmit(submission);
    toast.success('Audit submitted for AI detection');
  };

  const allImagesUploaded = SIDES.every((s) => images[s.side]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-3xl font-bold">Audit Feeder Pillar</h2>
          <p className="text-gray-600 mt-1">{task.pillarId} - {task.address}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Image Capture */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-0">
              <CardTitle>Capture 4-Side Images</CardTitle>
            </CardHeader>
            {/* Added pt-8 to create a wider gap from the title */}
            <CardContent className="pt-4 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                {SIDES.map(({ side, label }) => (
                  <div key={side} className="space-y-3">
                    {/* Added mb-2 for consistent spacing below labels */}
                    <Label htmlFor={side} className="flex items-center justify-between mb-2">
                      <span className="font-medium">{label} Side</span>
                      {images[side] && (
                        <Badge variant="default" className="gap-1">
                          <Check className="h-3 w-3" />
                          Uploaded
                        </Badge>
                      )}
                    </Label>
                    <input
                      ref={fileInputRefs[side]}
                      id={side}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageSelect(side, file);
                      }}
                      className="hidden"
                    />
                    {images[side] ? (
                      <div className="relative">
                        <img
                          src={images[side]}
                          alt={`${label} side`}
                          className="w-full h-48 object-cover rounded-lg border"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          className="absolute bottom-2 right-2"
                          onClick={() => fileInputRefs[side].current?.click()}
                        >
                          Change
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-48 border-dashed bg-gray-50/50 hover:bg-gray-50 transition-colors"
                        onClick={() => fileInputRefs[side].current?.click()}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Camera className="h-8 w-8 text-gray-400" />
                          <span className="text-sm text-gray-500">Upload {label} Image</span>
                        </div>
                      </Button>
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
            <CardHeader className="pb-0"> {/* Reduced bottom padding */}
              <CardTitle>Pillar Details</CardTitle>
            </CardHeader>
            {/* Increased pt-6 to create wider gap between Title and Pillar ID */}
            <CardContent className="space-y-4 pt-4"> 
              <div>
                <Label className="text-gray-600 block mb-1.5">Pillar ID</Label>
                <Input value={task.pillarId} readOnly className="bg-gray-50" />
              </div>

              <div>
                <Label className="text-gray-600 block mb-1.5">Location</Label>
                <Input value={task.location} readOnly className="bg-gray-50" />
              </div>

              <div>
                <Label className="text-gray-600 block mb-1.5">Address</Label>
                <Input value={task.address} readOnly className="bg-gray-50" />
              </div>

              <div>
                <Label className="text-gray-600 block mb-1.5">Locality</Label>
                <Input value={task.locality} readOnly className="bg-gray-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-0">
              <CardTitle>GPS Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4"> {/* Synchronized spacing */}
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
            <CardHeader className="pb-0">
              <CardTitle>Upload Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4"> {/* Synchronized spacing */}
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