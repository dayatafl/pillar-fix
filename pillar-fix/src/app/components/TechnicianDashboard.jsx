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
import { format, isSameDay } from 'date-fns';
import api from "@/app/api";

export function TechnicianDashboard({ tasks, submissions, onStartAudit, onViewAIResult, currentUser, technicians, onUpdateTasks, onAssignTask }) {
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [selectedDate, setSelectedDate] = useState(undefined);
  const [dateRange, setDateRange] = useState({});
  const [isCalendarFilterOpen, setIsCalendarFilterOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    pillarId: '',
    dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
  });

  const handleCreateTask = async () => {
    if (!newTask.pillarId || !newTask.dueDate) {
      toast.error('Pillar ID and due date are required');
      return;
    }

    try {
      await api.post('/tasks', {
        pillar_id: newTask.pillarId,
        due_date: newTask.dueDate,
        created_by: currentUser?.employeeId,
      });

      onUpdateTasks();

      toast.success(`Task for ${newTask.pillarId} created successfully`);
      setIsCreateDialogOpen(false);
      setNewTask({
        pillarId: '',
        dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
      });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create task');
    }
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

  const isTaskDone = (status) => ['Completed', 'Submitted', 'Validated'].includes(status);
  const isTaskInProgress = (status) => status === 'In Progress';

  const stats = {
    total: filteredTasks.length,
    pending: filteredTasks.filter(t => t.status === 'Pending').length,
    inProgress: filteredTasks.filter(t => isTaskInProgress(t.status)).length,
    completed: filteredTasks.filter(t => isTaskDone(t.status)).length,
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

  const handleAssignConfirm = async () => {
    if (!selectedTask || !selectedTechnicianId) return;
    try {
      await api.put(`/tasks/${selectedTask.id}/reassign`, {
        new_employee_id: selectedTechnicianId,
      });
      const technician = technicians.find(t => t.employeeId === selectedTechnicianId);
      onAssignTask(selectedTask.id, technician.name);
      toast.success(`Task assigned to ${technician.name}`);
      setIsAssignDialogOpen(false);
      setSelectedTechnicianId("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Reassign failed");
    }
  };

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

      {/* Key Metrics */}
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

      {/* Tasks by Locality */}
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
                      <Badge variant={isTaskDone(task.status) ? 'default' : 'outline'}>{task.status}</Badge>
                      {task.assignedTo && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                          <UserPlus className="h-3 w-3 mr-1" />
                          {task.assignedTo}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {task.address}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Due: {new Date(task.dueDate).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {isSupervisorOrAbove && onAssignTask && !isTaskDone(task.status) && (
                      <Button onClick={() => handleAssignClick(task)} variant="outline" size="sm">
                        {task.assignedTo ? 'Reassign' : 'Assign'}
                      </Button>
                    )}

                    <Button
                      onClick={() => onStartAudit(task.id)}
                      disabled={isTaskDone(task.status)}
                      size="sm"
                    >
                      {isTaskDone(task.status)
                        ? task.status
                        : task.status === 'In Progress'
                        ? 'Continue'
                        : 'Start Audit'}
                    </Button>

                    {isTaskDone(task.status) && (
                      <Button onClick={() => onViewAIResult(task.id)} variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        View AI Result
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
              <div>
                <Label htmlFor="technician">Select Technician</Label>
                <Select value={selectedTechnicianId} onValueChange={setSelectedTechnicianId}>
                  <SelectTrigger id="technician">
                    <SelectValue placeholder="Choose a technician..." />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians?.filter(t => t.role === 'technician' && t.isActive).map((tech) => (
                      <SelectItem key={tech.id} value={tech.employeeId}>
                        {tech.name} ({tech.employeeId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleAssignConfirm} disabled={!selectedTechnicianId}>Assign Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              The technician will be auto-assigned based on the pillar's locality.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="pillarId">Pillar ID</Label>
              <Input
                id="pillarId"
                value={newTask.pillarId}
                onChange={(e) => setNewTask({ ...newTask, pillarId: e.target.value })}
                placeholder="FP-2026-999"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="datetime-local"
                value={newTask.dueDate.slice(0, 16)}
                onChange={(e) => setNewTask({ ...newTask, dueDate: new Date(e.target.value).toISOString() })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateTask}>Create Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}