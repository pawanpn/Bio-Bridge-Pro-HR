import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  UserPlus,
  Eye,
  MapPin,
  Mail,
  Phone,
  Building2,
  UserCog,
  Loader2
} from 'lucide-react';
import { supabase } from '@/config/supabase';
import { useNavigate } from 'react-router-dom';

interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  personal_email?: string;
  personal_phone?: string;
  department_id?: string;
  designation_id?: string;
  branch_id?: string;
  reporting_manager_id?: string;
  employment_status: string;
  is_active?: boolean;
  department?: { name: string };
  designation?: { name: string; level: number };
  branch?: { name: string };
  subordinates?: Employee[];
}

interface TreeNodeProps {
  employee: Employee;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (employee: Employee) => void;
  searchTerm: string;
}

const TreeNode: React.FC<TreeNodeProps> = ({ employee, expanded, onToggle, onSelect, searchTerm }) => {
  const isExpanded = expanded.has(employee.id);
  const hasSubordinates = employee.subordinates && employee.subordinates.length > 0;

  const matchesSearch = searchTerm && (
    employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.employee_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.department?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="ml-6">
      <div
        className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
          matchesSearch 
            ? 'bg-yellow-50 border-yellow-300' 
            : 'hover:bg-muted bg-card'
        }`}
        onClick={() => onSelect(employee)}
      >
        <button
          className="p-1 hover:bg-muted-foreground/20 rounded"
          onClick={(e) => {
            e.stopPropagation();
            if (hasSubordinates) onToggle(employee.id);
          }}
        >
          {hasSubordinates ? (
            isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
          ) : (
            <div className="w-4" />
          )}
        </button>

        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <UserCog size={20} className="text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold truncate">{employee.full_name}</p>
            {employee.is_active === false && (
              <Badge variant="destructive" className="text-xs">Inactive</Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
            <span>{employee.employee_code}</span>
            {employee.department && (
              <span className="flex items-center gap-1">
                <Building2 size={12} />
                {employee.department.name}
              </span>
            )}
            {employee.designation && (
              <span>{employee.designation.name}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Eye size={16} />
          </Button>
        </div>
      </div>

      {isExpanded && hasSubordinates && (
        <div className="mt-2">
          {employee.subordinates!.map(sub => (
            <TreeNode
              key={sub.id}
              employee={sub}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const EmployeeHierarchyTree: React.FC = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          department:departments(name),
          designation:designations(name, level),
          branch:branches(name)
        `)
        .or('employment_status.eq.Active,employment_status.eq.active')
        .order('employee_code');

      if (error) throw error;

      // Normalize is_active from employment_status if not present
      const normalizedData = (data || []).map(emp => ({
        ...emp,
        is_active: emp.is_active ?? (emp.employment_status === 'Active' || emp.employment_status === 'active')
      }));

      const hierarchy = buildHierarchy(normalizedData);
      setEmployees(hierarchy);
    } catch (error: any) {
      console.error('Error loading employees:', error);
      alert('Failed to load employees: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const buildHierarchy = (emps: Employee[]): Employee[] => {
    const employeeMap = new Map<string, Employee>();
    const roots: Employee[] = [];

    emps.forEach(emp => {
      employeeMap.set(emp.id, { ...emp, subordinates: [] });
    });

    emps.forEach(emp => {
      const employee = employeeMap.get(emp.id)!;
      if (emp.reporting_manager_id && employeeMap.has(emp.reporting_manager_id)) {
        const manager = employeeMap.get(emp.reporting_manager_id)!;
        if (!manager.subordinates) manager.subordinates = [];
        manager.subordinates.push(employee);
      } else {
        roots.push(employee);
      }
    });

    return roots;
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (emps: Employee[]) => {
      emps.forEach(emp => {
        allIds.add(emp.id);
        if (emp.subordinates) collectIds(emp.subordinates);
      });
    };
    collectIds(employees);
    setExpanded(allIds);
  };

  const collapseAll = () => {
    setExpanded(new Set());
  };

  const handleSelectEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users size={20} />
                  Employee Hierarchy
                </CardTitle>
                <CardDescription>
                  Organizational structure with reporting relationships
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={expandAll}>
                  Expand All
                </Button>
                <Button variant="outline" size="sm" onClick={collapseAll}>
                  Collapse All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {employees.map(emp => (
                <TreeNode
                  key={emp.id}
                  employee={emp}
                  expanded={expanded}
                  onToggle={toggleExpand}
                  onSelect={handleSelectEmployee}
                  searchTerm={searchTerm}
                />
              ))}

              {employees.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Users size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No employees found</p>
                  <Button className="mt-4" onClick={() => navigate('/employees')}>
                    <UserPlus size={16} />
                    Add Employee
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Employee Details</CardTitle>
            <CardDescription>
              {selectedEmployee ? 'Selected employee information' : 'Select an employee to view details'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedEmployee ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <UserCog size={40} className="text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">{selectedEmployee.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedEmployee.employee_code}</p>
                </div>

                <div className="space-y-3">
                  {selectedEmployee.department && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 size={16} className="text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Department</p>
                        <p className="font-medium">{selectedEmployee.department.name}</p>
                      </div>
                    </div>
                  )}

                  {selectedEmployee.designation && (
                    <div className="flex items-center gap-2 text-sm">
                      <UserCog size={16} className="text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Designation</p>
                        <p className="font-medium">{selectedEmployee.designation.name}</p>
                      </div>
                    </div>
                  )}

                  {selectedEmployee.branch && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin size={16} className="text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Branch</p>
                        <p className="font-medium">{selectedEmployee.branch.name}</p>
                      </div>
                    </div>
                  )}

                  {selectedEmployee.personal_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail size={16} className="text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Email</p>
                        <p className="font-medium">{selectedEmployee.personal_email}</p>
                      </div>
                    </div>
                  )}

                  {selectedEmployee.personal_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone size={16} className="text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Phone</p>
                        <p className="font-medium">{selectedEmployee.personal_phone}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge variant={selectedEmployee.is_active !== false ? 'default' : 'destructive'}>
                        {selectedEmployee.is_active !== false ? 'Active' : 'Inactive'}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">{selectedEmployee.employment_status}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    className="flex-1"
                    onClick={() => navigate(`/employee/${selectedEmployee.id}`)}
                  >
                    <Eye size={16} />
                    View Full Profile
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users size={48} className="mx-auto mb-4 opacity-50" />
                <p>Select an employee from the tree to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
