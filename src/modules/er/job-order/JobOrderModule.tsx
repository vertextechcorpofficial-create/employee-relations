"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  FolderCog,
  Inbox,
  Plus,
  RefreshCw,
  Search,
  Ticket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorPage } from "@/app/(employee-relations)/er/_components/ErrorPage";
import { CategoryTable } from "@/modules/er/job-order/components/data-table/CategoryTable";
import { JobOrderTable } from "@/modules/er/job-order/components/data-table/JobOrderTable";
import { CategoryFormDialog } from "@/modules/er/job-order/components/forms/CategoryFormDialog";
import { CreateJobOrderDialog } from "@/modules/er/job-order/components/forms/CreateJobOrderDialog";
import { JobOrderDetailsModal } from "@/modules/er/job-order/components/modals/JobOrderDetailsModal";
import { useJobOrderDirectory } from "@/modules/er/job-order/hooks/useJobOrderDirectory";
import { useJobOrders } from "@/modules/er/job-order/hooks/useJobOrders";
import { useServiceCategories } from "@/modules/er/job-order/hooks/useServiceCategories";
import {
  CreateJobOrderInput,
  CreateServiceCategoryInput,
  JO_STATUS_VALUES,
  JobOrder,
  JobOrderStatus,
  ServiceCategory,
  UpdateJobOrderInput,
} from "@/modules/er/job-order/types/job-order.schema";

/**
 * Main client shell for the Digital Job Order / Ticketing module.
 * Coordinates Requester POV (department/employee targeting), Receiver Queue
 * (department filter + direct status updates without acknowledgement), and Service Categories.
 */
export function JobOrderModule() {
  const myOrders = useJobOrders("my");
  const receiverOrders = useJobOrders("all");
  const categoriesState = useServiceCategories();
  const directory = useJobOrderDirectory();

  const [activeTab, setActiveTab] = useState<string>("my_requests");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");

  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] =
    useState<boolean>(false);
  const [editingCategory, setEditingCategory] =
    useState<ServiceCategory | null>(null);

  const [selectedJobOrder, setSelectedJobOrder] = useState<JobOrder | null>(
    null
  );
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);

  const handleRefreshAll = async () => {
    await Promise.all([
      myOrders.refresh(),
      receiverOrders.refresh(),
      categoriesState.refresh(),
      directory.refresh(),
    ]);
  };

  const handleCreateJobOrder = async (payload: CreateJobOrderInput) => {
    await myOrders.submitJobOrder(payload);
    await receiverOrders.refresh();
  };

  const handleInlineStatusChange = async (
    joId: number,
    nextStatus: JobOrderStatus
  ) => {
    const updated = await receiverOrders.updateJobOrder(joId, {
      status: nextStatus,
    });
    if (selectedJobOrder?.id === joId) {
      setSelectedJobOrder(updated);
    }
    await myOrders.refresh();
  };

  const handleModalUpdateJobOrder = async (
    joId: number,
    payload: UpdateJobOrderInput
  ) => {
    const updated = await receiverOrders.updateJobOrder(joId, payload);
    if (selectedJobOrder?.id === joId) {
      setSelectedJobOrder(updated);
    }
    await myOrders.refresh();
  };

  const handleSaveCategory = async (
    payload: CreateServiceCategoryInput,
    editId?: number
  ) => {
    if (editId) {
      await categoriesState.updateCategory(editId, payload);
    } else {
      await categoriesState.createCategory(payload);
    }
  };

  const handleToggleCategory = async (
    cat: ServiceCategory,
    nextActive: boolean
  ) => {
    await categoriesState.updateCategory(cat.id, { is_active: nextActive });
  };

  const filterList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (list: JobOrder[]) =>
      list.filter((jo) => {
        const matchesStatus =
          statusFilter === "ALL" || jo.status === statusFilter;
        const matchesDept =
          departmentFilter === "ALL" ||
          String(jo.target_department_id ?? "") === departmentFilter;
        const matchesQuery =
          !q ||
          jo.jo_number.toLowerCase().includes(q) ||
          jo.remarks.toLowerCase().includes(q) ||
          (jo.category_name ?? "").toLowerCase().includes(q) ||
          (jo.target_department_name ?? "").toLowerCase().includes(q) ||
          (jo.target_username ?? "").toLowerCase().includes(q) ||
          jo.requester_username.toLowerCase().includes(q);
        return matchesStatus && matchesDept && matchesQuery;
      });
  }, [searchQuery, statusFilter, departmentFilter]);

  const filteredMyOrders = useMemo(
    () => filterList(myOrders.jobOrders),
    [filterList, myOrders.jobOrders]
  );

  const filteredReceiverOrders = useMemo(
    () => filterList(receiverOrders.jobOrders),
    [filterList, receiverOrders.jobOrders]
  );

  const stats = useMemo(() => {
    const all = filteredReceiverOrders;
    return {
      total: all.length,
      open: all.filter((j) => j.status === "Open").length,
      inProgress: all.filter((j) => j.status === "In Progress").length,
      resolved: all.filter((j) => j.status === "Resolved").length,
    };
  }, [filteredReceiverOrders]);

  if (myOrders.error && receiverOrders.error && categoriesState.error) {
    return (
      <ErrorPage
        title="Unable to load Job Order module"
        message={myOrders.error}
        onRefresh={() => void handleRefreshAll()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Job Order & Service Ticketing
          </h1>
          <p className="text-sm text-muted-foreground">
            Direct digital service requests to a target department or employee,
            manage categories, and track resolution status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleRefreshAll()}
            disabled={myOrders.isLoading || receiverOrders.isLoading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingCategory(null);
              setIsCategoryDialogOpen(true);
            }}
          >
            <FolderCog className="mr-2 h-4 w-4" />
            Register Category
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Job Order
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Job Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.total}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Open Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.open}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.inProgress}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Resolved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.resolved}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Views */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <TabsList className="w-full justify-start overflow-x-auto xl:w-auto">
            <TabsTrigger value="my_requests" className="gap-2">
              <Ticket className="h-4 w-4" />
              My Job Orders
              <Badge variant="secondary" className="ml-1">
                {filteredMyOrders.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="receiver_queue" className="gap-2">
              <Inbox className="h-4 w-4" />
              Receiver Queue (List of JO)
              <Badge variant="secondary" className="ml-1">
                {filteredReceiverOrders.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <FolderCog className="h-4 w-4" />
              Categories of Services
              <Badge variant="secondary" className="ml-1">
                {categoriesState.categories.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {activeTab !== "categories" && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:w-56 sm:flex-none">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search JO #, remarks, target..."
                  className="bg-background pl-8"
                />
              </div>

              <Select
                value={departmentFilter}
                onValueChange={setDepartmentFilter}
              >
                <SelectTrigger className="w-[180px] bg-background">
                  <Building2 className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Departments</SelectItem>
                  {directory.departments.map((dept) => (
                    <SelectItem
                      key={dept.department_id}
                      value={String(dept.department_id)}
                    >
                      {dept.department_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {directory.currentUser?.department_id && (
                <Button
                  variant={
                    departmentFilter ===
                    String(directory.currentUser.department_id)
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  className="h-9 gap-1.5 text-xs"
                  onClick={() => {
                    const myDeptId = String(
                      directory.currentUser?.department_id
                    );
                    setDepartmentFilter((prev) =>
                      prev === myDeptId ? "ALL" : myDeptId
                    );
                  }}
                  title={`Filter to ${directory.currentUser.department_name ?? "My Department"}`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>My Department</span>
                </Button>
              )}

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] bg-background">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  {JO_STATUS_VALUES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Tab 1: Requester POV */}
        <TabsContent value="my_requests" className="space-y-4">
          <JobOrderTable
            jobOrders={filteredMyOrders}
            isLoading={myOrders.isLoading}
            isReceiverMode={false}
            onViewDetails={(jo) => {
              setSelectedJobOrder(jo);
              setIsDetailsOpen(true);
            }}
            onCreateNew={() => setIsCreateOpen(true)}
          />
        </TabsContent>

        {/* Tab 2: Request Receiver POV (No Acknowledge Step) */}
        <TabsContent value="receiver_queue" className="space-y-4">
          <JobOrderTable
            jobOrders={filteredReceiverOrders}
            isLoading={receiverOrders.isLoading}
            isSubmitting={receiverOrders.isSubmitting}
            isReceiverMode={true}
            onViewDetails={(jo) => {
              setSelectedJobOrder(jo);
              setIsDetailsOpen(true);
            }}
            onStatusChange={handleInlineStatusChange}
          />
        </TabsContent>

        {/* Tab 3: Registration of Categories of Services */}
        <TabsContent value="categories" className="space-y-4">
          <CategoryTable
            categories={categoriesState.categories}
            isLoading={categoriesState.isLoading}
            isSubmitting={categoriesState.isSubmitting}
            onEdit={(cat) => {
              setEditingCategory(cat);
              setIsCategoryDialogOpen(true);
            }}
            onToggleActive={handleToggleCategory}
            onCreateNew={() => {
              setEditingCategory(null);
              setIsCategoryDialogOpen(true);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs & Modals */}
      <CreateJobOrderDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        categories={categoriesState.categories}
        departments={directory.departments}
        employees={directory.employees}
        isSubmitting={myOrders.isSubmitting}
        onUploadFile={myOrders.uploadAttachment}
        onSubmit={handleCreateJobOrder}
        onOpenRegisterCategory={() => {
          setEditingCategory(null);
          setActiveTab("categories");
          setIsCategoryDialogOpen(true);
        }}
      />

      <CategoryFormDialog
        open={isCategoryDialogOpen}
        onOpenChange={setIsCategoryDialogOpen}
        editingCategory={editingCategory}
        isSubmitting={categoriesState.isSubmitting}
        onSubmit={handleSaveCategory}
      />

      <JobOrderDetailsModal
        jobOrder={selectedJobOrder}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        departments={directory.departments}
        employees={directory.employees}
        isReceiverMode={activeTab === "receiver_queue"}
        isSubmitting={receiverOrders.isSubmitting}
        onUpdateJobOrder={handleModalUpdateJobOrder}
      />
    </div>
  );
}
