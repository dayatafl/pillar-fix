import { useState, useEffect } from 'react';
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-MY', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Single source of truth for a submission's validation status.
  // 'Approved' and 'Rejected' are set explicitly by the supervisor via app.jsx.
  // Everything else that has reached this page is 'Pending'.
  const getValidationStatus = (submission) => {
    if (submission.validationStatus === 'Approved') return 'Approved';
    if (submission.validationStatus === 'Rejected') return 'Rejected';
    return 'Pending';
  };

  const getRiskBadge = (risk) => {
    const colors = {
      Critical: 'bg-red-100 text-red-700',
      High: 'bg-orange-100 text-orange-700',
      Medium: 'bg-yellow-100 text-yellow-700',
      Low: 'bg-blue-100 text-blue-700',
    };
    return <Badge className={colors[risk]}>{risk}</Badge>;
  };

  const getValidationBadge = (status) => {
    const styles = {
      Pending:  'bg-yellow-100 text-yellow-700',
      Approved: 'bg-green-100 text-green-700',
      Rejected: 'bg-red-100 text-red-700',
    };
    return <Badge className={styles[status]}>{status}</Badge>;
  };

  // ── Dashboard counts ────────────────────────────────────────────────────────
  const highPriorityCount = submissions.filter(
    s => s.overallRisk === 'Critical' || s.overallRisk === 'High'
  ).length;

  const approvedCount = submissions.filter(
    s => getValidationStatus(s) === 'Approved'
  ).length;

  const rejectedCount = submissions.filter(
    s => getValidationStatus(s) === 'Rejected'
  ).length;

  // Pending Review: sent to supervisor but not yet acted on
  const pendingReviewCount = submissions.filter(
    s => getValidationStatus(s) === 'Pending'
  ).length;

  // Total Reviewed: supervisor has made a decision (Approved OR Rejected)
  const totalReviewedCount = submissions.filter(
    s => getValidationStatus(s) === 'Approved' || getValidationStatus(s) === 'Rejected'
  ).length;

  // ── Submissions list ────────────────────────────────────────────────────────
  const filteredSubmissions = submissions.filter(submission => {
    if (statusFilter === 'all') return true;
    return getValidationStatus(submission) === statusFilter;
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              High Priority
            </CardTitle>
            <Siren className="h-5 w-5 text-red-600"/>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {highPriorityCount}
            </div>
            <p className="text-xs text-gray-500 mt-1">&nbsp;</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Pending
            </CardTitle>
            <Clock className="h-5 w-5 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReviewCount}</div>
            <p className="text-xs text-gray-500 mt-1">&nbsp;</p>
          </CardContent>
        </Card>        

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Approved
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {submissions.filter(s => (s.validationStatus || 'Pending') === 'Approved').length}
            </div>
            <p className="text-xs text-gray-500 mt-1">&nbsp;</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Rejected
            </CardTitle>
            <AlertCircle className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {submissions.filter(s => (s.validationStatus || 'Pending') === 'Rejected').length}
            </div>
            <p className="text-xs text-gray-500 mt-1">&nbsp;</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex 2flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Reviewed
            </CardTitle>
            <MapPin className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalReviewedCount}
            </div>
            <p className="text-xs text-gray-500 mt-1">&nbsp;</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            
            <SelectTrigger className="w-60 bg-white border rounded-md px-3 py-2 text-sm shadow-sm cursor-pointer ring-offset-white focus:ring-0 focus:ring-offset-0 font-semibold">
              <div className="flex items-center gap-2 font-semibold">
                <Filter className="h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </div>
              {/* Note: The Chevron is usually built into the Shadcn SelectTrigger component */}
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

      <div className="space-y-3">
        {filteredSubmissions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {submissions.length === 0
              ? 'No submissions pending review'
              : `No submissions with "${statusFilter}" status`}
          </div>
        ) : (
          filteredSubmissions.map((submission) => {
            const faultCount =
              submission.detectionResults?.reduce(
                (sum, r) => sum + r.boundingBoxes.length,
                0
              ) || 0;

            const validationStatus = getValidationStatus(submission);
            const isValidated = validationStatus === 'Approved' || validationStatus === 'Rejected';

            return (
              <div key={submission.id}>
                <div className="md:hidden p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-all space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-semibold text-sm break-all">{submission.pillarId}</h4>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {submission.overallRisk && getRiskBadge(submission.overallRisk)}
                      {getValidationBadge(validationStatus)}
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 leading-relaxed">{submission.address}</p>

                  <div className="grid grid-cols-2 gap-1 w-20 h-20">
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

                  <div className="flex items-center justify-between pt-2 border-t">
                    <p className="text-xs text-gray-500">
                      Submitted: {formatDate(submission.submittedAt)}
                    </p>
                    <p className="text-xs text-gray-500">{submission.submittedBy}</p>
                  </div>

                  <Button
                    variant={isValidated ? 'secondary' : 'outline'}
                    size="sm"
                    className="w-full"
                    onClick={() => onReview(submission.id)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {isValidated ? 'View' : 'Review'}
                  </Button>
                </div>

                <div className="hidden md:flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-all">
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold">{submission.pillarId}</h4>
                        {submission.overallRisk && getRiskBadge(submission.overallRisk)}
                        {getValidationBadge(validationStatus)}
                      </div>
                      <p className="text-sm text-gray-600">{submission.address}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Submitted: {formatDate(submission.submittedAt)} •{' '}
                        {submission.submittedBy}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant={isValidated ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => onReview(submission.id)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {isValidated ? 'View' : 'Review'}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
