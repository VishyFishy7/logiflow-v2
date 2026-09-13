"use client";

/**
 * §14.4 New shipment page.
 *
 * A full-page form for creating a shipment. Redirects to the new shipment's
 * detail page on success. Uses the ShipmentForm component and validates
 * against zShipmentCreateInput.
 */
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/page-header";
import { useCreateShipment } from "@/lib/api/queries";
import { ShipmentForm, type ShipmentFormValues } from "@/components/features/shipments/shipment-form";
import { toast } from "sonner";

export default function NewShipmentPage() {
  const router = useRouter();
  const create = useCreateShipment();

  const handleSubmit = (values: ShipmentFormValues) => {
    create.mutate(
      { input: values },
      {
        onSuccess: (data) => {
          const shipment = data?.data;
          const label = shipment?.trackingId?.value ?? "Shipment";
          toast.success(`${label} created`);
          if (shipment?.id) {
            router.push(`/shipments/${shipment.id}`);
          } else {
            router.push("/shipments");
          }
        },
        onError: (error) => {
          toast.error(error.message || "Failed to create shipment");
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="New shipment"
        description="Create a new consignment and hand it to a carrier."
        back={
          <Link
            href="/shipments"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Shipments
          </Link>
        }
      />

      <SectionCard>
        <ShipmentForm
          onSubmit={handleSubmit}
          onCancel={() => router.push("/shipments")}
          loading={create.isPending}
        />
      </SectionCard>
    </div>
  );
}
