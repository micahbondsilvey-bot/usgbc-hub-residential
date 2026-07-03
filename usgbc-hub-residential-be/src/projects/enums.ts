/** Definitive Unit 3 enumerations (domain-entities.md). */

export enum ProjectStatus {
  DRAFT = 'DRAFT',
  REGISTERED = 'REGISTERED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  CERTIFIED = 'CERTIFIED',
  DENIED = 'DENIED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum MembershipLevel {
  USGBC_MEMBER = 'USGBC_MEMBER',
  NON_MEMBER = 'NON_MEMBER',
}

export enum BuildingType {
  SINGLE_FAMILY_DETACHED = 'SINGLE_FAMILY_DETACHED',
  SINGLE_FAMILY_ATTACHED = 'SINGLE_FAMILY_ATTACHED',
  TOWNHOUSE = 'TOWNHOUSE',
}

export enum PaymentChoice {
  PAY_NOW = 'PAY_NOW',
  PAY_LATER = 'PAY_LATER',
}

export enum InvoiceStatus {
  PAID = 'PAID',
  UNPAID = 'UNPAID',
}

export enum BulkRowStatus {
  PENDING = 'PENDING',
  CREATED = 'CREATED',
  FAILED = 'FAILED',
}
