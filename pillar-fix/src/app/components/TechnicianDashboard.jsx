import { useState, useEffect } from 'react';
import { MapPin, CheckCircle, Clock, AlertCircle, UserRound, ClipboardPen, Eye, CalendarDays, ChevronDownIcon, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { Calendar } from '@/app/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/app/components/ui/command';
import { toast } from 'sonner';
import { format, isSameDay } from 'date-fns';
import api from "@/app/api";
import { getApiErrorMessage } from '@/app/apiError';

export function TechnicianDashboard({ tasks, submissions, onStartAudit, onViewAIResult, currentUser, technicians, onUpdateTasks, onAssignTask }) {
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [selectedDate, setSelectedDate] = useState(undefined);
  const [isCalendarFilterOpen, setIsCalendarFilterOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDueDateOpen, setIsDueDateOpen] = useState(false);
  const [availablePillars, setAvailablePillars] = useState([]);
  const [isLoadingPillars, setIsLoadingPillars] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isPillarOpen, setIsPillarOpen] = useState(false);
  const [pillarSearch, setPillarSearch] = useState('');

  const toDueDateIso = (date) => {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
  };
  const [newTask, setNewTask] = useState({
    pillarId: '',
    dueDate: toDueDateIso(new Date(Date.now() + 86400000 * 5)),
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!isCreateDialogOpen) return;

    let cancelled = false;
    setIsLoadingPillars(true);

    api.get('/pillars')
      .then(({ data }) => {
        if (cancelled) return;
        setAvailablePillars(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(getApiErrorMessage(err, 'Failed to load pillar list'));
        setAvailablePillars([]);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingPillars(false);
      });

    return () => { cancelled = true; };
  }, [isCreateDialogOpen]);

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
      setIsDueDateOpen(false);
      setIsPillarOpen(false);
      setPillarSearch('');
      setNewTask({
        pillarId: '',
        dueDate: toDueDateIso(new Date(Date.now() + 86400000 * 5)),
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to create task'));
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

  if (statusFilter !== 'all') {
    filteredTasks = filteredTasks.filter(task => task.status === statusFilter);
  }

  const tasksAllTasks = isTechnician
    ? tasks.filter(task => task.assignedTo === currentUser?.name || !task.assignedTo)
    : tasks;

  const datesWithTasks = new Set(
    tasksAllTasks.map(task => format(new Date(task.dueDate), 'yyyy-MM-dd'))
  );

  const isTaskDone = (status) => ['Completed', 'Submitted', 'Validated'].includes(status);
  const isTaskInProgress = (status) => status === 'In Progress';

  const stats = {
        total: tasksAllTasks.length,
        pending: tasksAllTasks.filter(t => t.status === 'Pending').length,
        inProgress: tasksAllTasks.filter(t => isTaskInProgress(t.status)).length,
        completed: tasksAllTasks.filter(t => isTaskDone(t.status)).length,
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
      toast.error(getApiErrorMessage(err, "Reassign failed"));
    }
  };

  const statCards = [
    { title: 'Total Tasks', value: stats.total, icon: MapPin, color: 'text-blue-600' },
    { title: 'Pending', value: stats.pending, icon: Clock, color: 'text-yellow-600' },
    { title: 'In Progress', value: stats.inProgress, icon: AlertCircle, color: 'text-orange-600' },
    { title: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-green-600' },
  ];

  const filteredPillars = availablePillars.filter(p =>
    p.pillarId.toLowerCase().includes(pillarSearch.toLowerCase()) ||
    (p.locality ?? '').toLowerCase().includes(pillarSearch.toLowerCase()) ||
    (p.address ?? '').toLowerCase().includes(pillarSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold">
              {isTechnician ? 'My Audit Tasks' : 'Field Audit Tasks'}
            </h2>
            <p className="text-gray-600 mt-1">
              {isTechnician ? 'Tasks assigned to you' : 'Feeder pillar audit assignments by locality'}
            </p>
          </div>
        </div>
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
      {isSupervisorOrAbove && (
        <Button onClick={() => setIsCreateDialogOpen(true)} className="w-full sm:hidden gap-2">
          <ClipboardPen className="h-4 w-4" /> Create Task
        </Button>
      )}
      <div className="flex w-full justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="relative w-[13.75rem] md:w-60">
            <button
              onClick={() => setIsCalendarFilterOpen(!isCalendarFilterOpen)}
              className="w-full bg-white border rounded-md px-3 py-2 text-sm shadow-sm cursor-pointer font-semibold flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span>{selectedDate ? format(selectedDate, 'dd MMM yyyy') : 'Filter by Date'}</span>
                {selectedDate && <Badge variant="secondary" className="text-[10px] h-4">Active</Badge>}
              </div>
              <div className="flex items-center">
                <ChevronDownIcon className="h-4 w-4 opacity-50" />
              </div>
            </button>

            {isCalendarFilterOpen && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border bg-white shadow-xl">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  className="w-full"
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setIsCalendarFilterOpen(false);
                  }}
                  modifiers={{ hasTask: (date) => datesWithTasks.has(format(date, 'yyyy-MM-dd')) }}
                  modifiersStyles={{ hasTask: { fontWeight: 'bold', backgroundColor: '#3b82f6', color: 'white', borderRadius: '50%' } }}
                />
              </div>
            )}
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
            <SelectTrigger className="w-40 md:w-60 bg-white border rounded-md px-3 py-2 text-sm shadow-sm cursor-pointer ring-offset-white focus:ring-0 focus:ring-offset-0 font-semibold">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 shrink-0" />
                <SelectValue placeholder="All Status" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Submitted">Submitted</SelectItem>
              <SelectItem value="Validated">Validated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isSupervisorOrAbove && (
          <Button onClick={() => setIsCreateDialogOpen(true)} className="hidden sm:flex gap-2">
            <ClipboardPen className="h-4 w-4" /> Create Task
          </Button>
        )}
      </div>

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
                <div key={task.id}>
                  <div className="md:hidden p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-all space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-semibold text-sm break-all">{task.pillarId}</h4>
                      <Badge variant={isTaskDone(task.status) ? 'default' : 'outline'}>{task.status}</Badge>
                    </div>

                    <p className="text-sm text-gray-600 leading-relaxed">{task.address}</p>

                    <div className="flex flex-wrap items-center gap-2">
                      {task.assignedTo && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                          <UserRound className="h-3 w-3 mr-1" />
                          {task.assignedTo}
                        </Badge>
                      )}
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        Due: {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      {isSupervisorOrAbove && onAssignTask && !isTaskDone(task.status) && (
                        <Button onClick={() => handleAssignClick(task)} variant="outline" size="sm" className="flex-1">
                          {task.assignedTo ? 'Reassign' : 'Assign'}
                        </Button>
                      )}

                      {isTaskDone(task.status) ? (
                        <Button onClick={() => onViewAIResult(task.id)} variant="outline" size="sm" className="flex-1">
                          <Eye className="h-4 w-4 mr-1" />
                          View AI Result
                        </Button>
                      ) : (
                        <Button onClick={() => onStartAudit(task.id)} size="sm" className="flex-1">
                          {task.status === 'In Progress' ? 'Continue' : 'Start Audit'}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="hidden md:flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-all">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h4 className="font-semibold">{task.pillarId}</h4>
                        <Badge variant={isTaskDone(task.status) ? 'default' : 'outline'}>{task.status}</Badge>
                        {task.assignedTo && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                            <UserRound className="h-3 w-3 mr-1" />
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

                      {isTaskDone(task.status) ? (
                        <Button onClick={() => onViewAIResult(task.id)} variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View AI Result
                        </Button>
                      ) : (
                        <Button onClick={() => onStartAudit(task.id)} size="sm">
                          {task.status === 'In Progress' ? 'Continue' : 'Start Audit'}
                        </Button>
                      )}
                    </div>
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
                <Label htmlFor="technician" className="block mb-2">Select Technician</Label>
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
      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            setIsPillarOpen(false);
            setPillarSearch('');
            setIsDueDateOpen(false);
            setNewTask((prev) => ({ ...prev, pillarId: '' }));
          }
        }}
      >
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

              <Popover open={isPillarOpen} onOpenChange={setIsPillarOpen}>
                <PopoverTrigger asChild>
                  <button
                    id="pillarId"
                    type="button"
                    className="border-input flex h-9 w-full items-center justify-between rounded-md border bg-input-background px-3 py-1 text-sm transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className={newTask.pillarId ? '' : 'text-muted-foreground'}>
                      {newTask.pillarId || (isLoadingPillars ? 'Loading pillars…' : 'Select a pillar…')}
                    </span>
                    <ChevronDownIcon className="h-4 w-4 opacity-50 shrink-0" />
                  </button>
                </PopoverTrigger>

                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search by ID, locality, or address…"
                      value={pillarSearch}
                      onValueChange={setPillarSearch}
                    />
                    <CommandList
                      className="max-h-[240px] overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]"
                      onWheel={(e) => e.stopPropagation()}
                      onTouchMove={(e) => e.stopPropagation()}
                    >
                      {isLoadingPillars ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">Loading pillars…</div>
                      ) : (
                        <>
                          <CommandEmpty>No pillars found.</CommandEmpty>
                          <CommandGroup>
                            {filteredPillars.map(p => (
                              <CommandItem
                                key={p.pillarId}
                                value={p.pillarId}
                                onSelect={(val) => {
                                  setNewTask({ ...newTask, pillarId: val });
                                  setPillarSearch('');
                                  setIsPillarOpen(false);
                                }}
                                className="py-2"
                              >
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-baseline gap-1.5 min-w-0">
                                    <span className="text-sm font-medium truncate">{p.pillarId}</span>
                                  </div>
                                  {p.address ? (
                                    <span className="text-[11px] leading-snug text-muted-foreground truncate">{p.address}</span>
                                  ) : null}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Popover open={isDueDateOpen} onOpenChange={setIsDueDateOpen}>

                <PopoverTrigger asChild>
                  <button
                    id="dueDate"
                    type="button"
                    className="border-input flex h-9 w-full min-w-0 items-center justify-between rounded-md border bg-input-background px-3 py-1 text-base transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
                  >
                    <span className={newTask.dueDate ? '' : 'text-muted-foreground'}>
                      {newTask.dueDate ? format(new Date(newTask.dueDate), 'dd MMM yyyy') : 'Select date'}
                    </span>
                    <CalendarDays className="h-4 w-4 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
                  <Calendar
                    mode="single"
                    selected={newTask.dueDate ? new Date(newTask.dueDate) : undefined}
                    className="w-full"
                    onSelect={(date) => {
                      if (!date) return;
                      setNewTask({ ...newTask, dueDate: toDueDateIso(date) });
                      setIsDueDateOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
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
