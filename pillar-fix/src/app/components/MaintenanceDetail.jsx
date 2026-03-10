import { useState, useRef, useEffect } from 'react';import { ArrowLeft, Upload, Plus, Calendar, Check, Clock, Camera, X, RotateCcw } from 'lucide-react';
import api from '@/app/api';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { toast } from 'sonner';

const SIDES = ['Front', 'Right', 'Back', 'Left'];

function CameraModal({ onCapture, onClose, withSides = false }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [activeSide, setActiveSide] = useState(0);
  const [capturedSides, setCapturedSides] = useState({});

  const startStream = (mode) => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: mode } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => onClose());
  };

  useEffect(() => {
    startStream(facingMode);
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const handleFlip = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startStream(next);
  };

  const handleSnap = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg');

    if (withSides) {
      const updated = { ...capturedSides, [activeSide]: dataUrl };
      setCapturedSides(updated);
      onCapture(dataUrl);
      const nextSide = SIDES.findIndex((_, i) => i !== activeSide && !updated[i]);
      if (nextSide !== -1) setActiveSide(nextSide);
    } else {
      onCapture(dataUrl);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onClose();
    }
  };

  const handleClose = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Top Bar */}
      <div className="relative flex items-center justify-between px-5 pt-4 pb-2 z-10">
        <span className="text-white text-sm font-medium">
          Capturing:{' '}
          <span className="text-blue-400 font-bold">
            {withSides ? `${SIDES[activeSide].toUpperCase()} SIDE` : 'PHOTO'}
          </span>
        </span>

        {withSides && (
          <div className="absolute left-1/2 -translate-x-1/2 flex gap-1">
            {SIDES.map((side, i) => (
              <button
                key={side}
                onClick={() => setActiveSide(i)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  i === activeSide
                    ? 'bg-blue-500 text-white'
                    : capturedSides[i]
                    ? 'bg-gray-500 text-white'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {side}
              </button>
            ))}
          </div>
        )}

        <button onClick={handleClose} className="text-white">
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Camera Feed */}
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        {/* Corner brackets */}
        {[
          'top-4 left-4 border-t-2 border-l-2',
          'top-4 right-4 border-t-2 border-r-2',
          'bottom-4 left-4 border-b-2 border-l-2',
          'bottom-4 right-4 border-b-2 border-r-2',
        ].map((cls, i) => (
          <div key={i} className={`absolute w-8 h-8 border-white ${cls}`} />
        ))}
      </div>

      {/* Bottom Controls */}
      <div className="relative flex items-center justify-center px-8 py-6 bg-black">
        <button
          onClick={handleFlip}
          className="absolute left-8 flex flex-col items-center gap-1 text-white"
        >
          <RotateCcw className="h-6 w-6" />
          <span className="text-xs">Flip</span>
        </button>

        <button
          onClick={handleSnap}
          className="w-16 h-16 rounded-full bg-white shadow-lg active:scale-95 transition-transform"
        />
      </div>
    </div>
  );
}

export function MaintenanceDetail({ item, currentUser, onBack, onUpdateWorkLog, onSubmitCompletion, onUpdateStatus }) {
  const [workLogAction, setWorkLogAction] = useState('');
  const [workLogNotes, setWorkLogNotes] = useState('');
  const [workLogImages, setWorkLogImages] = useState([]);
  const [completionImages, setCompletionImages] = useState([]);
  const [showWorkLogCamera, setShowWorkLogCamera] = useState(false);
  const [showCompletionCamera, setShowCompletionCamera] = useState(false);

  const fileInputRef = useRef(null);
  const workLogFileInputRef = useRef(null);

  const handleTakePhoto = (setShowCamera) => {
    setShowCamera(true);
  };

  const handleAddWorkLog = async () => {
    if (!workLogAction.trim() || !workLogNotes.trim()) {
      toast.error("Fill in all work log fields"); return;
    }
    try {
      await api.put(`/tasks/${item.taskId}/maintenance`, {
        maintenance_status: "In Progress",
        action: workLogAction,
        notes: workLogNotes,
        images: workLogImages,
        logged_by: currentUser.employeeId,
      });
      onUpdateWorkLog(item.id, {
        id: Date.now().toString(), timestamp: new Date().toISOString(),
        logged_by: currentUser.employeeId, logged_by_name: currentUser.name, action: workLogAction, notes: workLogNotes,
        images: workLogImages.length > 0 ? workLogImages : undefined,
      });
      onUpdateStatus(item.id, "In Progress");
      setWorkLogAction(""); setWorkLogNotes(""); setWorkLogImages([]);
      toast.success("Work log saved");
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail || 'Failed to save work log');
    }
  };

  const handleWorkLogImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setWorkLogImages(prev => [...prev, reader.result]);
      reader.readAsDataURL(file);
    });
  };

  const handleSubmitCompletion = async () => {
    if (completionImages.length < 4) {
      toast.error("Upload at least 4 completion images"); return;
    }
    try {
      await api.put(`/tasks/${item.taskId}/maintenance`, {
        maintenance_status: "Completed",
        action: "Completion evidence submitted",
        notes: "Post-maintenance photos uploaded",
        images: completionImages,
        logged_by: currentUser.employeeId,
        completion_evidence: completionImages[0],
        maintenance_validate_by: currentUser.employeeId,
      });
      onSubmitCompletion(item.id, {
        id: Date.now().toString(), timestamp: new Date().toISOString(),
        technician: currentUser.name, images: completionImages,
      });
      setCompletionImages([]);
      toast.success("Completion submitted");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Completion failed");
    }
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setCompletionImages(prev => [...prev, reader.result]);
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="space-y-6">
      {/* Camera Modals */}
      {showWorkLogCamera && (
        <CameraModal
          onCapture={(dataUrl) => setWorkLogImages(prev => [...prev, dataUrl])}
          onClose={() => setShowWorkLogCamera(false)}
        />
      )}
      {showCompletionCamera && (
        <CameraModal
          withSides
          onCapture={(dataUrl) => setCompletionImages(prev => [...prev, dataUrl])}
          onClose={() => setShowCompletionCamera(false)}
        />
      )}

      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-3xl font-bold">Maintenance Details</h2>
          <p className="text-gray-600 mt-1">{item.pillarId}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Previous Detection */}
          <Card>
            <CardHeader>
              <CardTitle>Previous AI Detection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {item.previousDetections?.length > 0
                  ? ['front', 'right', 'back', 'left'].map((side) => {
                      const detection = item.previousDetections.find(d => d.side === side);
                      return (
                        <div key={side} className="space-y-2">
                          <p className="text-sm font-medium capitalize">{side}</p>
                          {detection && (
                            <>
                              <img
                                src={detection.imageUrl}
                                alt={side}
                                className="w-full h-32 object-cover rounded-lg border"
                              />
                              <p className="text-xs text-gray-600">
                                {detection.boundingBoxes?.length ?? 0} fault(s)
                              </p>
                            </>
                          )}
                        </div>
                      );
                    })
                  : (
                    <p className="col-span-4 text-sm text-gray-500 text-center py-4">
                      No detection images available
                    </p>
                  )
                }
              </div>

              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">Detected Faults:</h4>
                <div className="flex flex-wrap gap-2">
                  {item.faults.map((fault, idx) => (
                    <Badge key={idx} variant="outline">{fault}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Work Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Work Log History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-6">
                {item.workLogs.length === 0 ? (
                  <p className="text-gray-500 text-center py-6">No work logs yet</p>
                ) : (
                  item.workLogs.map((log) => (
                    <div key={log.id} className="border-l-4 border-blue-600 pl-4 py-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold">{log.action}</p>
                          <p className="text-sm text-gray-600 mt-1">{log.notes}</p>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          <p>{new Date(log.timestamp).toLocaleDateString()}</p>
                          <p>{new Date(log.timestamp).toLocaleTimeString()}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">By: {log.logged_by_name}</p>

                      {log.images && log.images.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-600 mb-2">Evidence Photos:</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {log.images.map((img, idx) => (
                              <img
                                key={idx}
                                src={img}
                                alt={`Work evidence ${idx + 1}`}
                                className="w-full h-20 object-cover rounded border"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {item.status !== 'Completed' && item.status !== 'Verified' && (
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-semibold">Add Work Log</h4>

                  <div>
                    <Label htmlFor="action" className="block mb-2">Action Performed</Label>
                    <Input
                      id="action"
                      value={workLogAction}
                      onChange={(e) => setWorkLogAction(e.target.value)}
                      placeholder="e.g., Replaced damaged panel"
                    />
                  </div>

                  <div>
                    <Label htmlFor="notes" className="block mb-2">Notes</Label>
                    <Textarea
                      id="notes"
                      value={workLogNotes}
                      onChange={(e) => setWorkLogNotes(e.target.value)}
                      placeholder="Details of work performed..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label className="block mb-2">Images</Label>

                    {/* Hidden input for file upload */}
                    <input
                      ref={workLogFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleWorkLogImageSelect}
                      className="hidden"
                    />
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        onClick={() => handleTakePhoto(setShowWorkLogCamera)}
                        className="w-full"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Take Photo
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => workLogFileInputRef.current?.click()}
                        className="w-full"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Work Log Images ({workLogImages.length})
                      </Button>
                    </div>

                    {workLogImages.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                        {workLogImages.map((img, idx) => (
                          <div key={idx} className="relative">
                            <img
                              src={img}
                              alt={`Work Log ${idx + 1}`}
                              className="w-full h-24 object-cover rounded-lg border"
                            />
                            <button
                              onClick={() => setWorkLogImages(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-700"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={() => { handleAddWorkLog(); onUpdateStatus(item.id, 'In Progress'); }}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Work Log
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Completion Evidence - Upload Form */}
          {item.status === 'In Progress' && (
            <Card>
              <CardHeader>
                <CardTitle>Submit Completion Evidence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Upload images from all 4 sides of the pillar after maintenance completion
                </p>

                {/* Hidden inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={() => handleTakePhoto(setShowCompletionCamera)}
                    className="w-full"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Take Photo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Completion Images ({completionImages.length}/4)
                  </Button>
                </div>

                {completionImages.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {completionImages.map((img, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={img}
                          alt={`Completion ${idx + 1}`}
                          className="w-full h-24 object-cover rounded-lg border"
                        />
                        <button
                          onClick={() => setCompletionImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {completionImages.length >= 4 && (
                  <Button className="w-full" size="lg" onClick={handleSubmitCompletion}>
                    Submit
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Completion Evidence - View */}
          {item.status === 'Completed' && item.completion && (
            <Card>
              <CardHeader>
                <CardTitle>Completion Evidence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {item.completion.images?.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {item.completion.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`Completion ${idx + 1}`}
                        className="w-full h-24 object-cover rounded-lg border"
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No completion images available</p>
                )}
                <p className="text-xs text-gray-500">
                  Submitted: {new Date(item.completion.timestamp).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Maintenance Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-600">Status</Label>
                <div className="mt-1">
                  <Badge>{item.status}</Badge>
                </div>
              </div>

              {onUpdateStatus && item.status !== 'Completed' && item.status !== 'Verified' && (
                <div className="space-y-2">
                  <Label className="text-gray-600">Update Status</Label>
                  {item.status !== 'In Progress' && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => {
                        onUpdateStatus(item.id, 'In Progress');
                        toast.success('Status updated to In Progress');
                      }}
                    >
                      <Clock className="h-4 w-4" />
                      Mark as In Progress
                    </Button>
                  )}
                  {item.status === 'In Progress' && (
                    <Button
                      variant="default"
                      className="w-full gap-2 bg-green-600 hover:bg-green-700"
                      disabled={item.workLogs.length === 0 || !item.completion}
                      onClick={() => {
                        onUpdateStatus(item.id, 'Completed');
                        toast.success('Status updated to Completed');
                      }}
                    >
                      <Check className="h-4 w-4" />
                      Mark as Completed
                    </Button>
                  )}
                </div>
              )}

              <div>
                <Label className="text-gray-600">Priority</Label>
                <div className="mt-1">
                  <Badge className={
                    item.priority === 'Urgent' ? 'bg-red-100 text-red-700' :
                    item.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                    item.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }>
                    {item.priority}
                  </Badge>
                </div>
              </div>

              <div>
                <Label className="text-gray-600">Severity</Label>
                <div className="mt-1">
                  <Badge className={
                    item.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                    item.severity === 'High' ? 'bg-orange-100 text-orange-700' :
                    item.severity === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }>
                    {item.severity}
                  </Badge>
                </div>
              </div>

              <div>
                <Label className="text-gray-600">Estimated Cost</Label>
                <p className="font-medium text-lg">RM{(item.estimatedCost ?? 0).toLocaleString()}</p>
              </div>

              {item.scheduledDate && (
                <div>
                  <Label className="text-gray-600">Scheduled Date</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-gray-600" />
                    <span className="font-medium">
                      {new Date(item.scheduledDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )}

              {item.assignedTo && (
                <div>
                  <Label className="text-gray-600">Assigned Technician</Label>
                  <p className="font-medium">{item.assignedTo}</p>
                </div>
              )}

              {item.approvedBy && (
                <div>
                  <Label className="text-gray-600">Approved By</Label>
                  <p className="font-medium">{item.approvedBy}</p>
                  {item.approvedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(item.approvedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Location Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <Label className="text-gray-600">Address</Label>
                <p className="font-medium">{item.address}</p>
              </div>
              <div>
                <Label className="text-gray-600">Coordinates</Label>
                <p className="font-medium">
                  {item.coordinates
                    ? `${item.coordinates.lat.toFixed(6)}, ${item.coordinates.lng.toFixed(6)}`
                    : 'Not available'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
