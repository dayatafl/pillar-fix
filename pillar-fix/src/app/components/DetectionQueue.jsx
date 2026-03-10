import { useState, useEffect } from 'react';
import { Loader2, Eye, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';

export function DetectionQueue({ submissions, onViewDetection }) {
  const stats = {
    queued: submissions.filter(s => s.detectionStatus === 'Queued').length,
    processing: submissions.filter(s => s.detectionStatus === 'Processing').length,
    completed: submissions.filter(s => s.detectionStatus === 'Completed').length,
    failed: submissions.filter(s => s.detectionStatus === 'Failed').length,
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-AU', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Queued':
        return <Badge variant="secondary">Queued</Badge>;
      case 'Processing':
        return (
          <Badge variant="default" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case 'Completed':
        return (
          <Badge variant="default" className="bg-green-600 gap-1">
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        );
      case 'Failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRiskBadge = (risk) => {
    if (!risk) return null;
    
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
        <h2 className="text-3xl font-bold">AI Detection Queue</h2>
        <p className="text-gray-600 mt-1">
          Monitor and review AI detection results
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Queued
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.queued}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.processing}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.failed}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detection Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {submissions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No submissions in queue
              </div>
            ) : (
              submissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      {submission.images[0] && (
                        <img
                          src={submission.images[0].imageUrl}
                          alt="Pillar"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{submission.pillarId}</h4>
                        {getStatusBadge(submission.detectionStatus)}
                        {submission.overallRisk && getRiskBadge(submission.overallRisk)}
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
                    onClick={() => onViewDetection(submission.id)}
                    disabled={submission.detectionStatus !== 'Completed'}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {submission.detectionStatus === 'Completed' ? 'View Results' : 'View'}
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
