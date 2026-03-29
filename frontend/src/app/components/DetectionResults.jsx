import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, AlertTriangle, Send, Check, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';

function Lightbox({ open, onClose, imageUrl, label, boxes, getBoundingBoxColor }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open || !imageUrl) return null;

  const content = (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        width: '100vw', height: '100vh', zIndex: 2147483647,
        backgroundColor: 'rgba(0,0,0,0.93)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
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
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(255,255,255,0.13)', border: 'none', color: '#fff',
            cursor: 'pointer', transition: 'background 0.15s',
          }}
          title="Close (Esc)"
        >
          <X size={17} />
        </button>
      </div>

      {/* Image */}
      <div
        style={{
          overflow: 'hidden', width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          paddingTop: 52, paddingBottom: 36, boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img
            src={imageUrl}
            alt={label}
            style={{
              display: 'block', maxWidth: '88vw', maxHeight: '82vh',
              borderRadius: 8, boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
              userSelect: 'none', WebkitUserDrag: 'none',
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

      <div style={{
        position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.3)', fontSize: 11, whiteSpace: 'nowrap', pointerEvents: 'none',
      }}>
        Esc or click outside to close
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export function DetectionResults({ submission, onBack, onSendToSupervisor, currentUser, onViewValidation }) {
  const [selectedSide, setSelectedSide] = useState('front');
  const [imageSizes, setImageSizes] = useState({});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSide, setLightboxSide] = useState('front');

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const openLightbox = (side) => { setLightboxSide(side); setLightboxOpen(true); };
  const closeLightbox = () => setLightboxOpen(false);

  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
  const normalizeFaultType = (box) => String(box?.faultType || box?.class || box?.label || 'Unknown').trim();
  const isFeederPillar = (f) => String(f || '').trim().toLowerCase() === 'feeder pillar';

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

  const allFaults = submission.detectionResults
    ?.flatMap(r => (r.boundingBoxes ?? []).map(b => normalizeFaultType(b)))
    .filter((v, i, a) => a.indexOf(v) === i) || [];
  const filteredFaults = allFaults.filter(f => !isFeederPillar(f));

  const formatDateOnly = (ds) => {
    if (!ds) return 'N/A';
    const d = new Date(ds);
    return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
  };

  const getRiskColor = (risk) => ({
    Critical: 'bg-red-100 text-red-700 border-red-300',
    High: 'bg-orange-100 text-orange-700 border-orange-300',
    Medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    Low: 'bg-blue-100 text-blue-700 border-blue-300',
  }[risk] || 'bg-gray-100 text-gray-700 border-gray-300');

  const getBoundingBoxColor = (faultType) => ({
    'rust': 'rgb(239, 68, 68)',
    'Vandalisme': 'rgb(234, 179, 8)',
    'slanted': 'rgb(239, 68, 68)',
    'unlocked': 'rgb(168, 85, 247)',
    'feeder pillar': 'rgb(16, 185, 129)',
  }[faultType] || 'rgb(107, 114, 128)');

  const lightboxResult = submission.detectionResults?.find(r => r.side === lightboxSide);
  const lightboxBoxes = (lightboxResult?.boundingBoxes ?? []).map(b => normalizeBox(b, imageSizes[lightboxSide]));

  return (
    <div className="space-y-6">
      <Lightbox
        open={lightboxOpen}
        onClose={closeLightbox}
        imageUrl={lightboxResult?.imageUrl}
        label={`${lightboxSide.toUpperCase()} — ${submission.pillarId}`}
        boxes={lightboxBoxes}
        getBoundingBoxColor={getBoundingBoxColor}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Button variant="outline" onClick={onBack} className="h-9 w-9 p-0 sm:h-9 sm:w-auto sm:px-4 sm:py-2">
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight">AI Detection Results</h2>
            <p className="text-gray-600 mt-1 truncate">{submission.pillarId}</p>
          </div>
        </div>

        {currentUser?.role === 'supervisor' && !submission.validated && (
          <Button onClick={() => onViewValidation(submission.id)} size="lg" className="w-full sm:w-auto">
            <Send className="h-5 w-5 mr-2" /> View Validation
          </Button>
        )}
        {currentUser?.role === 'supervisor' && submission.validated && (
          <Button size="lg" className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white cursor-not-allowed" disabled>
            <Check className="h-5 w-5 mr-2" /> Validated by Supervisor
          </Button>
        )}
        {currentUser && !['admin', 'manager', 'supervisor'].includes(currentUser.role) && (
          <>
            {(submission.validationStatus === 'Approved' || submission.validationStatus === 'Rejected') ? (
              <Button size="lg" className="w-full sm:w-auto bg-green-600 text-white cursor-not-allowed" disabled>
                <Check className="h-5 w-5 mr-2" /> Validated by Supervisor
              </Button>
            ) : submission.sentToSupervisor ? (
              <Button size="lg" className="w-full sm:w-auto bg-blue-100 text-blue-700 cursor-not-allowed" disabled>
                <Send className="h-5 w-5 mr-2" /> Sent to Supervisor
              </Button>
            ) : (
              <Button onClick={() => onSendToSupervisor(submission.id)} size="lg" className="w-full sm:w-auto">
                <Send className="h-5 w-5 mr-2" /> Send to Supervisor
              </Button>
            )}
          </>
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Detection Analysis</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={selectedSide} onValueChange={setSelectedSide}>
                <TabsList className="grid w-full grid-cols-4">
                  {['front', 'right', 'back', 'left'].map(s => (
                    <TabsTrigger key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</TabsTrigger>
                  ))}
                </TabsList>

                {['front', 'right', 'back', 'left'].map((side) => {
                  const sideResult = submission.detectionResults?.find(r => r.side === side);
                  const sideBoxes = (sideResult?.boundingBoxes ?? []).map(box => normalizeBox(box, imageSizes[side]));
                  const sideFaultBoxes = sideBoxes.filter(box => !isFeederPillar(box.faultType));

                  const consolidatedFaults = sideFaultBoxes.reduce((acc, box) => {
                    const key = box.faultType.toLowerCase();
                    if (acc[key]) {
                      acc[key].count += 1;
                      acc[key].totalConfidence += box.confidence;
                    } else {
                      acc[key] = { ...box, count: 1, totalConfidence: box.confidence };
                    }
                    return acc;
                  }, {});
                  const faultList = Object.values(consolidatedFaults);

                  return (
                    <TabsContent key={side} value={side} className="space-y-4">
                      {sideResult ? (
                        <div>
                          <div
                            className="relative inline-block w-full group cursor-pointer"
                            onClick={() => openLightbox(side)}
                            title="Click to view fullscreen"
                          >
                            <img
                              src={sideResult.imageUrl}
                              alt={`${side} side`}
                              className="w-full rounded-lg border transition-[filter] duration-200 group-hover:brightness-90"
                              onLoad={(e) =>
                                setImageSizes(prev => ({
                                  ...prev,
                                  [side]: { width: e.target.naturalWidth, height: e.target.naturalHeight },
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
                                    strokeWidth="3" strokeDasharray="5,5" opacity="0.9"
                                  />
                                  <text
                                    x={`${box.x + 1}%`} y={`${box.y + 2}%`}
                                    fill={getBoundingBoxColor(box.faultType)}
                                    fontSize="14" fontWeight="bold"
                                    style={{ filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.8))' }}
                                  >
                                    {box.faultType} ({Math.round(box.confidence * 100)}%)
                                  </text>
                                </g>
                              ))}
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none rounded-lg">
                              <div className="bg-black/60 text-white text-sm font-medium px-3 py-2 rounded-full backdrop-blur-sm">
                                View fullscreen
                              </div>
                            </div>
                          </div>

                          {faultList.length > 0 ? (
                            <div className="mt-4 space-y-2">
                              <h4 className="font-semibold text-sm">Detected Faults:</h4>
                              {faultList.map((fault, index) => {
                                const avgConfidence = fault.totalConfidence / fault.count;
                                return (
                                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                      <div className="w-4 h-4 rounded" style={{ backgroundColor: getBoundingBoxColor(fault.faultType) }} />
                                      <span className="font-medium">{capitalize(fault.faultType)}</span>
                                      {fault.count > 1 && (
                                        <span className="text-xs font-semibold text-white bg-orange-500 rounded-full px-2 py-0.5">
                                          ×{fault.count}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm text-gray-600">Confidence: {Math.round(avgConfidence * 100)}%</span>
                                      <div className="w-24 bg-gray-200 rounded-full h-2">
                                        <div className="h-2 rounded-full" style={{ width: `${avgConfidence * 100}%`, backgroundColor: getBoundingBoxColor(fault.faultType) }} />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="mt-4 p-6 bg-green-50 rounded-lg text-center">
                              <p className="text-green-700 font-medium">No faults detected on this side</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-6 bg-gray-50 rounded-lg text-center">
                          <p className="text-gray-500">No image or detection result available for this side.</p>
                        </div>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Overall Assessment</CardTitle></CardHeader>
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
                  {filteredFaults.length > 0 ? filteredFaults.map((fault, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-600" />
                      <span className="text-sm">{capitalize(fault)}</span>
                    </div>
                  )) : (
                    <p className="text-gray-500 text-sm">No non-feeder pillar faults detected.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pillar Information</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><span className="text-gray-600">Pillar ID:</span><p className="font-medium">{submission.pillarId}</p></div>
              <div><span className="text-gray-600">Address:</span><p className="font-medium">{submission.address}</p></div>
              <div>
                <span className="text-gray-600">Coordinates:</span>
                <p className="font-medium">{submission.coordinates.lat.toFixed(6)}, {submission.coordinates.lng.toFixed(6)}</p>
              </div>
              <div className="pt-2 border-t">
                <span className="text-gray-600">Submitted By:</span>
                <p className="font-medium">{submission.submittedBy}</p>
              </div>
              <div><span className="text-gray-600">Submitted On:</span><p className="font-medium">{formatDateOnly(submission.submittedAt)}</p></div>
              <div>
                <span className="text-gray-600">Due Date:</span>
                <div className={`mt-1 flex items-center justify-between rounded-lg border px-3 py-2 ${submission.dueDate ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                  <span className={`text-sm font-semibold ${submission.dueDate ? 'text-red-900' : 'text-gray-700'}`}>
                    {formatDateOnly(submission.dueDate)}
                  </span>
                  {submission.dueDate && <Badge className="bg-red-600 text-white hover:bg-red-600">Due</Badge>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}