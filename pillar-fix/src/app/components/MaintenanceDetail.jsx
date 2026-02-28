import { useState, useRef } from 'react';
import { ArrowLeft, Upload, Plus, Calendar, Check, Clock } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { toast } from 'sonner';

export function MaintenanceDetail({ item, onBack, onUpdateWorkLog, onSubmitCompletion, onUpdateStatus }) {
  const [workLogAction, setWorkLogAction] = useState('');
  const [workLogNotes, setWorkLogNotes] = useState('');
  const [workLogImages, setWorkLogImages] = useState([]);
  const [completionImages, setCompletionImages] = useState([]);
  const fileInputRef = useRef(null);
  const workLogFileInputRef = useRef(null);

  const handleAddWorkLog = () => {
    if (!workLogAction.trim() || !workLogNotes.trim()) {
      toast.error('Please fill in all work log fields');
      return;
    }

    const newLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      technician: item.assignedTo,
      action: workLogAction,
      notes: workLogNotes,
      images: workLogImages.length > 0 ? workLogImages : undefined,
    };

    onUpdateWorkLog(item.id, newLog);
    setWorkLogAction('');
    setWorkLogNotes('');
    setWorkLogImages([]);
    toast.success('Work log added');
  };

  const handleWorkLogImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setWorkLogImages(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmitCompletion = () => {
    if (completionImages.length < 4) {
      toast.error('Please upload at least 4 images of the completed work');
      return;
    }

    const completionData = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      technician: item.assignedTo,
      images: completionImages.length > 0 ? completionImages :undefined,
    };

    onSubmitCompletion(item.id, completionData);
    setCompletionImages([]);
    toast.success('Completion submitted');
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompletionImages(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="space-y-6">
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
                {item.previousDetections[0] && 
                  ['front', 'right', 'back', 'left'].map((side) => {
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
                              {detection.boundingBoxes.length} fault(s)
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })
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
                      <p className="text-xs text-gray-500 mt-2">By: {log.technician}</p>
                      
                      {/* Display work log images if available */}
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
                
                //Add Work Log Form//

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
                    <Label htmlFor="images" className="block mb-2">Images</Label>
                    <input
                      ref={workLogFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleWorkLogImageSelect}
                      className="hidden"
                    />

                    <Button
                      variant="outline"
                      onClick={() => workLogFileInputRef.current?.click()}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Work Log Images ({workLogImages.length})
                    </Button>

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
                  <Button onClick={() => {handleAddWorkLog(); onUpdateStatus(item.id, 'In Progress');}} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Work Log
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Completion Evidence */}
          {item.status === 'In Progress' && (
            <Card>
              <CardHeader>
                <CardTitle>Submit Completion Evidence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Upload images from all 4 sides of the pillar after maintenance completion
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />

                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Completion Images ({completionImages.length}/4)
                </Button>

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
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleSubmitCompletion}
                  >
                    Submit
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Completion Evidence */}
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
                  <p className="text-gray-500 text-center py-4">
                    No completion images available
                  </p>
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

              {/* Status Update Buttons */}
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
                <p className="font-medium text-lg">RM{item.estimatedCost.toLocaleString()}</p>
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
                  {item.coordinates.lat.toFixed(6)}, {item.coordinates.lng.toFixed(6)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
