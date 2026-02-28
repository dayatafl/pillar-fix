import { useState, useEffect } from 'react';
import { MapPin, CheckCircle, Clock, AlertCircle, UserPlus, ClipboardCheck, Eye, CalendarDays, X, ChevronDownIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { Calendar } from '@/app/components/ui/calendar';
import { toast } from 'sonner';
import { format, isSameDay, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

export function TechnicianDashboard({ tasks, submissions, onStartAudit, onViewAIResult, currentUser, technicians, onUpdateTasks, onAssignTask }) {
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [selectedDate, setSelectedDate] = useState(undefined);
  const [dateRange, setDateRange] = useState({});
  const [isCalendarFilterOpen, setIsCalendarFilterOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    id: '',
    pillarId: '',
    location: '',
    address: '',
    locality: '',
    lat: '',
    lng: '',
    assignedTo:'',
    status: 'Pending',
    dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
    createdAt: new Date().toISOString(),
  });

  const handleCreateTask = () => {
    if (!newTask.id || !newTask.pillarId || !newTask.location || !newTask.address || !newTask.locality || !newTask.lat || !newTask.lng || !newTask.assignedTo) {
      toast.error('All fields are required');
      return;
    }

    if (tasks.some(u => u.pillarId === newTask.pillarId)) {
      toast.error('pillarId already exists');
      return;
    }

    const newtasks = {
      id: newTask.id,
      pillarId: newTask.pillarId,
      location: newTask.location,
      address: newTask.address,
      locality: newTask.locality,
      coordinates: { lat: parseFloat(newTask.lat), lng: parseFloat(newTask.lng) },
      assignedTo: newTask.assignedTo,
      status: 'Pending',
      dueDate: newTask.dueDate,
      createdAt: new Date().toISOString(),
    };

    onUpdateTasks([...tasks, newtasks]);
    toast.success(`Task ${newTask.pillarId} created successfully`);
    setIsCreateDialogOpen(false);
    setNewTask({
      id: '', pillarId: '', location: '', address: '', locality: '', 
      lat: '', lng: '', assignedTo:'', status: 'Pending',
      dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
      createdAt: new Date().toISOString(),
    });
  };

  const isSupervisorOrAbove = currentUser && ['supervisor', 'manager', 'admin'].includes(currentUser.role);
  const isTechnician = currentUser && currentUser.role === 'technician';

  let filteredTasks = isTechnician
    ? tasks.filter(task => task.assignedTo === currentUser?.name || !task.assignedTo)
    : tasks;

  if (selectedDate) {
    filteredTasks = filteredTasks.filter(task => 
      isSameDay(new Date(task.dueDate), selectedDate)
    );
  }

  const tasksAllTasks = isTechnician
    ? tasks.filter(task => task.assignedTo === currentUser?.name || !task.assignedTo)
    : tasks;

  const datesWithTasks = new Set(
    tasksAllTasks.map(task => format(new Date(task.dueDate), 'yyyy-MM-dd'))
  );

  const clearDateFilters = () => {
    setSelectedDate(undefined);
    setDateRange({});
  };

  const stats = {
    total: filteredTasks.length,
    pending: filteredTasks.filter(t => t.status === 'Pending').length,
    inProgress: filteredTasks.filter(t => t.status === 'In Progress').length,
    completed: filteredTasks.filter(t => t.status === 'Completed').length,
  };

  const groupedByLocality = filteredTasks.reduce((acc, task) => {
    if (!acc[task.locality]) acc[task.locality] = [];
    acc[task.locality].push(task);
    return acc;
  }, {});

  const handleAssignClick = (task) => {
    setSelectedTask(task);
    setSelectedTechnicianId('');
    setIsAssignDialogOpen(true);
  };

  const handleAssignConfirm = () => {
    const technician = technicians?.find(t => t.id === selectedTechnicianId);
    if (!technician) return;
    onAssignTask(selectedTask.id, technician.name);
    toast.success(`Task assigned to ${technician.name}`);
    setIsAssignDialogOpen(false);
  };

  {/* Key Metrics */}
  const statCards = [
    { title: 'Total Tasks', value: stats.total, icon: MapPin, color: 'text-blue-600' },
    { title: 'Pending', value: stats.pending, icon: Clock, color: 'text-yellow-600' },
    { title: 'In Progress', value: stats.inProgress, icon: AlertCircle, color: 'text-orange-600' },
    { title: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-green-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">
          {isTechnician ? 'My Audit Tasks' : 'Field Audit Tasks'}
        </h2>
        <p className="text-gray-600 mt-1">
          {isTechnician ? 'Tasks assigned to you' : 'Feeder pillar audit assignments by locality'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-gray-500 mt-1">&nbsp;</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters Row */}
      <div className="flex w-full justify-between items-center">
        <div 
          className="border rounded-md px-3 py-2 text-sm bg-white flex items-center justify-between w-full md:w-64 cursor-pointer shadow-sm"
          onClick={() => setIsCalendarFilterOpen(!isCalendarFilterOpen)}
        >
          <span className="flex items-center gap-2 font-semibold">
            <CalendarDays className="h-4 w-4" />
            Filter by Date
            {selectedDate && <Badge variant="secondary" className="text-[10px] h-4">Active</Badge>}
          </span>
          <div className="flex items-center gap-1">
            {selectedDate && (
              <Button variant="ghost" size="sm" className="h-6 px-1" onClick={(e) => { e.stopPropagation(); clearDateFilters(); }}>
                <X className="h-3 w-3" />
              </Button>
            )}
            <ChevronDownIcon className="h-4 w-4 opacity-50" />
          </div>
        </div>

        {isSupervisorOrAbove && (
          <Button onClick={() => setIsCreateDialogOpen(true)} className="flex gap-2">
            <ClipboardCheck className="h-4 w-4" /> Create Task
          </Button>
        )}
      </div>

      {isCalendarFilterOpen && (
        <div className="absolute z-50 bg-white shadow-xl border rounded-lg p-2 mt-[-10px]">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              setSelectedDate(date);
              setIsCalendarFilterOpen(false);
            }}
            modifiers={{ hasTask: (date) => datesWithTasks.has(format(date, 'yyyy-MM-dd')) }}
            modifiersStyles={{ hasTask: { fontWeight: 'bold', backgroundColor: '#3b82f6', color: 'white', borderRadius: '50%' } }}
          />
        </div>
      )}

      {/* Frameless Tasks by Locality */}
      <div className="space-y-8">
        {Object.entries(groupedByLocality).map(([locality, localityTasks]) => (
          <div key={locality} className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xl font-bold text-gray-800">{locality}</h3>
              <Badge variant="secondary" className="bg-gray-100">{localityTasks.length} pillars</Badge>
            </div>

            <div className="space-y-3">
              {localityTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-all">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="font-semibold">{task.pillarId}</h4>
                      <Badge variant={task.status === 'Completed' ? 'default' : 'outline'}>{task.status}</Badge>
                      {task.assignedTo && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                          <UserPlus className="h-3 w-3 mr-1" /> {task.assignedTo}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1 flex items-center gap-1"><MapPin className="h-5 w-5" /> {task.address}</p>
                    <p className="text-xs text-gray-500 mt-1">Due: {new Date(task.dueDate).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    {isSupervisorOrAbove && task.status !== 'Completed' && (
                      <Button onClick={() => handleAssignClick(task)} variant="outline" size="sm">Assign</Button>
                    )}
                    <Button onClick={() => onStartAudit(task.id)} disabled={task.status === 'Completed'} size="sm">
                      {task.status === 'Completed' ? 'Completed' : 'Start Audit'}
                    </Button>
                    {task.status === 'Completed' && (
                      <Button onClick={() => onViewAIResult(task.id)} variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" /> AI Result
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Assignment Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Task</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium">{selectedTask.pillarId}</p>
                <p className="text-xs text-gray-600 mt-1">{selectedTask.location}</p>
              </div>
              <Select value={selectedTechnicianId} onValueChange={setSelectedTechnicianId}>
                <SelectTrigger><SelectValue placeholder="Choose a technician..." /></SelectTrigger>
                <SelectContent>
                  {technicians?.filter(t => t.role === 'technician' && t.isActive).map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleAssignConfirm} disabled={!selectedTechnicianId}>Assign Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Create New Task</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <Input placeholder="Task ID" value={newTask.id} onChange={(e) => setNewTask({...newTask, id: e.target.value})} />
            <Input placeholder="Pillar ID (FP-2026-XXX)" value={newTask.pillarId} onChange={(e) => setNewTask({...newTask, pillarId: e.target.value})} />
            <Input placeholder="Location Name" value={newTask.location} onChange={(e) => setNewTask({...newTask, location: e.target.value})} />
            <Input placeholder="Full Address" value={newTask.address} onChange={(e) => setNewTask({...newTask, address: e.target.value})} />
            <Select value={newTask.locality} onValueChange={(v) => setNewTask({...newTask, locality: v})}>
              <SelectTrigger><SelectValue placeholder="Locality" /></SelectTrigger>
              <SelectContent>
                {[...new Set(tasks.map(t => t.locality))].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Lat" value={newTask.lat} onChange={(e) => setNewTask({...newTask, lat: e.target.value})} />
              <Input type="number" placeholder="Lng" value={newTask.lng} onChange={(e) => setNewTask({...newTask, lng: e.target.value})} />
            </div>
            <Select value={newTask.assignedTo} onValueChange={(v) => setNewTask({...newTask, assignedTo: v})}>
              <SelectTrigger><SelectValue placeholder="Assign Technician" /></SelectTrigger>
              <SelectContent>
                {technicians?.filter(t => t.role === 'technician').map(tech => <SelectItem key={tech.id} value={tech.name}>{tech.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter><Button onClick={handleCreateTask}>Create Task</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}