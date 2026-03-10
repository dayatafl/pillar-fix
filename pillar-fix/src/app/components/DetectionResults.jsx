import { useState } from 'react';
import { ArrowLeft, AlertTriangle, Send, Check } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';

export function DetectionResults({ submission, onBack, onSendToSupervisor, currentUser, onViewValidation }) {
  const [selectedSide, setSelectedSide] = useState('front');

  const currentResult = submission.detectionResults?.find(r => r.side === selectedSide);
  const isSupervisorOrAbove = currentUser && ['supervisor', 'manager', 'admin'].includes(currentUser.role);


  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-AU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'Critical':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'High':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Low':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getBoundingBoxColor = (faultType) => {
    const colors = {
      'Physical Damage': 'rgb(239, 68, 68)',
      'Broken Panel': 'rgb(249, 115, 22)',
      'Corrosion': 'rgb(234, 179, 8)',
      'Exposed Wiring': 'rgb(239, 68, 68)',
      'Vandalism': 'rgb(168, 85, 247)',
      'Obstruction': 'rgb(59, 130, 246)',
      'Loose Connection': 'rgb(16, 185, 129)',
      'Water Ingress': 'rgb(6, 182, 212)',
    };
    return colors[faultType] || 'rgb(107, 114, 128)';
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
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight">AI Detection Results</h2>
            <p className="text-gray-600 mt-1 truncate">{submission.pillarId}</p>
          </div>
        </div>

        
          {/* Conditional buttons based on user role and validation status */}
          {currentUser && currentUser.role === 'supervisor' && !submission.validated && (
            <Button onClick={() => onViewValidation(submission.id)} size="lg" className="w-full sm:w-auto">
              <Send className="h-5 w-5 mr-2" />
              View Validation
            </Button>
          )}

          {currentUser && currentUser.role === 'supervisor' && submission.validated && (
            <Button 
              size="lg" 
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white cursor-not-allowed text-sm sm:text-base"
              disabled
            >
              <Check className="h-5 w-5 mr-2" />
              Validated by Supervisor
            </Button>
          )}

          {currentUser && !['admin', 'manager', 'supervisor'].includes(currentUser.role) && (
        <>
          {/* Already validated by supervisor — technician cannot re-send */}
          {(submission.validationStatus === 'Approved' || submission.validationStatus === 'Rejected') ? (
            <Button
              size="lg"
              className="w-full sm:w-auto bg-green-600 text-white cursor-not-allowed text-sm sm:text-base"
              disabled
            >
              <Check className="h-5 w-5 mr-2" />
              Validated by Supervisor
            </Button>
          ) : submission.sentToSupervisor ? (
            <Button
              size="lg"
              className="w-full sm:w-auto bg-blue-100 text-blue-700 cursor-not-allowed text-sm sm:text-base"
              disabled
            >
              <Send className="h-5 w-5 mr-2" />
              Sent to Supervisor
            </Button>
          ) : (
            <Button onClick={() => onSendToSupervisor(submission.id)} size="lg" className="w-full sm:w-auto">
              <Send className="h-5 w-5 mr-2" />
              Send to Supervisor
            </Button>
          )}
        </>
      )}

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detection Images */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detection Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={selectedSide} onValueChange={(v) => setSelectedSide(v)}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="front">Front</TabsTrigger>
                  <TabsTrigger value="right">Right</TabsTrigger>
                  <TabsTrigger value="back">Back</TabsTrigger>
                  <TabsTrigger value="left">Left</TabsTrigger>
                </TabsList>

                {['front', 'right', 'back', 'left'].map((side) => (
                  <TabsContent key={side} value={side} className="space-y-4">
                    {currentResult && (
                      <div className="relative">
                        <div className="relative inline-block">
                          <img
                            src={currentResult.imageUrl}
                            alt={`${side} side`}
                            className="w-full rounded-lg border"
                          />
                          {/* Bounding Boxes */}
                          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
                            {currentResult.boundingBoxes.map((box, index) => (
                              <g key={index}>
                                <rect
                                  x={`${box.x}%`}
                                  y={`${box.y}%`}
                                  width={`${box.width}%`}
                                  height={`${box.height}%`}
                                  fill="none"
                                  stroke={getBoundingBoxColor(box.faultType)}
                                  strokeWidth="3"
                                  strokeDasharray="5,5"
                                  opacity="0.9"
                                />
                                <text
                                  x={`${box.x + 1}%`}
                                  y={`${box.y + 2}%`}
                                  fill={getBoundingBoxColor(box.faultType)}
                                  fontSize="14"
                                  fontWeight="bold"
                                  style={{
                                    filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.8))',
                                  }}
                                >
                                  {box.faultType} ({Math.round(box.confidence * 100)}%)
                                </text>
                              </g>
                            ))}
                          </svg>
                        </div>

                        {/* Detected Faults List */}
                        {currentResult.boundingBoxes.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <h4 className="font-semibold text-sm">Detected Faults:</h4>
                            {currentResult.boundingBoxes.map((box, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-4 h-4 rounded"
                                    style={{ backgroundColor: getBoundingBoxColor(box.faultType) }}
                                  />
                                  <span className="font-medium">{box.faultType}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-sm text-gray-600">
                                    Confidence: {Math.round(box.confidence * 100)}%
                                  </div>
                                  <div className="w-24 bg-gray-200 rounded-full h-2">
                                    <div
                                      className="h-2 rounded-full"
                                      style={{
                                        width: `${box.confidence * 100}%`,
                                        backgroundColor: getBoundingBoxColor(box.faultType),
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {currentResult.boundingBoxes.length === 0 && (
                          <div className="mt-4 p-6 bg-green-50 rounded-lg text-center">
                            <p className="text-green-700 font-medium">
                              No faults detected on this side
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Overall Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-600">Risk Level</label>
                <div className="mt-1">
                  <Badge className={`text-base px-4 py-2 ${getRiskColor(submission.overallRisk || 'Low')}`}>
                    {submission.overallRisk || 'Low'}
                  </Badge>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  All Detected Faults
                </h4>
                <div className="space-y-2">
                  {submission.detectionResults?.flatMap(r => 
                    r.boundingBoxes.map(b => b.faultType)
                  ).filter((v, i, a) => a.indexOf(v) === i).map((fault, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-600" />
                      <span className="text-sm">{fault}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pillar Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-gray-600">Pillar ID:</span>
                <p className="font-medium">{submission.pillarId}</p>
              </div>
              <div>
                <span className="text-gray-600">Address:</span>
                <p className="font-medium">{submission.address}</p>
              </div>
              <div>
                <span className="text-gray-600">Coordinates:</span>
                <p className="font-medium">
                  {submission.coordinates.lat.toFixed(6)}, {submission.coordinates.lng.toFixed(6)}
                </p>
              </div>
              <div className="pt-2 border-t">
                <span className="text-gray-600">Submitted By:</span>
                <p className="font-medium">{submission.submittedBy}</p>
              </div>
              <div>
                <span className="text-gray-600">Submitted At:</span>
                <p className="font-medium">{formatDate(submission.submittedAt)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
