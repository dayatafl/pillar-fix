import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Check, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';
import api from "@/app/api";
import { getApiErrorMessage } from '@/app/apiError';

// ─── Shared button style helper ───────────────────────────────────────────────
function btnStyle(disabled) {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34, borderRadius: '50%',
    background: 'rgba(255,255,255,0.13)',
    border: 'none', color: '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.35 : 1,
    transition: 'background 0.15s',
  };
}

// ─── Lightbox — rendered via React portal directly onto document.body ─────────
function Lightbox({ open, onClose, imageUrl, label, boxes = [], getBoundingBoxColor }) {
  const [zoom, setZoom] = useState(1);
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 4;

  useEffect(() => {
    if (open) setZoom(1);
  }, [open, imageUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '=' || e.key === '+') setZoom(z => Math.min(MAX_ZOOM, parseFloat((z + 0.5).toFixed(1))));
      if (e.key === '-') setZoom(z => Math.max(MIN_ZOOM, parseFloat((z - 0.5).toFixed(1))));
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || !imageUrl) return null;

  const handleCycleZoom = (e) => {
    e.stopPropagation();
    setZoom(z => (z < 2 ? 2 : z < 3 ? 3 : z < 4 ? 4 : 1));
  };

  const content = (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        width: '100vw', height: '100vh',
        zIndex: 2147483647,
        backgroundColor: 'rgba(0,0,0,0.93)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', zIndex: 1,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {label}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(MIN_ZOOM, parseFloat((z - 0.5).toFixed(1)))); }}
            style={btnStyle(zoom <= MIN_ZOOM)}
            title="Zoom out (−)"
          >
            <ZoomOut size={15} />
          </button>

          <span style={{ color: '#fff', fontSize: 12, minWidth: 34, textAlign: 'center', userSelect: 'none' }}>
            {zoom.toFixed(1)}×
          </span>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(MAX_ZOOM, parseFloat((z + 0.5).toFixed(1)))); }}
            style={btnStyle(zoom >= MAX_ZOOM)}
            title="Zoom in (+)"
          >
            <ZoomIn size={15} />
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{ ...btnStyle(false), marginLeft: 10 }}
            title="Close (Esc)"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Scrollable viewport when zoomed */}
      <div
        style={{
          overflow: zoom > 1 ? 'auto' : 'hidden',
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          paddingTop: 52, paddingBottom: 36,
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            position: 'relative',
            display: 'inline-block',
            cursor: zoom < MAX_ZOOM ? 'zoom-in' : 'zoom-out',
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            transition: 'transform 0.22s ease',
          }}
          onClick={handleCycleZoom}
        >
          <img
            src={imageUrl}
            alt={label}
            style={{
              display: 'block',
              maxWidth: zoom <= 1 ? '88vw' : undefined,
              maxHeight: zoom <= 1 ? '82vh' : undefined,
              borderRadius: 8,
              boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
              userSelect: 'none',
              WebkitUserDrag: 'none',
              pointerEvents: 'none',
            }}
            draggable={false}
          />
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            {boxes.map((box, i) => (
              <g key={i}>
                <rect
                  x={`${box.x}%`} y={`${box.y}%`}
                  width={`${box.width}%`} height={`${box.height}%`}
                  fill="none" stroke={getBoundingBoxColor(box.faultType)}
                  strokeWidth="2.5" strokeDasharray="5,4" opacity="0.95"
                />
                <text
                  x={`${box.x + 0.8}%`} y={`${box.y + 2.8}%`}
                  fill={getBoundingBoxColor(box.faultType)}
                  fontSize="13" fontWeight="bold"
                  style={{ filter: 'drop-shadow(1px 1px 3px rgba(0,0,0,0.9))' }}
                >
                  {box.faultType} ({Math.round(box.confidence * 100)}%)
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Bottom hint */}
      <div style={{
        position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.3)', fontSize: 11, whiteSpace: 'nowrap', pointerEvents: 'none',
      }}>
        Click image to zoom · Esc or click outside to close
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// ─── Main component ────────────────────────────────────────────────────────────
export function SupervisorReview({ submission, currentUser, onBack, onApprove, onReject }) {
  const isApproved = submission.validationStatus === 'Approved';
  const isRejected = submission.validationStatus === 'Rejected';
  const isValidated = isApproved || isRejected;

  const [imageSizes, setImageSizes] = useState({});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState({ url: '', label: '', side: '' });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const openLightbox = (url, label, side) => {
    setLightboxImage({ url, label, side });
    setLightboxOpen(true);
  };
  const closeLightbox = () => setLightboxOpen(false);

  const aiOverallRisk = submission.overallRisk || submission.approvalData?.severity || 'Medium';
  const [estimatedCost, setEstimatedCost] = useState(
    submission.approvalData?.estimatedCost?.toString()
    ?? submission.estimatedCost?.toString()
    ?? ''
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

  const normalizeFaultType = (box) => String(box?.faultType || box?.class || box?.label || 'Unknown').trim();

  const toPercent = (value, dimension) => {
    const n = Number(value ?? 0);
    if (Number.isNaN(n) || n <= 0) return 0;
    if (n <= 1) return Math.min(100, Math.max(0, n * 100));
    if (dimension && dimension > 0) {
      if (n <= dimension) return Math.min(100, Math.max(0, (n / dimension) * 100));
      if (n <= 100) return Math.min(100, Math.max(0, n));
    }
    return Math.min(100, Math.max(0, n));
  };

  const normalizeBox = (box, size) => {
    const faultType = normalizeFaultType(box);
    const confidence = Number(box?.confidence ?? box?.confidence_level ?? 0);
    const width = toPercent(box?.width, size?.width);
    const height = toPercent(box?.height, size?.height);
    const centerX = toPercent(box?.x, size?.width);
    const centerY = toPercent(box?.y, size?.height);
    const x = Math.max(0, centerX - width / 2);
    const y = Math.max(0, centerY - height / 2);
    return { x, y, width: Math.min(width, 100 - x), height: Math.min(height, 100 - y), confidence, faultType };
  };

  const getBoundingBoxColor = (faultType) => ({
    'rust': 'rgb(239, 68, 68)',
    'Vandalisme': 'rgb(234, 179, 8)',
    'slanted': 'rgb(239, 68, 68)',
    'unlocked': 'rgb(168, 85, 247)',
    'feeder pillar': 'rgb(16, 185, 129)',
  }[faultType] || 'rgb(107, 114, 128)');

  const allFaults = submission.detectionResults?.flatMap(r =>
    (r.boundingBoxes ?? [])
      .map(b => normalizeFaultType(b))
      .filter(v => v && !/feeder pillar/i.test(v))
  ).filter((v, i, a) => a.indexOf(v) === i) || [];

  const totalDetections = submission.detectionResults?.reduce(
    (sum, r) => sum + r.boundingBoxes.length, 0
  ) || 0;
  const lightboxResult = submission.detectionResults?.find(r => r.side === lightboxImage.side);
  const lightboxBoxes = (lightboxResult?.boundingBoxes ?? []).map((box) =>
    normalizeBox(box, imageSizes[lightboxImage.side])
  );

  const handleApprove = async () => {
    if (!notes.trim()) { toast.error("Supervisor notes required"); return; }
    const cost = parseFloat(estimatedCost);
    if (isNaN(cost)) { toast.error("Please enter a valid estimated cost"); return; }
    try {
      await api.put(`/tasks/${submission.taskId}/validate`, {
        validation_status: "Approved",
        severity_validation: aiOverallRisk,
        cost_estimation: cost,
        remarks: notes,
        validation_by: currentUser.employeeId,
      });
      onApprove(submission.id, { severity: aiOverallRisk, cost, notes });
      toast.success("Maintenance approved");
    } catch (err) {
      console.error("Approve error:", err);
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
      <Lightbox
        open={lightboxOpen}
        onClose={closeLightbox}
        imageUrl={lightboxImage.url}
        label={lightboxImage.label}
        boxes={lightboxBoxes}
        getBoundingBoxColor={getBoundingBoxColor}
      />

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
              isApproved ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isApproved ? (
              <><Check className="h-5 w-5 mr-2" />Approved</>
            ) : (
              <><X className="h-5 w-5 mr-2" />Rejected</>
            )}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-0">
              <CardTitle>Detection Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              {/* Thumbnail grid — each image clickable */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {submission.images.map((img) => {
                  const sideResult = submission.detectionResults?.find(r => r.side === img.side);
                  const sideBoxes = (sideResult?.boundingBoxes ?? []).map((box) =>
                    normalizeBox(box, imageSizes[img.side])
                  );

                  return (
                    <div key={img.side} className="space-y-2">
                      <p className="text-sm font-medium capitalize">{img.side}</p>

                      {/* Clickable thumbnail */}
                      <div
                        className="relative group cursor-zoom-in"
                        onClick={() =>
                          openLightbox(
                            img.imageUrl,
                            `${img.side.toUpperCase()} — ${submission.pillarId}`,
                            img.side
                          )
                        }
                        title="Click to view fullscreen"
                      >
                        <img
                          src={img.imageUrl}
                          alt={img.side}
                          className="w-full h-32 object-cover rounded-lg border transition-[filter] duration-200 group-hover:brightness-75"
                          onLoad={(e) =>
                            setImageSizes(prev => ({
                              ...prev,
                              [img.side]: { width: e.target.naturalWidth, height: e.target.naturalHeight },
                            }))
                          }
                        />
                        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
                          {sideBoxes.map((box, i) => (
                            <g key={i}>
                              <rect
                                x={`${box.x}%`} y={`${box.y}%`}
                                width={`${box.width}%`} height={`${box.height}%`}
                                fill="none" stroke={getBoundingBoxColor(box.faultType)}
                                strokeWidth="2.5" strokeDasharray="5,4" opacity="0.95"
                              />
                              <text
                                x={`${box.x + 0.8}%`} y={`${box.y + 2.8}%`}
                                fill={getBoundingBoxColor(box.faultType)}
                                fontSize="11" fontWeight="bold"
                                style={{ filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.9))' }}
                              >
                                {box.faultType}
                              </text>
                            </g>
                          ))}
                        </svg>
                        {/* Hover zoom hint */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none rounded-lg">
                          <div className="flex items-center gap-1 bg-black/60 text-white text-xs font-medium px-2 py-1 rounded-full backdrop-blur-sm">
                            <ZoomIn className="h-3 w-3" />
                            Fullscreen
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-gray-600">
                        {submission.detectionResults?.find(r => r.side === img.side)?.boundingBoxes.length || 0} fault(s)
                      </p>
                    </div>
                  );
                })}
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
                  <Label htmlFor="cost" className="block mb-2">
                    Estimated Cost (RM)
                    {submission.estimatedCost != null && !submission.approvalData?.estimatedCost && (
                      <span className="ml-2 text-xs font-normal text-blue-600">AI suggested</span>
                    )}
                  </Label>
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
                  <Button onClick={handleReject} variant="destructive" className="w-full">
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