import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, AlertTriangle, Send, Check, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';

// ─── Standalone Lightbox rendered via React portal directly onto document.body ──
// This ensures it is NEVER clipped by any parent's z-index / overflow / transform.
function Lightbox({ open, onClose, imageUrl, label, boxes, getBoundingBoxColor }) {
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
        zIndex: 2147483647, // max possible z-index
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
          {/* Zoom out */}
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

          {/* Zoom in */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(MAX_ZOOM, parseFloat((z + 0.5).toFixed(1)))); }}
            style={btnStyle(zoom >= MAX_ZOOM)}
            title="Zoom in (+)"
          >
            <ZoomIn size={15} />
          </button>

          {/* Close — plain DOM button with inline handler, zero React event delegation issues */}
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
          {/* Bounding box overlay */}
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
        Click image to zoom · Esc to close
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

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

// ─── Main component ────────────────────────────────────────────────────────────
export function DetectionResults({ submission, onBack, onSendToSupervisor, currentUser, onViewValidation }) {
  const [selectedSide, setSelectedSide] = useState('front');
  const [imageSizes, setImageSizes] = useState({});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSide, setLightboxSide] = useState('front');

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const openLightbox = (side) => { setLightboxSide(side); setLightboxOpen(true); };
  const closeLightbox = () => setLightboxOpen(false);

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

                  return (
                    <TabsContent key={side} value={side} className="space-y-4">
                      {sideResult ? (
                        <div>
                          <div
                            className="relative inline-block w-full group cursor-zoom-in"
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
                              <div className="flex items-center gap-2 bg-black/60 text-white text-sm font-medium px-3 py-2 rounded-full backdrop-blur-sm">
                                <ZoomIn className="h-4 w-4" /> View fullscreen
                              </div>
                            </div>
                          </div>

                          {sideFaultBoxes.length > 0 ? (
                            <div className="mt-4 space-y-2">
                              <h4 className="font-semibold text-sm">Detected Faults:</h4>
                              {sideFaultBoxes.map((box, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-4 h-4 rounded" style={{ backgroundColor: getBoundingBoxColor(box.faultType) }} />
                                    <span className="font-medium">{box.faultType}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm text-gray-600">Confidence: {Math.round(box.confidence * 100)}%</span>
                                    <div className="w-24 bg-gray-200 rounded-full h-2">
                                      <div className="h-2 rounded-full" style={{ width: `${box.confidence * 100}%`, backgroundColor: getBoundingBoxColor(box.faultType) }} />
                                    </div>
                                  </div>
                                </div>
                              ))}
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
                      <span className="text-sm">{fault}</span>
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