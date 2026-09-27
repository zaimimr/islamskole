"use client"

import * as React from "react"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type SelectFieldOption = {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export type SelectFieldGroup = {
  label: string
  options: SelectFieldOption[]
}

type SelectFieldProps = {
  id?: string
  name?: string
  form?: string
  options: SelectFieldOption[] | SelectFieldGroup[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  size?: "sm" | "default"
  className?: string
  triggerClassName?: string
  "aria-label"?: string
  "aria-labelledby"?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean | "true" | "false"
}

function isGrouped(
  options: SelectFieldOption[] | SelectFieldGroup[]
): options is SelectFieldGroup[] {
  return options.length > 0 && "options" in options[0]
}

export function SelectField({
  id,
  name,
  form,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  required,
  disabled,
  size,
  className,
  triggerClassName,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: SelectFieldProps) {
  const groups = isGrouped(options) ? options : null
  const flat = groups ? groups.flatMap((group) => group.options) : (options as SelectFieldOption[])
  const items = flat.map((option) => ({ value: option.value, label: option.label }))

  const inputRef = React.useRef<HTMLInputElement>(null)
  const [inner, setInner] = React.useState(defaultValue ?? "")
  const controlled = value !== undefined
  const current = controlled ? value : inner

  React.useEffect(() => {
    const owner = inputRef.current?.form
    if (controlled || !owner) return
    const handleReset = () => setInner(defaultValue ?? "")
    owner.addEventListener("reset", handleReset)
    return () => owner.removeEventListener("reset", handleReset)
  }, [controlled, defaultValue])

  const known = flat.some((option) => option.value === current)
  const fallback = placeholder
    ? null
    : (flat.find((option) => !option.disabled)?.value ?? null)
  const resolved = known ? current : fallback

  const renderOption = (option: SelectFieldOption) => (
    <SelectItem
      key={option.value}
      value={option.value}
      disabled={option.disabled}
      description={option.description}
    >
      {option.label}
    </SelectItem>
  )

  return (
    <div className={cn("relative grid min-w-0", className)}>
      <Select<string>
        id={id}
        name={name}
        form={form}
        inputRef={inputRef}
        items={items}
        value={resolved}
        onValueChange={(next) => {
          if (!controlled) setInner(next ?? "")
          onValueChange?.(next ?? "")
        }}
        required={required}
        disabled={disabled}
      >
        <SelectTrigger
          size={size}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          className={cn(
            "w-full",
            resolved === "" && "text-[#5A625C] dark:text-muted-foreground",
            triggerClassName
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {groups
            ? groups.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.options.map(renderOption)}
                </SelectGroup>
              ))
            : flat.map(renderOption)}
        </SelectContent>
      </Select>
    </div>
  )
}
