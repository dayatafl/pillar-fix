import { useState } from 'react';
import { Search, Filter, Eye, MapPin, Calendar } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

export function CaseList({ cases, onViewCase }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  const filteredCases = cases.filter((case_) => {
    const matchesSearch =
      case_.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      case_.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      case_.faults.some(f => f.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || case_.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || case_.severity === severityFilter;

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Case Management</h2>
        <p className="text-gray-600 mt-1">
          View and manage all reported feeder pillar cases
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by location, address, or fault type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
          <SelectTrigger className="w-full md:w-48">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Reported">Reported</SelectItem>
            <SelectItem value="Under Review">Under Review</SelectItem>
            <SelectItem value="Assigned">Assigned</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Resolved">Resolved</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={(value) => setSeverityFilter(value)}>
          <SelectTrigger className="w-full md:w-48">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      <div className="text-sm text-gray-600">
        Showing {filteredCases.length} of {cases.length} cases
      </div>

      {/* Case Cards */}
      <div className="grid grid-cols-1 gap-4">
        {filteredCases.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">No cases found matching your filters</p>
            </CardContent>
          </Card>
        ) : (
          filteredCases.map((case_) => (
            <Card key={case_.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Image */}
                  <div className="w-full md:w-48 h-48 flex-shrink-0">
                    <img
                      src={case_.imageUrl}
                      alt={case_.location}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-semibold">{case_.location}</h3>
                        <div className="flex items-center text-gray-600 mt-1">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span className="text-sm">{case_.address}</span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        case_.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                        case_.severity === 'High' ? 'bg-orange-100 text-orange-700' :
                        case_.severity === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {case_.severity}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {case_.faults.map((fault, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                        >
                          {fault}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t">
                      <div className="flex items-center gap-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          case_.status === 'Resolved' || case_.status === 'Closed' ? 'bg-green-100 text-green-700' :
                          case_.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                          case_.status === 'Assigned' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {case_.status}
                        </span>
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="h-4 w-4 mr-1" />
                          {formatDate(case_.reportedAt)}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewCase(case_.id)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
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
