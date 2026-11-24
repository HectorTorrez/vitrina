import * as React from "react"
import { CalendarIcon, X } from "lucide-react"
import { enUS, es } from "date-fns/locale"
import type { Matcher } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

function parseIsoDate(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function formatDisplayDate(value: string, locale: "es" | "en"): string {
  const [y, m, d] = value.split("-").map(Number)
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-SV", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

export interface DatePickerProps {
  value?: string
  onChange: (value: string) => void
  min?: string
  max?: string
  locale?: "es" | "en"
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  align?: "start" | "center" | "end"
  className?: string
  id?: string
  "aria-label"?: string
  /** Optional custom trigger element rendered inside PopoverTrigger asChild. */
  trigger?: React.ReactNode
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  locale = "es",
  placeholder,
  clearable = false,
  disabled = false,
  align = "start",
  className,
  id,
  "aria-label": ariaLabel,
  trigger,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseIsoDate(value)
  const minDate = parseIsoDate(min)
  const maxDate = parseIsoDate(max)

  const disabledMatchers: Matcher[] = []
  if (minDate) disabledMatchers.push({ before: minDate })
  if (maxDate) disabledMatchers.push({ after: maxDate })

  const defaultLabel =
    placeholder ?? (locale === "en" ? "Pick a date" : "Elegí una fecha")

  const handleSelect = (day: Date | undefined) => {
    if (!day) {
      if (clearable) {
        onChange("")
        setOpen(false)
      }
      return
    }
    onChange(toIsoDate(day))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {trigger ?? (
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={ariaLabel}
            className={cn(
              "justify-start bg-transparent text-left font-normal shadow-xs hover:bg-muted/50 hover:text-foreground",
              !value && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {value ? formatDisplayDate(value, locale) : defaultLabel}
            </span>
            {clearable && value && (
              <span
                role="button"
                tabIndex={0}
                aria-label={locale === "en" ? "Clear date" : "Limpiar fecha"}
                className="ml-auto rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onChange("")
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    e.stopPropagation()
                    onChange("")
                  }
                }}
              >
                <X className="size-3.5" />
              </span>
            )}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? minDate ?? new Date()}
          onSelect={handleSelect}
          disabled={disabledMatchers.length > 0 ? disabledMatchers : undefined}
          locale={locale === "en" ? enUS : es}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export interface DateTimePickerProps {
  name?: string
  id?: string
  defaultValue?: string
  required?: boolean
  locale?: "es" | "en"
  min?: string
  max?: string
  className?: string
}

function splitDateTime(val?: string): { date: string; time: string } {
  if (!val) return { date: "", time: "09:00" }
  const [d, t] = val.split("T")
  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(d ?? "") ? d : "",
    time: t ? t.slice(0, 5) : "09:00",
  }
}

/**
 * Date + time picker built with shadcn DatePicker and Input[type=time].
 * Posts a combined "YYYY-MM-DDTHH:MM" value via a hidden input for native forms.
 */
export function DateTimePicker({
  name,
  id,
  defaultValue,
  required,
  locale = "es",
  min,
  max,
  className,
}: DateTimePickerProps) {
  const initial = splitDateTime(defaultValue)
  const [date, setDate] = React.useState(initial.date)
  const [time, setTime] = React.useState(initial.time)
  const hiddenRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const next = splitDateTime(defaultValue)
    setDate(next.date)
    setTime(next.time)
  }, [defaultValue])

  React.useEffect(() => {
    const form = hiddenRef.current?.form
    if (!form) return
    const onReset = () => {
      const next = splitDateTime(defaultValue)
      setDate(next.date)
      setTime(next.time)
    }
    form.addEventListener("reset", onReset)
    return () => form.removeEventListener("reset", onReset)
  }, [defaultValue])

  const combined = date && time ? `${date}T${time}` : ""

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {name && (
        <input
          ref={hiddenRef}
          type="text"
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          value={combined}
          required={required}
          className="sr-only"
        />
      )}
      <DatePicker
        id={id}
        value={date}
        onChange={setDate}
        min={min}
        max={max}
        locale={locale}
        className="h-9 min-w-0 flex-1"
      />
      <Input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        required={required}
        aria-label={locale === "en" ? "Time" : "Hora"}
        className="h-9 w-28 shrink-0"
      />
    </div>
  )
}
