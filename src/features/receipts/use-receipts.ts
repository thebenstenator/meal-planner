import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useHousehold } from '@/features/household/use-household';
import {
  deleteTrip,
  listTrips,
  parseReceiptImages,
  receiptKeys,
  saveTrip,
  toReceiptDrafts,
  type ParsedReceipt,
  type ReceiptLineDraft,
  type SaveTripInput,
} from '@/features/receipts/api';

export interface ScanResult {
  parsed: ParsedReceipt;
  drafts: ReceiptLineDraft[];
}

/** Scan receipt photos → parsed receipt + matched, reviewable line drafts. */
export function useScanReceipt() {
  const { householdId } = useHousehold();
  return useMutation<ScanResult, Error, { media_type: string; data: string }[]>({
    mutationFn: async (images) => {
      const id = householdId as string;
      const parsed = await parseReceiptImages(id, images);
      const drafts = await toReceiptDrafts(id, parsed);
      return { parsed, drafts };
    },
  });
}

export function useTrips() {
  const { householdId } = useHousehold();
  return useQuery({
    queryKey: receiptKeys.trips(householdId ?? 'none'),
    queryFn: () => listTrips(householdId as string),
    enabled: !!householdId,
  });
}

function useInvalidateSpend() {
  const qc = useQueryClient();
  const { householdId } = useHousehold();
  return () => {
    void qc.invalidateQueries({ queryKey: receiptKeys.trips(householdId ?? 'none') });
    void qc.invalidateQueries({ queryKey: ['trip-totals'] });
    void qc.invalidateQueries({ queryKey: ['spend-history'] });
    void qc.invalidateQueries({ queryKey: ['month-checked-items'] });
    void qc.invalidateQueries({ queryKey: ['current-prices'] });
  };
}

export function useSaveTrip() {
  const { householdId } = useHousehold();
  const invalidate = useInvalidateSpend();
  return useMutation<string, Error, SaveTripInput>({
    mutationFn: (input) => saveTrip(householdId as string, input),
    onSuccess: invalidate,
  });
}

export function useDeleteTrip() {
  const invalidate = useInvalidateSpend();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteTrip(id),
    onSuccess: invalidate,
  });
}
