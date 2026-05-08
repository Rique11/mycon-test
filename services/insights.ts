/**
 * insights.ts — Tipos e interfaces para análises financeiras dos clientes.
 */

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type Confidence = 'high' | 'medium' | 'low';

export interface PortabilityOpportunity {
  kind: string;
  institution: string;
  outstandingBalance: number;
  monthlyPayment?: number;
  remainingMonths?: number;
  contractedRateMonthly?: number;
  benchmarkInternalRateMonthly?: number;
  estimatedAnnualSavings?: number;
  description: string;
  confidence: Confidence;
}

export interface InstitutionShare {
  institution: string;
  balance: number;
  share: number;
  isInternal: boolean;
}

export interface ShareOfWallet {
  totalAssets: number;
  internalAssets: number;
  externalAssets: number;
  internalShare: number;
  byInstitution: InstitutionShare[];
  primarySalaryBank?: string;
  primaryCardSpendBank?: string;
  unifyOpportunity: boolean;
  unifyRationale: string;
}

export interface MerchantBreakdownItem {
  name: string;
  total: number;
}

export interface MonthlyCashFlow {
  month: string;
  income: number;
  expenses: number;
  surplus: number;
  byCategory: Array<{
    category: string;
    label: string;
    total: number;
    merchantBreakdown: MerchantBreakdownItem[];
  }>;
  incomeBreakdown: MerchantBreakdownItem[];
}

export interface FreeCashFlow {
  monthsAnalyzed: number;
  averageMonthlyIncome: number;
  averageFixedExpenses: number;
  averageVariableExpenses: number;
  averageFreeCashFlow: number;
  recommendedAutoInvest: number;
  monthlyBreakdown: MonthlyCashFlow[];
  incomeDetected: boolean;
  confidence: 'low' | 'medium' | 'high';
}

export interface IdleCashSource {
  institution: string;
  product: string;
  balance: number;
}

export interface PortfolioOptimization {
  totalInvested: number;
  idleCashTotal: number;
  idleCashSources: IdleCashSource[];
  byClass: Array<{ class: string; balance: number; share: number }>;
  overconcentration: Array<{ class: string; share: number; recommendation: string }>;
  diversificationScore: number;
}

export interface LifeEvent {
  type: string;
  detectedAt: string;
  severity: 'info' | 'opportunity' | 'urgent';
  evidence: string;
  suggestedProduct: string;
}

export interface CreditRiskAlert {
  totalExternalCardLimit: number;
  totalExternalCardUsed: number;
  externalUtilization: number;
  estimatedMonthlyIncome: number;
  commitmentRatio: number;
  riskLevel: RiskLevel;
  flags: string[];
}

export type ExpenseCategory =
  | 'alimentacao'
  | 'transporte'
  | 'saude'
  | 'lazer'
  | 'educacao'
  | 'moradia'
  | 'vestuario'
  | 'tecnologia'
  | 'servicos'
  | 'viagens'
  | 'financeiro'
  | 'consorcio'
  | 'investimento'
  | 'transferencia'
  | 'outros';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  alimentacao: 'Alimentação',
  transporte: 'Transporte',
  saude: 'Saúde',
  lazer: 'Lazer',
  educacao: 'Educação',
  moradia: 'Moradia',
  vestuario: 'Vestuário',
  tecnologia: 'Tecnologia',
  servicos: 'Serviços',
  viagens: 'Viagens',
  financeiro: 'Financeiro',
  consorcio: 'Consórcio',
  investimento: 'Investimentos',
  transferencia: 'Transferências entre contas',
  outros: 'Outros',
};

export interface ExpenseCategoryItem {
  category: string;
  label: string;
  total: number;
  share: number;
  transactionCount: number;
  topMerchants: string[];
  merchantBreakdown: MerchantBreakdownItem[];
  isCustom?: boolean;
}
