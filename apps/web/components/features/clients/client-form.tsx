'use client';

/**
 * Client form for creating / editing a client.
 * Uses zClientCreateInput / zClientUpdateInput from contracts for validation.
 */
import { useState } from 'react';

import { Input } from '@/components/spectrumui/input';
import { Label } from '@/components/spectrumui/label';
import { LoadingButton } from '@/components/spectrumui/loading-button-dependencies';
import { Textarea } from '@/components/spectrumui/textarea';
import type { ClientDTO } from '@logiflow/contracts';

export interface ClientFormValues {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  pincode: string;
  addressLine1: string;
  addressLine2: string;
  gstin: string;
  creditTermsDays: string;
}

export function ClientForm({
  initial,
  onSubmit,
  submitting,
  submitLabel = 'Save client',
}: {
  initial?: ClientDTO;
  onSubmit: (values: ClientFormValues) => void;
  submitting?: boolean;
  submitLabel?: string;
}) {
  const [form, setForm] = useState<ClientFormValues>({
    name: initial?.name ?? '',
    contactName: initial?.contactName ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    pincode: initial?.pincode ?? '',
    addressLine1: initial?.addressLine1 ?? '',
    addressLine2: initial?.addressLine2 ?? '',
    gstin: initial?.gstin ?? '',
    creditTermsDays: initial?.creditTermsDays?.toString() ?? '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormValues, string>>>({});

  function validate(): boolean {
    const e: Partial<Record<keyof ClientFormValues, string>> = {};
    if (!form.name.trim() || form.name.trim().length < 2)
      e.name = 'Name must be at least 2 characters';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Enter a valid email';
    if (form.pincode && !/^\d{6}$/.test(form.pincode))
      e.pincode = 'Pincode must be 6 digits';
    if (form.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstin))
      e.gstin = 'Invalid GSTIN';
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
        <Label htmlFor="client-name">Company name *</Label>
        <Input
          id="client-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'client-name-error' : undefined}
          placeholder="Company name"
        />
        {errors.name && (
          <p id="client-name-error" className="text-[12px] text-destructive">
            {errors.name}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="client-contact">Contact name</Label>
          <Input
            id="client-contact"
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            placeholder="Primary contact"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="client-phone">Phone</Label>
          <Input
            id="client-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+91 …"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="client-email">Email</Label>
        <Input
          id="client-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          aria-invalid={!!errors.email}
          placeholder="billing@example.com"
        />
        {errors.email && (
          <p className="text-[12px] text-destructive">{errors.email}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="client-city">City</Label>
          <Input
            id="client-city"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="Mumbai"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="client-state">State</Label>
          <Input
            id="client-state"
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
            placeholder="Maharashtra"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="client-pincode">Pincode</Label>
          <Input
            id="client-pincode"
            value={form.pincode}
            onChange={(e) => setForm({ ...form, pincode: e.target.value })}
            aria-invalid={!!errors.pincode}
            placeholder="400001"
          />
          {errors.pincode && (
            <p className="text-[12px] text-destructive">{errors.pincode}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="client-credit">Credit terms (days)</Label>
          <Input
            id="client-credit"
            type="number"
            min={0}
            max={365}
            value={form.creditTermsDays}
            onChange={(e) => setForm({ ...form, creditTermsDays: e.target.value })}
            placeholder="30"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="client-address1">Address line 1</Label>
        <Input
          id="client-address1"
          value={form.addressLine1}
          onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
          placeholder="Street address"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="client-address2">Address line 2</Label>
        <Input
          id="client-address2"
          value={form.addressLine2}
          onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
          placeholder="Suite, floor, etc."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="client-gstin">GSTIN</Label>
        <Input
          id="client-gstin"
          value={form.gstin}
          onChange={(e) => setForm({ ...form, gstin: e.target.value })}
          aria-invalid={!!errors.gstin}
          placeholder="27AAAAA0000A1Z5"
          className="font-identifier"
        />
        {errors.gstin && (
          <p className="text-[12px] text-destructive">{errors.gstin}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <LoadingButton type="submit" loading={submitting}>
          {submitLabel}
        </LoadingButton>
      </div>
    </form>
  );
}
