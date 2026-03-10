import { Calendar, Wrench, Eye, Play, CheckCircle, Filter, User, UserRound } from 'lucide-react';
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
import { useState } from 'react';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';
import { AlertCircle } from 'lucide-react';
import { MapPin } from 'lucide-react';
import { Banknote } from 'lucide-react';

export function MaintenanceList({ items, currentUser, onViewDetails, onUpdateStatus }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Technicians only see items assigned to them
  const visibleItems = currentUser?.role === 'technician'
    ? items.filter(item => item.assignedTo === currentUser.name)
    : items;

  const filteredItems = visibleItems.filter(item => {
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
    return matchesStatus && matchesPriority;
  });

  const stats = {
    total: visibleItems.length,
    pending: visibleItems.filter(i => i.status === 'Pending' || i.status === 'Approved').length,
    inProgress: visibleItems.filter(i => i.status === 'In Progress').length,
    completed: visibleItems.filter(i => i.status === 'Completed').length,
    totalCost: visibleItems.reduce((sum, i) => sum + i.estimatedCost, 0),
  };

  const getStatusBadge = (status) => {
    const colors = {
      'Pending': 'bg-yellow-100 text-yellow-700',
      'Approved': 'bg-green-100 text-green-700',
      'Scheduled': 'bg-blue-100 text-blue-700',
      'In Progress': 'bg-purple-100 text-purple-700',
      'Completed': 'bg-green-100 text-green-700',
      'Verified': 'bg-green-100 text-green-700',
    };
    return <Badge className={colors[status]}>{status}</Badge>;
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      'Urgent': 'bg-red-100 text-red-700',
      'High': 'bg-orange-100 text-orange-700',
      'Medium': 'bg-yellow-100 text-yellow-700',
      'Low': 'bg-blue-100 text-blue-700',
    };
    return <Badge className={colors[priority]}>{priority}</Badge>;
  };

  const renderStatusPill = (status) => {
    const styles = {
      'Pending': 'bg-amber-100 text-amber-800 border-amber-300',
      'In Progress': 'bg-violet-100 text-violet-800 border-violet-300',
      'Completed': 'bg-emerald-100 text-emerald-800 border-emerald-300',
    };

    const icons = {
      'Pending': Clock,
      'In Progress': Play,
      'Completed': CheckCircle,
    };

    const Icon = icons[status];
    if (!Icon || !styles[status]) return null;

    return (
      <span className={`inline-flex items-center rounded-md border px-3 py-1 text-sm font-semibold ${styles[status]}`}>
        <Icon className="h-4 w-4 mr-2" />
        {status}
      </span>
    );
  };

  const handleStatusUpdate = (itemId, newStatus) => {
    if (onUpdateStatus) {
      onUpdateStatus(itemId, newStatus);
      toast.success(`Status updated to ${newStatus}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Maintenance Schedule</h2>
        <p className="text-gray-600 mt-1">
          Approved maintenance items and work orders
        </p>
      </div>

      {/* Key Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Items
            </CardTitle>
            <MapPin className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-gray-500 mt-1">&nbsp;</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Pending
            </CardTitle>
            <AlertCircle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">In Progress</CardTitle>
            <Clock className="h-5 w-5 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
            <CheckCircle className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Cost</CardTitle>
            <Banknote className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">RM{stats.totalCost.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
          <SelectTrigger className="w-60 bg-white border rounded-md px-3 py-2 text-sm shadow-sm cursor-pointer ring-offset-white focus:ring-0 focus:ring-offset-0 font-semibold">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 shrink-0" />
              <SelectValue placeholder="All Status" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-60 bg-white border rounded-md px-3 py-2 text-sm shadow-sm cursor-pointer ring-offset-white focus:ring-0 focus:ring-offset-0 font-semibold">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 shrink-0" />
              <SelectValue placeholder="All Priorities" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="Urgent">Urgent</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Maintenance Items */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <Card>
            <CardContent>
              <div className="py-4 space-y-3">
                <div className="text-center py-12 text-gray-500">
                  No maintenance items found
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredItems.map((item) => (
            <Card key={item.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="md:hidden space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold break-all">{item.pillarId}</h3>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {item.status !== 'Pending' && item.status !== 'In Progress' && item.status !== 'Completed' && getStatusBadge(item.status)}
                      {getPriorityBadge(item.priority)}
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 leading-relaxed">{item.address}</p>

                  <div className="flex flex-wrap items-center gap-2">
                    {item.assignedTo && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                        <UserRound className="h-3 w-3 mr-1" />
                        {item.assignedTo}
                      </Badge>
                    )}
                    {item.scheduledDate && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Due: {new Date(item.scheduledDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[...new Set(item.faults)].map((fault, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {fault}
                      </Badge>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600">Cost:</span>
                      <span className="font-medium">RM{item.estimatedCost.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600">Work Logs:</span>
                      <span className="font-medium">{item.workLogs.length}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    {renderStatusPill(item.status)}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewDetails(item.id)}
                      className="flex-1"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Full Details
                    </Button>
                  </div>
                </div>

                <div className="hidden md:flex flex-col gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-semibold">{item.pillarId}</h3>
                        <p className="text-gray-600 text-sm">{item.address}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.status !== 'Pending' && item.status !== 'In Progress' && item.status !== 'Completed' && getStatusBadge(item.status)}
                        {getPriorityBadge(item.priority)}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[...new Set(item.faults)].map((fault, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {fault}
                        </Badge>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600">Cost:</span>
                        <span className="font-medium">RM{item.estimatedCost.toLocaleString()}</span>
                      </div>

                      {item.scheduledDate && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-gray-600" />
                          <span className="text-gray-600">Scheduled:</span>
                          <span className="font-medium">
                            {new Date(item.scheduledDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}

                      {item.assignedTo && (
                        <div className="flex items-center gap-2 text-sm">
                          <UserRound className="h-4 w-4 text-gray-600" />
                          <span className="text-gray-600">Assigned:</span>
                          <span className="font-medium">{item.assignedTo}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600">Work Logs:</span>
                        <span className="font-medium">{item.workLogs.length}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end pt-2">
                      {renderStatusPill(item.status)}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewDetails(item.id)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Full Details
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
