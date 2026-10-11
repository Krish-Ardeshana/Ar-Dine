export class ValidatedOrderItemResponseDto {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  specialInstructions?: string;
}

export class OrderValidationResultDto {
  valid: boolean;
  canSubmitInPhase6: boolean;
  message: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  items: ValidatedOrderItemResponseDto[];
}
