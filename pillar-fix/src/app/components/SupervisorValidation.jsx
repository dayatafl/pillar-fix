import { useState } from 'react';
import { Eye, Filter,  CheckCircle, Siren, AlertCircle, Clock, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

export function SupervisorValidation({ submissions, onReview }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const pendingReview = submissions.filter(
    s => s.detectionStatus === 'Completed' && !s.overallRisk
  );

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-MY', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRiskBadge = (risk) => {
    const colors = {
      Critical: 'bg-red-100 text-red-700',
      High: 'bg-orange-100 text-orange-700',
      Medium: 'bg-yellow-100 text-yellow-700',
      Low: 'bg-blue-100 text-blue-700',
    };

    return (
      <Badge className={colors[risk]}>
        {risk}
      </Badge>
    );
  };

  const getValidationBadge = (status) => {
    const colors = {
      Pending: 'bg-yellow-100 text-yellow-700',
      Rejected: 'bg-red-100 text-red-700',
      Approved: 'bg-green-100 text-green-700',
    };

    return (
      <Badge className={colors[status] || colors.Pending}>
        {status || 'Pending'}
      </Badge>
    );
  };

  // Filter submissions based on validation status
  const filteredSubmissions = submissions.filter(submission => {
    if (statusFilter === 'all') return true;
    const status = submission.validationStatus || 'Pending';
    return status === statusFilter;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Supervisor Validation</h2>
        <p className="text-gray-600 mt-1">
          Review and approve AI detection results for maintenance
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className = "flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">
              High Priority
            </CardTitle>
            <Siren className="h-5 w-5 text-red-500"/>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {submissions.filter(s => s.overallRisk === 'Critical' || s.overallRisk === 'High').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className = "flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">
              Approved
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {submissions.filter(s => (s.validationStatus || 'Pending') === 'Approved').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className = "flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">
              Rejected
            </CardTitle>
            <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {submissions.filter(s => (s.validationStatus || 'Pending') === 'Rejected').length}
            </div>
          </CardContent>
        </Card>        

        <Card>
          <CardHeader className="pb-2">
            <div className = "flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">
              Pending
            </CardTitle>
            <Clock className="h-5 w-5 text-yellow-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingReview.length}</div>
          </CardContent>
        </Card>        

        <Card>
          <CardHeader className="pb-2">
            <div className = "flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Reviewed
            </CardTitle>
            <MapPin className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {submissions.filter(s => s.overallRisk).length}
            </div>
          </CardContent>
        </Card>     
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 text-gray-500" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Card>
        <CardContent>
          <div className="py-4 space-y-3">
            {filteredSubmissions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {submissions.length === 0 
                  ? 'No submissions pending review'
                  : `No submissions with ${statusFilter === 'all' ? 'any' : statusFilter} status`
                }
              </div>
            ) : (
              filteredSubmissions.map((submission) => {
                const faultCount = submission.detectionResults?.reduce(
                  (sum, r) => sum + r.boundingBoxes.length, 0
                ) || 0;

                return (
                  <div
                    key={submission.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="grid grid-cols-2 gap-1 w-20 h-20 flex-shrink-0">
                        {submission.images.slice(0, 4).map((img, idx) => (
                          <div key={idx} className="rounded overflow-hidden bg-gray-100">
                            <img
                              src={img.imageUrl}
                              alt={img.side}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{submission.pillarId}</h4>
                          {submission.overallRisk && getRiskBadge(submission.overallRisk)}
                          {getValidationBadge(submission.validationStatus)}
                          {faultCount > 0 && (
                            <Badge variant="outline">
                              {faultCount} fault{faultCount !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{submission.address}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Submitted: {formatDate(submission.submittedAt)} • {submission.submittedBy}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReview(submission.id)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Review
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
