import { useState } from "react";
import { Command } from "cmdk";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover } from "radix-ui";
import { getCountryCallingCode, type Country } from "react-phone-number-input";

type CountryOption = { value?: Country; label: string; divider?: boolean };
type CountrySelectProps = {
  value?: Country;
  options: CountryOption[];
  onChange: (country?: Country) => void;
  onFocus: () => void;
  onBlur: () => void;
  disabled?: boolean;
  readOnly?: boolean;
};

function searchable(text: string) {
  return text.trim().toLocaleLowerCase("es").normalize("NFD").replace(/\p{M}/gu, "");
}

function matchesCountry(code: string, search: string, keywords: string[] = []) {
  const query = searchable(search);
  return [code, ...keywords].some((term) => searchable(term).includes(query)) ? 1 : 0;
}

export function PhoneCountrySelect({ value, options, onChange, onFocus, onBlur, disabled, readOnly }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => !option.divider && option.value === value);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" disabled={disabled || readOnly} onFocus={onFocus} onBlur={onBlur}
          aria-label={`País del número de WhatsApp, ${selected?.label ?? "Internacional"}`}
          className="flex h-full shrink-0 items-center gap-1.5 border-r border-input pr-2 text-sm font-medium">
          {value ?? "Intl."}<ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} collisionPadding={12} aria-label="Seleccionar país"
          onCloseAutoFocus={(event) => {
            // The phone input takes focus after a country is selected.
            if (document.activeElement?.getAttribute("type") === "tel") event.preventDefault();
          }}
          className="z-50 w-72 max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
          <Command label="Buscar país" filter={matchesCountry}>
            <div className="flex items-center gap-2 border-b px-3">
              <Search aria-hidden="true" className="size-4 text-muted-foreground" />
              <Command.Input placeholder="Buscar país o prefijo" autoComplete="off"
                className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none md:text-sm" />
            </div>
            <Command.List className="max-h-[min(16rem,calc(var(--radix-popover-content-available-height)-3rem))] overflow-y-auto overscroll-contain p-1">
              <Command.Empty className="p-3 text-sm text-muted-foreground">No se encontraron países.</Command.Empty>
              {options.filter((option) => !option.divider).map((option) => {
                const prefix = option.value ? "+" + getCountryCallingCode(option.value) : "";
                return (
                  <Command.Item key={option.value ?? "ZZ"} value={option.value ?? "ZZ"} keywords={[option.label, prefix]}
                    onSelect={() => { setOpen(false); onChange(option.value); }}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground">
                    <span className="flex-1">{option.label}</span>
                    <span className="text-muted-foreground">{prefix}</span>
                    {value === option.value && <Check aria-label="País actual" className="size-4" />}
                  </Command.Item>
                );
              })}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
