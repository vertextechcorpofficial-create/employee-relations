"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DialogSearchableSelectOption {
  value: string;
  label: string;
}

export interface DialogSearchableSelectProps {
  options: DialogSearchableSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Module-scoped searchable combobox tailored for use inside Radix modal dialogs.
 * Isolates wheel events from Radix Dialog's outer scroll lock so mouse wheel
 * scrolling works natively without modifying shared global UI primitives.
 */
export function DialogSearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  disabled = false,
  className,
}: DialogSearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const cleanupRef = React.useRef<(() => void) | null>(null);

  const selectedLabel = React.useMemo(() => {
    return options.find((opt) => opt.value === value)?.label;
  }, [options, value]);

  React.useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  // Callback ref guarantees immediate attachment once the portaled popover mounts,
  // avoiding null-ref timing races when `open` flips to true.
  const setContainerRef = React.useCallback((node: HTMLDivElement | null) => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (!node) return;

    const handleWheel = (e: WheelEvent) => {
      const list = node.querySelector<HTMLElement>(
        "[data-slot='command-list'], [cmdk-list]"
      );
      if (!list) return;

      // Prevent wheel events from bubbling to `document`, where Radix Dialog's
      // react-remove-scroll cancels wheel scrolling on portaled overlays.
      e.stopPropagation();

      // Normalize delta across pixel, Windows line (deltaMode === 1), and page modes.
      let delta = e.deltaY;
      if (e.deltaMode === 1) {
        delta *= 24;
      } else if (e.deltaMode === 2) {
        delta *= list.clientHeight;
      }

      const isScrollingDown = delta > 0;
      const canScrollDown =
        isScrollingDown &&
        list.scrollTop + list.clientHeight < list.scrollHeight - 1;
      const canScrollUp = !isScrollingDown && list.scrollTop > 1;

      if (canScrollDown || canScrollUp) {
        list.scrollTop += delta;
      }

      e.preventDefault();
    };

    node.addEventListener("wheel", handleWheel, { passive: false });
    cleanupRef.current = () => {
      node.removeEventListener("wheel", handleWheel);
    };
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full min-w-0 justify-between",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <div ref={setContainerRef} className="w-full">
          <Command>
            <CommandInput
              placeholder={`Search ${placeholder.toLowerCase()}...`}
            />
            <CommandList className="overscroll-contain">
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={`${opt.label}::${opt.value}`}
                    keywords={[opt.label]}
                    onSelect={() => {
                      onValueChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === opt.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {opt.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </PopoverContent>
    </Popover>
  );
}

