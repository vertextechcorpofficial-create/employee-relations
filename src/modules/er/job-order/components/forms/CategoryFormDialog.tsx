"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  CreateServiceCategoryInput,
  ServiceCategory,
} from "@/modules/er/job-order/types/job-order.schema";

const CategoryFormSchema = z.object({
  category_name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(150, "Category name must be 150 characters or fewer"),
  description: z.string().trim().max(500).optional(),
  is_active: z.boolean(),
});

type CategoryFormValues = z.infer<typeof CategoryFormSchema>;

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCategory: ServiceCategory | null;
  isSubmitting: boolean;
  onSubmit: (payload: CreateServiceCategoryInput, editId?: number) => Promise<void>;
}

/**
 * Dialog form for registering or editing a Category of Service.
 */
export function CategoryFormDialog({
  open,
  onOpenChange,
  editingCategory,
  isSubmitting,
  onSubmit,
}: CategoryFormDialogProps) {
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(CategoryFormSchema),
    defaultValues: {
      category_name: "",
      description: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        category_name: editingCategory?.category_name ?? "",
        description: editingCategory?.description ?? "",
        is_active: editingCategory?.is_active ?? true,
      });
    }
  }, [open, editingCategory, form]);

  const handleFormSubmit = async (values: CategoryFormValues) => {
    await onSubmit(
      {
        category_name: values.category_name,
        description: values.description || null,
        is_active: values.is_active,
      },
      editingCategory?.id
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>
            {editingCategory
              ? "Edit Category of Service"
              : "Register Category of Service"}
          </DialogTitle>
          <DialogDescription>
            Categories registered here will be selectable when filing digital Job
            Orders.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleFormSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="category_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., IT Hardware Support, Plumbing, System Access"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief scope of services covered under this category..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                  <div>
                    <FormLabel className="text-sm font-medium">
                      Active Category
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Active categories appear in the Job Order submission form.
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingCategory ? "Save Changes" : "Register Category"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

