import { useState, useRef } from 'react';
import { Upload, MapPin, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { toast } from 'sonner';

// Mock AI fault detection
const detectFaults = (imageFile) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const possibleFaults = [
        'Physical Damage',
        'Broken Panel',
        'Corrosion',
        'Exposed Wiring',
        'Vandalism',
        'Obstruction',
      ];
      
      const numFaults = Math.floor(Math.random() * 3) + 1;
      const detectedFaults = [];
      
      for (let i = 0; i < numFaults; i++) {
        const randomFault = possibleFaults[Math.floor(Math.random() * possibleFaults.length)];
        const confidence = Math.random() * 0.4 + 0.6; // 60-100%
        
        detectedFaults.push({
          type: randomFault,
          confidence: Math.round(confidence * 100) / 100,
        });
      }
      
      resolve(detectedFaults);
    }, 2000);
  });
};

const calculateSeverity = (faults) => {
  const criticalFaults = ['Exposed Wiring', 'Physical Damage'];
  const highFaults = ['Broken Panel', 'Vandalism'];
  
  if (faults.some(f => criticalFaults.includes(f.type) && f.confidence > 0.7)) {
    return 'Critical';
  }
  if (faults.some(f => highFaults.includes(f.type) && f.confidence > 0.6)) {
    return 'High';
  }
  if (faults.length > 2) {
    return 'Medium';
  }
  return 'Low';
};

export function ReportCase({ onCaseReported }) {
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedFaults, setDetectedFaults] = useState([]);
  const fileInputRef = useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      
      // Auto-analyze image
      analyzeImage(file);
    }
  };

  const analyzeImage = async (file) => {
    setIsAnalyzing(true);
    try {
      const faults = await detectFaults(file);
      setDetectedFaults(faults);
      toast.success(`Detected ${faults.length} fault(s) in image`);
    } catch (error) {
      toast.error('Failed to analyze image');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!location || !address || !imageFile || detectedFaults.length === 0) {
      toast.error('Please fill in all required fields and upload an image');
      return;
    }

    // Mock GPS coordinates
    const coordinates = {
      lat: -33.8688 + (Math.random() - 0.5) * 0.1,
      lng: 151.2093 + (Math.random() - 0.5) * 0.1,
    };

    const newCase = {
      id: Date.now().toString(),
      location,
      address,
      coordinates,
      imageUrl: imagePreview,
      faults: detectedFaults.map(f => f.type),
      severity: calculateSeverity(detectedFaults),
      status: 'Reported',
      reportedAt: new Date().toISOString(),
      notes,
      detectedFaults,
    };

    onCaseReported(newCase);
    
    // Reset form
    setLocation('');
    setAddress('');
    setNotes('');
    setImageFile(null);
    setImagePreview(null);
    setDetectedFaults([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    toast.success('Case reported successfully!');
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-bold">Report New Case</h2>
        <p className="text-gray-600 mt-1">
          Upload an image of the feeder pillar for AI-powered fault detection
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Location Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="location">Pillar ID / Location Name *</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., FP-2024-001 or Main Street Pillar"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., 123 Main Street, Sydney NSW 2000"
                required
              />
            </div>

            <div>
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional information about the issue..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Image Upload & AI Detection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="image">Upload Pillar Image *</Label>
              <div className="mt-2">
                <input
                  ref={fileInputRef}
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {imageFile ? 'Change Image' : 'Select Image'}
                </Button>
              </div>
            </div>

            {imagePreview && (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-64 object-cover"
                  />
                </div>

                {isAnalyzing && (
                  <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" />
                    <span className="text-blue-700">Analyzing image with AI...</span>
                  </div>
                )}

                {!isAnalyzing && detectedFaults.length > 0 && (
                  <Card className="border-2 border-orange-200 bg-orange-50">
                    <CardHeader>
                      <CardTitle className="flex items-center text-orange-900">
                        <AlertTriangle className="mr-2 h-5 w-5" />
                        Detected Faults
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {detectedFaults.map((fault, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-white rounded-lg"
                          >
                            <span className="font-medium">{fault.type}</span>
                            <span className="text-sm text-gray-600">
                              {Math.round(fault.confidence * 100)}% confidence
                            </span>
                          </div>
                        ))}
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">Severity Assessment:</span>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              calculateSeverity(detectedFaults) === 'Critical' ? 'bg-red-100 text-red-700' :
                              calculateSeverity(detectedFaults) === 'High' ? 'bg-orange-100 text-orange-700' :
                              calculateSeverity(detectedFaults) === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {calculateSeverity(detectedFaults)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" className="flex-1" disabled={isAnalyzing || detectedFaults.length === 0}>
            <MapPin className="mr-2 h-4 w-4" />
            Submit Report
          </Button>
        </div>
      </form>
    </div>
  );
}
