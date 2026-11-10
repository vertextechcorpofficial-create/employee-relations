"use client";

import { useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  Building2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Send,
  Upload,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CreateJobOrderInput,
  CurrentUserDirectory,
  DepartmentOption,
  EmployeeOption,
  ServiceCategory,
  UploadedJobOrderFile,
} from "@/modules/er/job-order/types/job-order.schema";

const JobOrderFormSchema = z.object({
  category_id: z.string().min(1, "Please select a Category of Service"),
  target_department_id: z.string().min(1, "Please choose a target department"),
  target_user_id: z.string().optional(),
  remarks: z
    .string()
    .trim()
    .min(3, "Remarks are required (at least 3 characters)")
    .max(2000, "Remarks must be 2000 characters or fewer"),
});

type JobOrderFormValues = z.infer<typeof JobOrderFormSchema>;

interface CreateJobOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser?: CurrentUserDirectory | null;
  categories: ServiceCategory[];
  departments: DepartmentOption[];
  employees: EmployeeOption[];
  isSubmitting: boolean;
  onUploadFile: (file: File) => Promise<UploadedJobOrderFile>;
  onSubmit: (payload: CreateJobOrderInput) => Promise<void>;
  onOpenRegisterCategory: () => void;
}

/**
 * Requester POV dialog for filing a purely digital Job Order directed to
 * a target department (and optional employee) with category, remarks, and attachments.
 */
export function CreateJobOrderDialog({
  open,
  onOpenChange,
  currentUser,
  categories,
  departments,
  employees,
  isSubmitting,
  onUploadFile,
  onSubmit,
  onOpenRegisterCategory,
}: CreateJobOrderDialogProps) {
  const activeCategories = categories.filter((c) => c.is_active);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedJobOrderFile[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const form = useForm<JobOrderFormValues>({
    resolver: zodResolver(JobOrderFormSchema),
    defaultValues: {
      category_id: "",
      target_department_id: "",
      target_user_id: "",
      remarks: "",
    },
  });

  const selectedDeptId = useWatch({
    control: form.control,
    name: "target_department_id",
  });

  const departmentOptions = useMemo(
    () =>
      departments.map((dept) => ({
        value: String(dept.department_id),
        label: dept.department_name,
      })),
    [departments]
  );

  const employeeOptions = useMemo(() => {
    const deptNum = selectedDeptId ? Number(selectedDeptId) : null;
    const filtered = deptNum
      ? employees.filter((emp) => emp.user_department === deptNum)
      : employees;

    const listToUse = filtered.length > 0 ? filtered : employees;
    return [
      { value: "", label: "Any personnel in target department" },
      ...listToUse.map((emp) => ({
        value: String(emp.user_id),
        label: emp.user_email
          ? `${emp.full_name} (${emp.user_email})`
          : `${emp.full_name} (#${emp.user_id})`,
      })),
    ];
  }, [employees, selectedDeptId]);

  const handleFilesSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsUploading(true);
    try {
      const files = Array.from(fileList);
      for (const file of files) {
        const uploaded = await onUploadFile(file);
        setUploadedFiles((prev) => [...prev, uploaded]);
      }
      toast.success(
        files.length === 1
          ? `Attached "${files[0].name}"`
          : `Attached ${files.length} files`
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to upload attachment";
      toast.error("Upload Error", { description: msg });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.file_id !== fileId));
  };

  const handleFormSubmit = async (values: JobOrderFormValues) => {
    const deptId = Number(values.target_department_id);
    const selectedDept = departments.find((d) => d.department_id === deptId);
    const empId = values.target_user_id ? Number(values.target_user_id) : null;
    const selectedEmp = empId
      ? employees.find((e) => e.user_id === empId)
      : undefined;

    await onSubmit({
      category_id: Number(values.category_id),
      target_department_id: deptId,
      target_department_name:
        selectedDept?.department_name ?? `Department #${deptId}`,
      target_user_id: empId,
      target_username: selectedEmp?.full_name ?? null,
      remarks: values.remarks,
      attachments: uploadedFiles.map((file) => ({
        directus_file_id: file.file_id,
        file_name: file.file_name,
        file_type: file.file_type,
        attachment_kind: file.attachment_kind,
      })),
    });

    form.reset();
    setUploadedFiles([]);
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !isSubmitting && !isUploading) {
      form.reset();
      setUploadedFiles([]);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Submit Digital Job Order</DialogTitle>
          <DialogDescription>
            Digital record only — choose a target department and attach supporting
            pictures or documents.
          </DialogDescription>
        </DialogHeader>

        {currentUser && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              Requester: {currentUser.username}
            </span>
            <span>•</span>
            <span>
              Your Department:{" "}
              <strong className="text-foreground">
                {currentUser.department_name ?? "Unassigned"}
              </strong>
            </span>
          </div>
        )}

        {activeCategories.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <AlertCircle className="h-4 w-4 text-primary" />
              No active Categories of Services found
            </div>
            <p className="text-xs text-muted-foreground">
              Please register at least one active service category before
              submitting a Job Order.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onOpenRegisterCategory();
              }}
            >
              Register Category of Service
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleFormSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category of Service</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full bg-background">
                          <SelectValue placeholder="Select a registered service category..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeCategories.map((cat) => (
                          <SelectItem key={cat.id} value={String(cat.id)}>
                            {cat.category_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="target_department_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        Direct To Department
                      </FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={departmentOptions}
                          value={field.value}
                          onValueChange={(val) => {
                            field.onChange(val);
                            form.setValue("target_user_id", "");
                          }}
                          placeholder="Choose department..."
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="target_user_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                        Target Employee (Optional)
                      </FormLabel>
                      <FormControl>
                        <SearchableSelect
                          options={employeeOptions}
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                          placeholder="Any in department..."
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the requested service, issue details, location, or instructions..."
                        rows={4}
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    Pictures & Supporting Documents
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Max 10MB per file
                  </span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  onChange={handleFilesSelected}
                  className="hidden"
                />

                <button
                  type="button"
                  disabled={isUploading || isSubmitting}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 px-4 py-5 text-center transition-colors hover:border-primary/50 hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  ) : (
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  )}
                  <div className="text-sm font-medium text-foreground">
                    {isUploading
                      ? "Uploading attachments..."
                      : "Click to attach Pictures or Supporting Documents"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Images (PNG, JPG, WEBP) and Documents (PDF, Word, Excel, CSV)
                  </p>
                </button>

                {uploadedFiles.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.file_id}
                        className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-2"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          {file.attachment_kind === "PICTURE" ? (
                            <div className="h-9 w-9 shrink-0 overflow-hidden rounded border border-border bg-muted">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={file.file_url}
                                alt={file.file_name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border bg-muted text-muted-foreground">
                              <FileText className="h-4 w-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-foreground">
                              {file.file_name}
                            </p>
                            <Badge variant="secondary" className="mt-0.5 text-[10px]">
                              {file.attachment_kind === "PICTURE" ? (
                                <span className="flex items-center gap-1">
                                  <ImageIcon className="h-2.5 w-2.5" />
                                  Picture
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <FileText className="h-2.5 w-2.5" />
                                  Document
                                </span>
                              )}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveFile(file.file_id)}
                          aria-label={`Remove ${file.file_name}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isSubmitting || isUploading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || isUploading}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Submit Job Order
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
