import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Check, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';
import api from "@/app/api";
import { getApiErrorMessage } from '@/app/apiError';

export function SupervisorReview({ submission, currentUser, onBack, onApprove, onReject }) {
  const isApproved = submission.validationStatus === 'Approved';
  const isRejected = submission.validationStatus === 'Rejected';
  const isValidated = isApproved || isRejected;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const aiOverallRisk = submission.overallRisk || submission.approvalData?.severity || 'Medium';
  const [estimatedCost, setEstimatedCost] = useState(
    submission.approvalData?.estimatedCost?.toString() || '5000'
  );
  const [notes, setNotes] = useState(submission.approvalData?.remarks || '');
  const [rejectReason, setRejectReason] = useState(submission.rejectionReason || '');

  const getRiskBadge = (risk) => {
    const colors = {
      Critical: 'bg-red-100 text-red-700',
      High: 'bg-orange-100 text-orange-700',
      Medium: 'bg-yellow-100 text-yellow-700',
      Low: 'bg-blue-100 text-blue-700',
    };
    return <Badge className={colors[risk] || 'bg-gray-100 text-gray-700'}>{risk}</Badge>;
  };

  const allFaults = submission.detectionResults?.flatMap(r =>
    r.boundingBoxes.map(b => b.faultType)
  ).filter((v, i, a) => a.indexOf(v) === i) || [];

  const totalDetections = submission.detectionResults?.reduce(
    (sum, r) => sum + r.boundingBoxes.length, 0
  ) || 0;

  const handleApprove = async () => {
    if (!notes.trim()) { toast.error("Supervisor notes required"); return; }

    const cost = parseFloat(estimatedCost);
    if (isNaN(cost)) {
      toast.error("Please enter a valid estimated cost");
      return;
    }

    try {
      const response = await api.put(`/tasks/${submission.taskId}/validate`, {
        validation_status: "Approved",
        severity_validation: aiOverallRisk,
        cost_estimation: cost,
        remarks: notes,
        validation_by: currentUser.employeeId,
      });

      onApprove(submission.id, { severity: aiOverallRisk, cost, notes });
      toast.success("Maintenance approved");
    } catch (err) {
      console.error("Approve error:", err); // <-- and this
      toast.error(getApiErrorMessage(err, "Validation failed"));
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error("Rejection reason required"); return; }
    try {
      await api.put(`/tasks/${submission.taskId}/validate`, {
        validation_status: "Rejected",
        severity_validation: aiOverallRisk,
        cost_estimation: 0,
        remarks: rejectReason,
        validation_by: currentUser.employeeId,
      });
      onReject(submission.id, rejectReason);
      toast.success("Submission rejected");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Rejection failed"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Button
            variant="outline"
            onClick={onBack}
            className="h-9 w-9 p-0 sm:h-9 sm:w-auto sm:px-4 sm:py-2"
          >
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight">Supervisor Review</h2>
            <p className="mt-1 truncate text-gray-600">{submission.pillarId}</p>
          </div>
        </div>
        {isValidated && (
          <Button
            size="lg"
            disabled
            className={`w-full self-start cursor-not-allowed opacity-50 text-white sm:w-auto sm:self-auto ${
              isApproved
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isApproved ? (
              <>
                <Check className="h-5 w-5 mr-2" />
                Approved
              </>
            ) : (
              <>
                <X className="h-5 w-5 mr-2" />
                Rejected
              </>
            )}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
          {/* Removed default bottom padding to control gap precisely */}
          <CardHeader className="pb-0">
            <CardTitle>Detection Summary</CardTitle>
          </CardHeader>
          {/* Added pt-6 to create a wider gap before "Front", "Right", etc. */}
          <CardContent className="pt-4 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {submission.images.map((img) => (
                <div key={img.side} className="space-y-2">
                  {/* Label is now clearly separated from the Title */}
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

        {/* Review Actions Sidebar */}
        <div className="space-y-6">

          {(isApproved || !isValidated) && (
            <Card>
              <CardHeader>
                <CardTitle>Maintenance Assessment</CardTitle>
              </CardHeader>
              {/* Increased spacing between rows and added top padding */}
              <CardContent className="space-y-6 pt-4">
                <div>
                  <Label className="block mb-2">Severity Level (AI Detection)</Label>
                  <input
                    type="text"
                    value={aiOverallRisk}
                    disabled
                    className={`flex h-10 w-full rounded-md border border-input bg-input-background px-3 py-2 text-sm ${isValidated ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>

                <div>
                  <Label htmlFor="cost" className="block mb-2">Estimated Cost (RM)</Label>
                  <input
                    id="cost"
                    type="number"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    disabled={isValidated}
                    className={`flex h-10 w-full rounded-md border border-input bg-input-background px-3 py-2 text-sm ${isValidated ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>

                <div>
                  <Label htmlFor="notes" className="block mb-2">Supervisor Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter assessment notes and recommendations..."
                    rows={4}
                    disabled={isValidated}
                    className={isValidated ? 'opacity-60 cursor-not-allowed' : ''}
                  />
                </div>

                {!isValidated && (
                  <Button onClick={handleApprove} className="w-full bg-green-600" size="lg">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Approve Maintenance
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {(isRejected || !isValidated) && (
            <Card className={isRejected ? 'border-red-300' : 'border-red-200'}>
              <CardHeader>
                <CardTitle className="text-red-900">
                  {isRejected ? 'Rejection Reason' : 'Reject Submission'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                <div>
                  <Label htmlFor="reject" className="block mb-2">
                    {isRejected ? 'Reason Given' : 'Reason for Rejection'}
                  </Label>
                  <Textarea
                    id="reject"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Enter reason for rejection..."
                    rows={3}
                    disabled={isValidated}
                    className={isValidated ? 'opacity-60 cursor-not-allowed' : ''}
                  />
                </div>

                {!isValidated && (
                  <Button
                    onClick={handleReject}
                    variant="destructive"
                    className="w-full"
                  >
                    <XCircle className="h-5 w-5 mr-2" />
                    Reject Maintenance
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

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
                <span className="text-gray-600">Due Date:</span>
                <div
                  className={`mt-1 flex items-center justify-between rounded-lg border px-3 py-2 ${
                    submission.dueDate ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <span className={`text-sm font-semibold ${submission.dueDate ? 'text-red-900' : 'text-gray-700'}`}>
                    {submission.dueDate ? new Date(submission.dueDate).toLocaleDateString() : 'N/A'}
                  </span>
                  {submission.dueDate && (
                    <Badge className="bg-red-600 text-white hover:bg-red-600">Due</Badge>
                  )}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Submitted By:</span>
                <p className="font-medium">{submission.submittedBy}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
