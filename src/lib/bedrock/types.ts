import type { SystemType } from '@/lib/diagram/types'

// ─── Bedrock Systems (Logical + Physical) ──────────────
// A "Logical Bedrock System" is one of the data-architecture Systems palette
// categories (SystemType). Each carries an editable set of "Physical Systems"
// (concrete products). Together they define the org's best-of-breed platform
// architecture, which grounds the AI-generated data integration diagrams.

export interface BedrockSystem {
  id: string
  organization_id: string
  system_type: SystemType
  label: string
  description: string | null
  color: string | null
  sort_order: number
  // Primary value stream (first of workstream_ids) — drives the banded layout.
  workstream_id?: string | null
  // All value streams this logical system is aligned to (036).
  workstream_ids?: string[] | null
  is_standard: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface BedrockPhysicalSystem {
  id: string
  bedrock_system_id: string
  name: string
  vendor: string | null
  is_primary: boolean
  sort_order: number
  created_at: string
}

export interface BedrockSystemWithPhysicals extends BedrockSystem {
  physicals: BedrockPhysicalSystem[]
}

// Default physical-system assignments seeded per category. First entry per
// category becomes is_primary. Sourced from the AI route's systemType->physical
// mapping plus A&D/GovCon best-of-breed defaults for the categories the prompt
// doesn't cover. `custom` seeds none.
export const DEFAULT_PHYSICAL_SYSTEMS: Record<SystemType, { name: string; vendor?: string }[]> = {
  erp: [
    { name: 'SAP S/4HANA', vendor: 'SAP' },
    { name: 'SAP ECC', vendor: 'SAP' },
    { name: 'Oracle E-Business Suite', vendor: 'Oracle' },
    { name: 'Deltek Costpoint', vendor: 'Deltek' },
    { name: 'Dassian', vendor: 'Dassian' },
  ],
  crm: [
    { name: 'Salesforce', vendor: 'Salesforce' },
    { name: 'Microsoft Dynamics 365', vendor: 'Microsoft' },
    { name: 'SAP CRM', vendor: 'SAP' },
  ],
  plm: [
    { name: 'Siemens Teamcenter', vendor: 'Siemens' },
    { name: 'PTC Windchill', vendor: 'PTC' },
    { name: 'Dassault ENOVIA', vendor: 'Dassault Systèmes' },
  ],
  scm: [
    { name: 'SAP SCM', vendor: 'SAP' },
    { name: 'Kinaxis RapidResponse', vendor: 'Kinaxis' },
    { name: 'Oracle SCM Cloud', vendor: 'Oracle' },
  ],
  middleware: [
    { name: 'SAP Integration Suite (CPI)', vendor: 'SAP' },
    { name: 'MuleSoft', vendor: 'Salesforce' },
    { name: 'Dell Boomi', vendor: 'Boomi' },
    { name: 'SAP PI/PO', vendor: 'SAP' },
  ],
  database: [
    { name: 'SAP HANA', vendor: 'SAP' },
    { name: 'Oracle Database', vendor: 'Oracle' },
    { name: 'Microsoft SQL Server', vendor: 'Microsoft' },
    { name: 'PostgreSQL', vendor: 'PostgreSQL' },
  ],
  data_warehouse: [
    { name: 'Snowflake', vendor: 'Snowflake' },
    { name: 'SAP BW/4HANA', vendor: 'SAP' },
    { name: 'Databricks', vendor: 'Databricks' },
    { name: 'Azure Synapse', vendor: 'Microsoft' },
  ],
  analytics: [
    { name: 'SAP Analytics Cloud', vendor: 'SAP' },
    { name: 'Microsoft Power BI', vendor: 'Microsoft' },
    { name: 'Tableau', vendor: 'Salesforce' },
  ],
  mes: [
    { name: 'SAP Digital Manufacturing', vendor: 'SAP' },
    { name: 'Siemens Opcenter', vendor: 'Siemens' },
    { name: 'Rockwell FactoryTalk', vendor: 'Rockwell Automation' },
  ],
  clm: [
    { name: 'Dassian', vendor: 'Dassian' },
    { name: 'Icertis', vendor: 'Icertis' },
    { name: 'SAP CLM', vendor: 'SAP' },
    { name: 'Conga CLM', vendor: 'Conga' },
  ],
  cloud: [
    { name: 'Microsoft Azure', vendor: 'Microsoft' },
    { name: 'AWS', vendor: 'Amazon' },
    { name: 'Google Cloud', vendor: 'Google' },
  ],
  legacy: [
    { name: 'Mainframe', vendor: 'IBM' },
    { name: 'AS/400 (IBM i)', vendor: 'IBM' },
    { name: 'Custom Legacy', vendor: 'In-house' },
  ],
  ppm: [
    { name: 'SAP PPM', vendor: 'SAP' },
    { name: 'Planview', vendor: 'Planview' },
    { name: 'Microsoft Project for the Web', vendor: 'Microsoft' },
  ],
  ims: [
    { name: 'Oracle Primavera P6', vendor: 'Oracle' },
    { name: 'Microsoft Project', vendor: 'Microsoft' },
    { name: 'Deltek Open Plan', vendor: 'Deltek' },
  ],
  siop: [
    { name: 'Kinaxis RapidResponse', vendor: 'Kinaxis' },
    { name: 'SAP IBP', vendor: 'SAP' },
    { name: 'o9 Solutions', vendor: 'o9 Solutions' },
  ],
  mps: [
    { name: 'SAP PP/DS', vendor: 'SAP' },
    { name: 'SAP S/4HANA (MRP Live)', vendor: 'SAP' },
    { name: 'Kinaxis RapidResponse', vendor: 'Kinaxis' },
  ],
  hcm: [
    { name: 'SAP SuccessFactors', vendor: 'SAP' },
    { name: 'Workday', vendor: 'Workday' },
    { name: 'Oracle HCM Cloud', vendor: 'Oracle' },
    { name: 'Deltek Costpoint (Labor)', vendor: 'Deltek' },
  ],
  fpa: [
    { name: 'SAP Analytics Cloud (Planning)', vendor: 'SAP' },
    { name: 'Anaplan', vendor: 'Anaplan' },
    { name: 'OneStream', vendor: 'OneStream' },
  ],
  custom: [],
}
