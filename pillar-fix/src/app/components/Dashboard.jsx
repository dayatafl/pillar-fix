import { AlertCircle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';

export function Dashboard({ cases }) {
  const stats = {
    total: cases.length,
    critical: cases.filter(c => c.severity === 'Critical').length,
    inProgress: cases.filter(c => c.status === 'In Progress').length,
    resolved: cases.filter(c => c.status === 'Resolved' || c.status === 'Closed').length,
  };

  const statCards = [
    {
      title: 'Total Cases',
      value: stats.total,
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Critical Issues',
      value: stats.critical,
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      title: 'In Progress',
      value: stats.inProgress,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: 'Resolved',
      value: stats.resolved,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <p className="text-gray-600 mt-1">
          Overview of feeder pillar maintenance cases
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {cases.slice(0, 5).map((case_) => (
              <div
                key={case_.id}
                className="flex items-center justify-between border-b pb-3 last:border-0"
              >
                <div className="flex-1">
                  <p className="font-medium">{case_.location}</p>
                  <div className="flex gap-2 mt-1">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      case_.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                      case_.severity === 'High' ? 'bg-orange-100 text-orange-700' :
                      case_.severity === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {case_.severity}
                    </span>
                    <span className="text-xs text-gray-500">
                      {case_.faults.join(', ')}
                    </span>
                  </div>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full ${
                  case_.status === 'Resolved' || case_.status === 'Closed' ? 'bg-green-100 text-green-700' :
                  case_.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {case_.status}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
