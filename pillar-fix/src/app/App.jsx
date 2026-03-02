import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ClipboardCheck, CheckSquare, Wrench, BarChart3, Menu, X, 
  Map, Users as UsersIcon, LogOut, ChevronDown, ShieldCheck, 
  HardHat, User, ClipboardList 
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Avatar, AvatarFallback } from '@/app/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/app/components/ui/dropdown-menu";
import { Toaster } from '@/app/components/ui/sonner';
import { TechnicianDashboard } from '@/app/components/TechnicianDashboard';
import { AuditForm } from '@/app/components/AuditForm';
import { DetectionResults } from '@/app/components/DetectionResults';
import { SupervisorValidation } from '@/app/components/SupervisorValidation';
import { SupervisorReview } from '@/app/components/SupervisorReview';
import { MaintenanceList } from '@/app/components/MaintenanceList';
import { MaintenanceDetail } from '@/app/components/MaintenanceDetail';
import { Analytics } from '@/app/components/Analytics';
import { Login } from '@/app/components/Login';
import { UserManagement } from '@/app/components/UserManagement';
import { EnhancedMapView } from '@/app/components/EnhancedMapView';
import { toast } from 'sonner';
import logo from './components/logo/FINAL.svg';
import api from "@/app/api";

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // App state
  const [currentView, setCurrentView] = useState('map');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Data management
  const [auditTasks, setAuditTasks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [maintenanceItems, setMaintenanceItems] = useState([]);
  const [users, setUsers] = useState([]);

  // Selected items
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [selectedMaintenanceId, setSelectedMaintenanceId] = useState(null);

  // Derived selections
  const selectedTask = auditTasks.find(t => t.id === selectedTaskId);
  const selectedSubmission = submissions.find(s => s.id === selectedSubmissionId);
  const selectedMaintenance = maintenanceItems.find(m => m.id === selectedMaintenanceId);

  const fetchData = useCallback(() => {
    if (!isAuthenticated) return;
    api.get("/tasks").then(({ data }) => setAuditTasks(data)).catch(console.error);
    api.get("/submissions").then(({ data }) => setSubmissions(data)).catch(console.error);
    api.get("/maintenance").then(({ data }) => setMaintenanceItems(data)).catch(console.error);
  }, [isAuthenticated]);

  const fetchMaintenance = () => {
    api.get("/maintenance").then(({ data }) => setMaintenanceItems(data)).catch(console.error);
  };

  // Initial load on login
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchData();
    api.get("/users").then(({ data }) => setUsers(data)).catch(console.error);
  }, [isAuthenticated]);

  // Poll for fresh data every 10 seconds on live-data views
  useEffect(() => {
    const pollingViews = ['supervisor-validation', 'tech-dashboard', 'supervisor-review'];
    if (!isAuthenticated || !pollingViews.includes(currentView)) return;
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated, currentView, fetchData]);

  // Auth handlers
  const handleLogin = (user, isSwitching = false) => {
    setCurrentUser(user);
    setIsAuthenticated(true);

    if (user.role === 'manager') setCurrentView('analytics');
    else if (user.role === 'admin') setCurrentView('user-management');
    else setCurrentView('map');

    if (!isSwitching) toast.success(`Welcome, ${user.name}!`);
    else toast.info(`Switched to ${user.name} (${user.role})`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    setCurrentView('map');
    toast.info('Logged out successfully');
  };

  // Task & Audit Handlers
  const handleStartAudit = (taskId) => {
    setSelectedTaskId(taskId);
    setAuditTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'In Progress' } : t));
    setCurrentView('audit-form');
    setMobileMenuOpen(false);
  };

  const handleViewAIResultFromTask = (taskId) => {
    const submission = submissions.find(s => s.taskId === taskId);
    if (submission) {
      setSelectedSubmissionId(submission.id);
      setCurrentView('detection-results');
    } else {
      toast.error('No results found');
    }
  };

  const handleSubmitAudit = (submission) => {
    setSubmissions(prev => {
      const exists = prev.find(s => s.taskId === submission.taskId);
      if (exists) {
        return prev.map(s => s.taskId === submission.taskId ? submission : s);
      }
      return [submission, ...prev];
    });
    setAuditTasks(prev => prev.map(t =>
      t.id === submission.taskId ? { ...t, status: 'Submitted' } : t
    ));
    setCurrentView('tech-dashboard');
  };

  const handleAssignTask = (taskId, technicianName) => {
    setAuditTasks(prev =>
      prev.map(task =>
        task.id === taskId ? { ...task, assignedTo: technicianName } : task
      )
    );
  };

  const handleSendToSupervisor = (submissionId) => {
    setSubmissions(prev => prev.map(s =>
      s.id === submissionId ? { ...s, detectionStatus: 'Completed' } : s
    ));
    fetchData(); // Refresh to get latest data for validation page
    setCurrentView('supervisor-validation');
  };

  const handleReviewSubmission = (submissionId) => {
    setSelectedSubmissionId(submissionId);
    setCurrentView('supervisor-review');
  };

  // Maintenance & Supervisor Handlers
  const handleApproveForMaintenance = (submissionId, approvalData) => {
    setSubmissions(prev => prev.map(s =>
      s.id === submissionId
        ? { ...s, validated: true, validationStatus: 'Approved', approvalData }
        : s
    ));
    const submission = submissions.find(s => s.id === submissionId);
    if (submission) {
      setAuditTasks(prev => prev.map(t =>
        t.id === submission.taskId ? { ...t, status: 'Validated' } : t
      ));
    }
    fetchMaintenance();
    setCurrentView('supervisor-validation');
  };

  const handleRejectSubmission = (submissionId, reason) => {
    setSubmissions(prev => prev.map(s =>
      s.id === submissionId
        ? { ...s, validated: true, validationStatus: 'Rejected', rejectionReason: reason }
        : s
    ));
    toast.info('Submission rejected');
    setCurrentView('supervisor-validation');
  };

  const handleViewMaintenanceDetail = (itemId) => {
    setSelectedMaintenanceId(itemId);
    setCurrentView('maintenance-detail');
  };

  const handleUpdateMaintenanceStatus = (itemId, newStatus) => {
    setMaintenanceItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, status: newStatus } : item
    ));
  };

  const handleUpdateWorkLog = (itemId, newLogEntry) => {
    setMaintenanceItems(prev => prev.map(item =>
      item.id === itemId
        ? { ...item, workLogs: [...(item.workLogs || []), newLogEntry] }
        : item
    ));
  };

  const handleSubmitCompletion = (itemId) => {
    setMaintenanceItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, status: 'Completed' } : item
    ));
    setCurrentView('maintenance-list');
  };

  // Menu Helper
  const getMenuItems = () => {
    const baseItems = [
      { id: 'analytics', label: 'Analytics', icon: BarChart3, view: 'analytics', roles: ['manager', 'admin'] },
      { id: 'map', label: 'Map', icon: Map, view: 'map', roles: ['technician', 'supervisor', 'manager', 'admin'] },
      { id: 'tech-dashboard', label: 'Audit Tasks', icon: ClipboardCheck, view: 'tech-dashboard', roles: ['technician', 'supervisor', 'manager', 'admin'] },
      { id: 'supervisor-validation', label: 'Validation', icon: CheckSquare, view: 'supervisor-validation', roles: ['supervisor', 'manager', 'admin'] },
      { id: 'maintenance-list', label: 'Maintenance', icon: Wrench, view: 'maintenance-list', roles: ['technician', 'supervisor', 'manager', 'admin'] },
      { id: 'user-management', label: 'Users', icon: UsersIcon, view: 'user-management', roles: ['admin'] },
    ];
    return baseItems.filter(item => currentUser && item.roles.includes(currentUser.role));
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <ShieldCheck className="mr-2 h-4 w-4 text-red-600" />;
      case 'manager': return <User className="mr-2 h-4 w-4 text-blue-600" />;
      case 'supervisor': return <ClipboardList className="mr-2 h-4 w-4 text-purple-600" />;
      case 'technician': return <HardHat className="mr-2 h-4 w-4 text-orange-600" />;
      default: return <User className="mr-2 h-4 w-4" />;
    }
  };

  // AUTH GUARD
  if (!isAuthenticated) return <><Login onLogin={(u) => handleLogin(u, false)} /><Toaster /></>;

  const menuItems = getMenuItems();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src={logo} className='w-8' alt="Logo" />
              <div>
                <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">Pillar</span>
                <span className="text-3xl font-bold bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent">Fix</span>
              </div>
            </div>

            <nav className="hidden lg:flex items-center gap-2">
              {menuItems.map((item) => (
                <Button
                  key={item.id}
                  variant={currentView === item.view ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCurrentView(item.view)}
                >
                  <item.icon className="h-4 w-4 mr-2" /> {item.label}
                </Button>
              ))}

              <div className="flex items-center gap-2 ml-4 pl-4 border-l">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-3 h-auto py-1 px-2 hover:bg-gray-100">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">
                          {currentUser.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="hidden xl:flex flex-col items-start text-left">
                        <p className="text-sm font-medium leading-none">{currentUser.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize mt-1">{currentUser.role}</p>
                      </div>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-47">
                    <DropdownMenuLabel>Demo Role</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {users
                      .map((user) => (
                        <DropdownMenuItem
                          key={user.id}
                          onClick={() => handleLogin(user, true)}
                          className={`cursor-pointer ${currentUser.id === user.id ? 'bg-blue-50' : ''}`}
                        >
                          {getRoleIcon(user.role)}
                          <div className="flex flex-col">
                            <span className="text-sm">{user.name}</span>
                            <span className="text-[10px] text-gray-500 capitalize">{user.role}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" /> Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </nav>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2">
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'tech-dashboard' && (
          <TechnicianDashboard
            tasks={auditTasks}
            submissions={submissions}
            onStartAudit={handleStartAudit}
            onViewAIResult={handleViewAIResultFromTask}
            currentUser={currentUser}
            technicians={users}
            onUpdateTasks={setAuditTasks}
            onAssignTask={handleAssignTask}
          />
        )}

        {currentView === 'audit-form' && selectedTask && (
          <AuditForm
            task={selectedTask}
            onBack={() => setCurrentView('tech-dashboard')}
            onSubmit={handleSubmitAudit}
          />
        )}

        {currentView === 'detection-results' && selectedSubmission && (
          <DetectionResults
            submission={selectedSubmission}
            currentUser={currentUser}
            onBack={() => setCurrentView('tech-dashboard')}
            onSendToSupervisor={handleSendToSupervisor}
            onViewValidation={handleReviewSubmission}
          />
        )}

        {currentView === 'supervisor-validation' && (
          <SupervisorValidation
            submissions={submissions.filter(s => s.detectionStatus === 'Completed')}
            onReview={handleReviewSubmission}
          />
        )}

        {currentView === 'supervisor-review' && selectedSubmission && (
          <SupervisorReview
            submission={selectedSubmission}
            currentUser={currentUser}
            onBack={() => setCurrentView('supervisor-validation')}
            onApprove={handleApproveForMaintenance}
            onReject={handleRejectSubmission}
          />
        )}

        {currentView === 'maintenance-list' && (
          <MaintenanceList
            items={maintenanceItems}
            currentUser={currentUser}
            onViewDetails={handleViewMaintenanceDetail}
            onUpdateStatus={handleUpdateMaintenanceStatus}
          />
        )}

        {currentView === 'maintenance-detail' && selectedMaintenance && (
          <MaintenanceDetail
            item={selectedMaintenance}
            currentUser={currentUser}
            onBack={() => setCurrentView('maintenance-list')}
            onUpdateWorkLog={handleUpdateWorkLog}
            onSubmitCompletion={handleSubmitCompletion}
            onUpdateStatus={handleUpdateMaintenanceStatus}
          />
        )}

        {currentView === 'analytics' && (
          <Analytics maintenanceItems={maintenanceItems} />
        )}

        {currentView === 'user-management' && currentUser && (
          <UserManagement
            currentUser={currentUser}
            users={users}
            onUpdateUsers={setUsers}
          />
        )}

        {currentView === 'map' && (
          <EnhancedMapView
            maintenanceItems={maintenanceItems}
            auditTasks={auditTasks}
            submissions={submissions}
            onPillarSelect={(pillarId) => {
              const item = maintenanceItems.find(m => m.pillarId === pillarId);
              if (item) handleViewMaintenanceDetail(item.id);
            }}
          />
        )}
      </main>
      <Toaster />
    </div>
  );
}