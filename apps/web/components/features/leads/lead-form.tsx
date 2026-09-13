'use client';

/**
 * Create / edit lead form used inside a ResponsiveOverlay.
 * Validates against zLeadCreateInput / zLeadUpdateInput from contracts.
 */
import { useState } from 'react';

import { Button } from '@/components/spectrumui/button';
import { Input } from '@/components/spectrumui/input';
import { Label } from '@/components/spectrumui/label';
import { LoadingButton } from '@/components/spectrumui/loading-button-dependencies';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/spectrumui/select';
import { Textarea } from '@/components/spectrumui/textarea';
import { Textarea as AutosizeTextarea } from '@/components/spectrumui/textarea';
import type { LeadDTO } from '@logiflow/contracts';
import { LEAD_SOURCES, LEAD_STATUS_LABELS } from '@logiflow/contracts';

export interface LeadFormValues {
  name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  notes: string;
}

export function LeadForm({
  initial,
  onSubmit,
  submitting,
  submitLabel = 'Save lead',
}: {
  initial?: LeadDTO;
  onSubmit: (values: LeadFormValues) => void;
  submitting?: boolean;
  submitLabel?: string;
}) {
  const [form, setForm] = useState<LeadFormValues>({
    name: initial?.name ?? '',
    company: initial?.company ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    source: initial?.source ?? '',
    notes: initial?.notes ?? '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof LeadFormValues, string>>>({});

  function validate(): boolean {
    const e: Partial<Record<keyof LeadFormValues, string>> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (!form.company.trim() || form.company.trim().length < 2) e.company = 'Company must be at least 2 characters';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.source) e.source = 'Select a source';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="lead-name">Name *</Label>
        <Input
          id="lead-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'lead-name-error' : undefined}
          placeholder="Contact name"
        />
        {errors.name && <p id="lead-name-error" className="text-[12px] text-destructive">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="lead-company">Company *</Label>
        <Input
          id="lead-company"
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
          aria-invalid={!!errors.company}
          aria-describedby={errors.company ? 'lead-company-error' : undefined}
          placeholder="Company name"
        />
        {errors.company && <p id="lead-company-error" className="text-[12px] text-destructive">{errors.company}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="lead-email">Email</Label>
          <Input
            id="lead-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            aria-invalid={!!errors.email}
            placeholder="email@example.com"
          />
          {errors.email && <p className="text-[12px] text-destructive">{errors.email}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lead-phone">Phone</Label>
          <Input
            id="lead-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+91 …"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Source *</Label>
        <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v ?? '' })}>
          <SelectTrigger aria-invalid={!!errors.source}>
            <SelectValue placeholder="How did you find this lead?" />
          </SelectTrigger>
          <SelectContent>
            {LEAD_SOURCES.map((src) => (
              <SelectItem key={src} value={src}>
                {src}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.source && <p className="text-[12px] text-destructive">{errors.source}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="lead-notes">Notes</Label>
        <Textarea
          id="lead-notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
          placeholder="Additional notes…"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <LoadingButton type="submit" loading={submitting}>
          {submitLabel}
        </LoadingButton>
      </div>
    </form>
  );
}
