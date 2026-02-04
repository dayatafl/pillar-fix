import { useState } from 'react';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { toast } from 'sonner';

export function SupervisorReview({ submission, onBack, onApprove, onReject }) {
  const [severity, setSeverity] = useState('Medium');
  const [priority, setPriority] = useState('Medium');
  const [estimatedCost, setEstimatedCost] = useState('5000');
  const [notes, setNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const allFaults = submission.detectionResults?.flatMap(r =>
    r.boundingBoxes.map(b => b.faultType)
  ).filter((v, i, a) => a.indexOf(v) === i) || [];

  const totalDetections = submission.detectionResults?.reduce(
    (sum, r) => sum + r.boundingBoxes.length, 0
  ) || 0;

  const handleApprove = () => {
    if (!notes.trim()) {
      toast.error('Please provide supervisor notes');
      return;
    }

    onApprove(submission.id, {
      severity,
      priority,
      estimatedCost: parseFloat(estimatedCost),
      notes,
    });

    toast.success('Maintenance approved and scheduled');
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    onReject(submission.id, rejectReason);
    toast.success('Submission rejected');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-3xl font-bold">Supervisor Review</h2>
          <p className="text-gray-600 mt-1">{submission.pillarId}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detection Overview */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detection Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {submission.images.map((img) => (
                  <div key={img.side} className="space-y-2">
                    <p className="text-sm font-medium capitalize">{img.side}</p>
                    <img
                      src={img.imageUrl}
                      alt={img.side}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <p className="text-xs text-gray-600">
                      {submission.detectionResults?.find(r => r.side === img.side)?.boundingBoxes.length || 0} fault(s)
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-6 w-6 text-orange-600" />
                    <div>
                      <p className="font-semibold text-orange-900">Total Detections</p>
                      <p className="text-sm text-orange-700">
                        {totalDetections} fault{totalDetections !== 1 ? 's' : ''} detected across all sides
                      </p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-orange-600">{totalDetections}</div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Detected Fault Types:</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {allFaults.map((fault, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <div className="w-2 h-2 rounded-full bg-red-600" />
                        <span className="text-sm">{fault}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {submission.detectionResults?.map((result) => {
                  if (result.boundingBoxes.length === 0) return null;
                  
                  return (
                    <Card key={result.side} className="border-orange-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base capitalize">{result.side} Side Analysis</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {result.boundingBoxes.map((box, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span className="text-sm font-medium">{box.faultType}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600">{Math.round(box.confidence * 100)}%</span>
                                <div className="w-20 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-orange-600 h-2 rounded-full"
                                    style={{ width: `${box.confidence * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Review Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="severity">Severity Level</Label>
                <Select value={severity} onValueChange={(v) => setSeverity(v)}>
                  <SelectTrigger id="severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="cost">Estimated Cost ($)</Label>
                <input
                  id="cost"
                  type="number"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="notes">Supervisor Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter assessment notes and recommendations..."
                  rows={4}
                />
              </div>

              <Button onClick={handleApprove} className="w-full" size="lg">
                <CheckCircle className="h-5 w-5 mr-2" />
                Approve for Maintenance
              </Button>
            </CardContent>
          </Card>

          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-900">Reject Submission</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="reject">Reason for Rejection</Label>
                <Textarea
                  id="reject"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  rows={3}
                />
              </div>

              <Button 
                onClick={handleReject} 
                variant="destructive" 
                className="w-full"
              >
                <XCircle className="h-5 w-5 mr-2" />
                Reject
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pillar Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Address:</span>
                <p className="font-medium">{submission.address}</p>
              </div>
              <div>
                <span className="text-gray-600">Submitted By:</span>
                <p className="font-medium">{submission.submittedBy}</p>
              </div>
              <div>
                <span className="text-gray-600">Submitted:</span>
                <p className="font-medium">
                  {new Date(submission.submittedAt).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
