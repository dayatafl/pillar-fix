// Mock AI detection function
export const simulateAIDetection = (submission) => {
  const faultTypes = [
    'Physical Damage',
    'Broken Panel',
    'Corrosion',
    'Exposed Wiring',
    'Vandalism',
    'Obstruction',
    'Loose Connection',
    'Water Ingress',
  ];

  return submission.images.map((image) => {
    const numFaults = Math.floor(Math.random() * 3);
    const boundingBoxes = [];

    for (let i = 0; i < numFaults; i++) {
      boundingBoxes.push({
        x: Math.random() * 60 + 10,
        y: Math.random() * 60 + 10,
        width: Math.random() * 20 + 10,
        height: Math.random() * 20 + 10,
        faultType: faultTypes[Math.floor(Math.random() * faultTypes.length)],
        confidence: Math.random() * 0.3 + 0.7,
      });
    }

    return {
      imageUrl: image.imageUrl,
      side: image.side,
      boundingBoxes,
      overallRisk: boundingBoxes.some(b => b.confidence > 0.9) ? 'High' : 
                   boundingBoxes.length > 1 ? 'Medium' : 'Low',
    };
  });
};

export const mockAuditTasks = [
  {
    id: '1',
    pillarId: 'FP-2026-201',
    location: 'KLCC Main Junction',
    address: 'Jalan Ampang, 50088 Kuala Lumpur, Malaysia',
    locality: 'Kuala Lumpur City Centre',
    coordinates: { lat: 3.1579, lng: 101.7123 },
    assignedTo: 'Ahmad Rahman',
    status: 'Pending',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    pillarId: 'FP-2026-202',
    location: 'Bukit Bintang Crossing',
    address: 'Jalan Bukit Bintang, 55100 Kuala Lumpur, Malaysia',
    locality: 'Bukit Bintang',
    coordinates: { lat: 3.1466, lng: 101.7101 },
    assignedTo: 'Ahmad Rahman',
    status: 'Pending',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    pillarId: 'FP-2026-203',
    location: 'Mid Valley Central Mall',
    address: 'Lingkaran Syed Putra, 59200 Kuala Lumpur, Malaysia',
    locality: 'Mid Valley / Bangsar South',
    coordinates: { lat: 3.1185, lng: 101.6765 },
    assignedTo: 'Ahmad Rahman',
    status: 'Pending',
    dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    pillarId: 'FP-2026-204',
    location: 'Sunway Pyramid Main Entrance',
    address: '3, Jalan PJS 11/15, Bandar Sunway, 47500 Selangor, Malaysia',
    locality: 'Bandar Sunway',
    coordinates: { lat: 3.0738, lng: 101.6071 },
    assignedTo: 'Ahmad Rahman',
    status: 'Pending',
    dueDate: new Date(Date.now() + 86400000 * 4).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '5',
    pillarId: 'FP-2026-205',
    location: 'Petronas Twin Towers',
    address: 'Jalan Ampang, 50088 Kuala Lumpur, Malaysia',
    locality: 'Kuala Lumpur City Centre',
    coordinates: { lat: 3.1577, lng: 101.7118 },
    assignedTo: 'Ahmad Rahman',
    status: 'Pending',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    createdAt: new Date().toISOString(),
  }
];


export const createMockMaintenanceItem = (submission, approvalData) => {
  return {
    id: Date.now().toString(),
    pillarId: submission.pillarId,
    taskId: submission.taskId,
    location: submission.location,
    address: submission.address,
    coordinates: submission.coordinates,
    detectionId: submission.id,
    faults: submission.detectionResults?.flatMap(r =>
      (r.boundingBoxes ?? [])
        .map(b => String(b.faultType || b.class || b.label || '').trim())
        .filter(f => f && !/feeder pillar/i.test(f))
    ) || [],
    severity: approvalData.severity,
    priority: approvalData.priority,
    status: 'Pending',
    approvedBy: 'Supervisor Admin',
    approvedAt: new Date().toISOString(),
    estimatedCost: approvalData.estimatedCost,
    workLogs: [],
    previousDetections: submission.detectionResults || [],
  };
};

export const mockUsers = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@tnb.com',
    username: 'admin',
    employeeId: 'EMP001',
    role: 'admin',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 365).toISOString(),
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'manager@tnb.com',
    username: 'manager',
    employeeId: 'EMP002',
    role: 'manager',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 300).toISOString(),
  },
  {
    id: '3',
    name: 'John Smith',
    email: 'supervisor@tnb.com',
    username: 'supervisor',
    employeeId: 'EMP003',
    role: 'supervisor',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 200).toISOString(),
  },
  {
    id: '4',
    name: 'Ahmad Rahman',
    email: 'tech@tnb.com',
    username: 'technician',
    employeeId: 'EMP004',
    role: 'technician',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 100).toISOString(),
  },
  {
    id: '5',
    name: 'Maria Garcia',
    email: 'maria.garcia@tnb.com',
    username: 'mgarcia',
    employeeId: 'EMP005',
    role: 'technician',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 50).toISOString(),
  },
];
