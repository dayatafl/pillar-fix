import { useState } from 'react';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  AlertTriangle,
  User,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { toast } from 'sonner';

const statusWorkflow = [
  'Reported',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
  'Closed',
];

export function CaseDetail({ case_, onBack, onUpdateCase }) {
  const [status, setStatus] = useState(case_.status);
  const [assignedTo, setAssignedTo] = useState(case_.assignedTo || '');

  const handleUpdateStatus = () => {
    const updatedCase = {
      ...case_,
      status,
      assignedTo: assignedTo || undefined,
    };
    onUpdateCase(updatedCase);
    toast.success('Case updated successfully');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-AU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const currentStepIndex = statusWorkflow.indexOf(status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-3xl font-bold">{case_.location}</h2>
          <p className="text-gray-600 mt-1">Case #{case_.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image */}
          <Card>
            <CardHeader>
              <CardTitle>Pillar Image</CardTitle>
            </CardHeader>
            <CardContent>
              <img
                src={case_.imageUrl}
                alt={case_.location}
                className="w-full h-96 object-cover rounded-lg"
              />
            </CardContent>
          </Card>

          {/* Detected Faults */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5 text-orange-600" />
                AI-Detected Faults
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {case_.detectedFaults.map((fault, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{fault.type}</p>
                      <p className="text-sm text-gray-600">
                        Confidence: {Math.round(fault.confidence * 100)}%
                      </p>
                    </div>
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-orange-600 h-2 rounded-full"
                        style={{ width: `${fault.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Location Details */}
          <Card>
            <CardHeader>
              <CardTitle>Location Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start">
                <MapPin className="h-5 w-5 mr-3 mt-0.5 text-gray-600" />
                <div>
                  <p className="font-medium">Address</p>
                  <p className="text-gray-600">{case_.address}</p>
                </div>
              </div>
              <div className="flex items-start">
                <MapPin className="h-5 w-5 mr-3 mt-0.5 text-gray-600" />
                <div>
                  <p className="font-medium">GPS Coordinates</p>
                  <p className="text-gray-600">
                    {case_.coordinates.lat.toFixed(6)}, {case_.coordinates.lng.toFixed(6)}
                  </p>
                </div>
              </div>
              {case_.notes && (
                <div className="pt-3 border-t">
                  <p className="font-medium mb-2">Additional Notes</p>
                  <p className="text-gray-600">{case_.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Management */}
          <Card>
            <CardHeader>
              <CardTitle>Case Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusWorkflow.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="assignedTo">Assigned To</Label>
                <Input
                  id="assignedTo"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="Enter technician name"
                />
              </div>

              <Button onClick={handleUpdateStatus} className="w-full">
                Update Case
              </Button>
            </CardContent>
          </Card>

          {/* Workflow Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Workflow Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {statusWorkflow.map((s, index) => (
                  <div key={s} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      index <= currentStepIndex
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {index < currentStepIndex ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : index === currentStepIndex ? (
                        <Clock className="h-5 w-5" />
                      ) : (
                        <span className="text-xs">{index + 1}</span>
                      )}
                    </div>
                    <span className={`text-sm ${
                      index <= currentStepIndex ? 'font-medium' : 'text-gray-500'
                    }`}>
                      {s}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Case Information */}
          <Card>
            <CardHeader>
              <CardTitle>Case Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Severity</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  case_.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                  case_.severity === 'High' ? 'bg-orange-100 text-orange-700' :
                  case_.severity === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {case_.severity}
                </span>
              </div>

              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 mt-0.5 text-gray-600" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Reported At</p>
                  <p className="text-sm font-medium">{formatDate(case_.reportedAt)}</p>
                </div>
              </div>

              {case_.assignedTo && (
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 mt-0.5 text-gray-600" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">Assigned To</p>
                    <p className="text-sm font-medium">{case_.assignedTo}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
