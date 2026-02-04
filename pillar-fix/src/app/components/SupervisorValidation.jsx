import { Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';

export function SupervisorValidation({ submissions, onReview }) {
  const pendingReview = submissions.filter(
    s => s.detectionStatus === 'Completed' && !s.overallRisk
  );

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-AU', {
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Supervisor Validation</h2>
        <p className="text-gray-600 mt-1">
          Review and approve AI detection results for maintenance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingReview.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              High Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {submissions.filter(s => s.overallRisk === 'Critical' || s.overallRisk === 'High').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Reviewed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {submissions.filter(s => s.overallRisk).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {submissions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No submissions pending review
              </div>
            ) : (
              submissions.map((submission) => {
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
