// AUTO-GENERATED SNAPSHOT — SAP Enterprise Data Model (controlling area A000)
// Source: live pull from the connected S/4HANA sandbox (vhcals4hcs, client 100) via the
// SAP-Vibe MCP server, class ZCL_M12_ORG_MODEL_DUMP, on 2026-06-26.
// This is real configuration data, not mock data. Regenerate by re-running the dump class.
import type { SapEnterpriseModel } from './types'

export const SAP_ENTERPRISE_MODEL: SapEnterpriseModel = {
  "source": {
    "system": "vhcals4hcs (S/4HANA CAL sandbox)",
    "client": "100",
    "controllingArea": "A000",
    "pulledOn": "2026-06-26",
    "via": "SAP-Vibe MCP → ZCL_M12_ORG_MODEL_DUMP"
  },
  "controllingArea": {
    "kokrs": "A000",
    "name": "Controlling Area A000",
    "currency": "USD",
    "chart": "YCOA",
    "fiscalVar": "K4"
  },
  "companyCodes": [
    {
      "bukrs": "1710",
      "name": "Company Code 1710",
      "country": "US",
      "currency": "USD",
      "chart": "YCOA",
      "plantCount": 6,
      "profitCenterCount": 18,
      "costCenterCount": 110,
      "wbsRaCount": 142,
      "salesOrgs": [
        "1710",
        "FOBP",
        "FORP"
      ],
      "purchasingOrgs": [
        "1710",
        "FLPO",
        "FOBP",
        "FORP"
      ]
    },
    {
      "bukrs": "1010",
      "name": "Company Code 1010",
      "country": "DE",
      "currency": "EUR",
      "chart": "YCOA",
      "plantCount": 1,
      "profitCenterCount": 1,
      "costCenterCount": 26,
      "wbsRaCount": 2,
      "salesOrgs": [
        "1010"
      ],
      "purchasingOrgs": [
        "1010"
      ]
    },
    {
      "bukrs": "1500",
      "name": "GB Company Code",
      "country": "GB",
      "currency": "GBP",
      "chart": "YCOA",
      "plantCount": 1,
      "profitCenterCount": 18,
      "costCenterCount": 2,
      "wbsRaCount": 2,
      "salesOrgs": [
        "1500"
      ],
      "purchasingOrgs": []
    },
    {
      "bukrs": "5070",
      "name": "Company Code 5070",
      "country": "US",
      "currency": "USD",
      "chart": "YCOA",
      "plantCount": 1,
      "profitCenterCount": 12,
      "costCenterCount": 2,
      "wbsRaCount": 5,
      "salesOrgs": [
        "5070"
      ],
      "purchasingOrgs": []
    },
    {
      "bukrs": "6050",
      "name": "Company Code 6050",
      "country": "US",
      "currency": "USD",
      "chart": "YCOA",
      "plantCount": 1,
      "profitCenterCount": 12,
      "costCenterCount": 3,
      "wbsRaCount": 0,
      "salesOrgs": [
        "6050"
      ],
      "purchasingOrgs": []
    }
  ],
  "plants": [
    {
      "werks": "1010",
      "name": "Plant 1 DE",
      "bukrs": "1010",
      "storageLocations": [
        "0001",
        "101A",
        "101B",
        "101C",
        "101D",
        "101E",
        "101F",
        "101H",
        "101Q",
        "101R",
        "101S",
        "101T",
        "101V"
      ]
    },
    {
      "werks": "1500",
      "name": "Plant 1 GB",
      "bukrs": "1500",
      "storageLocations": []
    },
    {
      "werks": "1710",
      "name": "Plant 1 US",
      "bukrs": "1710",
      "storageLocations": [
        "171A",
        "171B",
        "171C",
        "171D",
        "171E",
        "171F",
        "171H",
        "171Q",
        "171R",
        "171S",
        "171T",
        "171V",
        "VAN1"
      ]
    },
    {
      "werks": "1720",
      "name": "Plant 2 US",
      "bukrs": "1710",
      "storageLocations": [
        "172A"
      ]
    },
    {
      "werks": "2000",
      "name": "MOOG US Plant A",
      "bukrs": "1710",
      "storageLocations": [
        "0001"
      ]
    },
    {
      "werks": "2010",
      "name": "MOOG US Plant B",
      "bukrs": "1710",
      "storageLocations": []
    },
    {
      "werks": "FOBP",
      "name": "Plant 3 US (Base Plant)",
      "bukrs": "1710",
      "storageLocations": [
        "FOBN",
        "FOBW"
      ]
    },
    {
      "werks": "FORP",
      "name": "Plant 2 US (Remote Plant)",
      "bukrs": "1710",
      "storageLocations": [
        "FORN"
      ]
    },
    {
      "werks": "5070",
      "name": "Plant 1 US",
      "bukrs": "5070",
      "storageLocations": []
    },
    {
      "werks": "6050",
      "name": "Plant 1 US",
      "bukrs": "6050",
      "storageLocations": []
    }
  ],
  "salesOrgs": [
    {
      "vkorg": "1010",
      "name": "Dom. Sales Org DE",
      "bukrs": "1010"
    },
    {
      "vkorg": "1500",
      "name": "Fluor Limited UK",
      "bukrs": "1500"
    },
    {
      "vkorg": "1710",
      "name": "Dom. Sales Org US",
      "bukrs": "1710"
    },
    {
      "vkorg": "FOBP",
      "name": "Sales Org. FOBP",
      "bukrs": "1710"
    },
    {
      "vkorg": "FORP",
      "name": "Sales Org. FORP",
      "bukrs": "1710"
    },
    {
      "vkorg": "5070",
      "name": "MX",
      "bukrs": "5070"
    },
    {
      "vkorg": "6050",
      "name": "MD",
      "bukrs": "6050"
    }
  ],
  "purchasingOrgs": [
    {
      "ekorg": "1010",
      "name": "Purch. Org. 1010",
      "bukrs": "1010",
      "plants": [
        "1010"
      ]
    },
    {
      "ekorg": "1710",
      "name": "Purch. Org. 1710",
      "bukrs": "1710",
      "plants": [
        "1710",
        "1720",
        "2000"
      ]
    },
    {
      "ekorg": "FLPO",
      "name": "Purch. Org. FLPO",
      "bukrs": "1710",
      "plants": [
        "FOBP",
        "FORP"
      ]
    },
    {
      "ekorg": "FOBP",
      "name": "Purch. Org. FOBP",
      "bukrs": "1710",
      "plants": [
        "FOBP"
      ]
    },
    {
      "ekorg": "FORP",
      "name": "Purch. Org. FORP",
      "bukrs": "1710",
      "plants": [
        "FORP"
      ]
    }
  ],
  "businessAreas": [
    {
      "gsber": "0001",
      "name": "Business area 0001",
      "used": false
    }
  ],
  "profitCenters": {
    "byCompanyCode": {
      "1010": 1,
      "1500": 18,
      "1710": 18,
      "5070": 12,
      "6050": 12
    },
    "total": 120,
    "sample": [
      {
        "prctr": "0100000001",
        "name": "Home Office"
      },
      {
        "prctr": "0110000001",
        "name": "737 Profit Center"
      },
      {
        "prctr": "0110000002",
        "name": "787 Profit Center"
      },
      {
        "prctr": "0111000001",
        "name": "BCA Group Office"
      },
      {
        "prctr": "0120000001",
        "name": "BDS Group Office"
      },
      {
        "prctr": "0121000001",
        "name": "BDS DIV1 Group Off"
      },
      {
        "prctr": "0121000002",
        "name": "Program A PC"
      },
      {
        "prctr": "0121000003",
        "name": "Program B PC"
      },
      {
        "prctr": "0122000001",
        "name": "BDS DIV2 Group Off"
      },
      {
        "prctr": "0122000002",
        "name": "Program C PC"
      },
      {
        "prctr": "0131000001",
        "name": "BGS Commercial"
      },
      {
        "prctr": "0132000001",
        "name": "BGS Def Group Off"
      },
      {
        "prctr": "0133000001",
        "name": "BGS Def Div1 Grp"
      },
      {
        "prctr": "0133000002",
        "name": "Program C PC"
      },
      {
        "prctr": "QCHECK",
        "name": "Quality Check"
      },
      {
        "prctr": "T-PCB98",
        "name": "Production Logistics"
      }
    ]
  },
  "costCenters": {
    "byCompanyCode": {
      "1010": 26,
      "1500": 2,
      "1710": 110,
      "5070": 2,
      "6050": 3
    },
    "total": 143,
    "sample": [
      {
        "kostl": "12876",
        "name": "Quality - UK",
        "bukrs": "1710",
        "prctr": "0121000001"
      },
      {
        "kostl": "12878",
        "name": "Proj Mgmt-FB",
        "bukrs": "1710",
        "prctr": "0121000001"
      },
      {
        "kostl": "12881",
        "name": "Proj Ctrls-FB",
        "bukrs": "1710",
        "prctr": "0121000001"
      },
      {
        "kostl": "10101101",
        "name": "Financials (DE)",
        "bukrs": "1010",
        "prctr": "YB600"
      },
      {
        "kostl": "10101201",
        "name": "Purch &amp; Store 1 (DE)",
        "bukrs": "1010",
        "prctr": "YB700"
      },
      {
        "kostl": "10101202",
        "name": "Purch &amp; Store 2 (DE)",
        "bukrs": "1010",
        "prctr": "YB700"
      },
      {
        "kostl": "15001303",
        "name": "Con Field Staff",
        "bukrs": "1500",
        "prctr": "YB110"
      },
      {
        "kostl": "15001304",
        "name": "Con Field Staff",
        "bukrs": "1500",
        "prctr": "YB110"
      },
      {
        "kostl": "51000003",
        "name": "BDS Fringe",
        "bukrs": "5070",
        "prctr": "0120000001"
      },
      {
        "kostl": "53000001",
        "name": "BDS Elec Eng",
        "bukrs": "5070",
        "prctr": "0121000002"
      },
      {
        "kostl": "51000004",
        "name": "BGS Fringe",
        "bukrs": "6050",
        "prctr": "0132000001"
      },
      {
        "kostl": "53000000",
        "name": "AuO Engineering",
        "bukrs": "6050",
        "prctr": "0132000001"
      },
      {
        "kostl": "53000002",
        "name": "BGS Elec Eng",
        "bukrs": "6050",
        "prctr": "0133000002"
      }
    ]
  },
  "raKeys": [
    {
      "key": "Y00001",
      "count": 117,
      "levels": {
        "2": 114,
        "3": 3
      },
      "label": "Customer RA key (chart YCOA) — primary revenue-recognition key"
    },
    {
      "key": "000001",
      "count": 24,
      "levels": {
        "1": 22,
        "2": 2
      },
      "label": "SAP standard Results Analysis key"
    },
    {
      "key": "YM1205",
      "count": 6,
      "levels": {
        "1": 2,
        "2": 4
      },
      "label": "Customer RA key (chart YCOA) — Performance Obligation (POB) revenue recognition"
    },
    {
      "key": "Y00005",
      "count": 4,
      "levels": {
        "1": 1,
        "2": 2,
        "3": 1
      },
      "label": "Customer RA key (chart YCOA) — MRO / settlement scenarios"
    }
  ],
  "raByCompanyCode": [
    {
      "bukrs": "1710",
      "count": 142,
      "keys": {
        "Y00001": 108,
        "YM1205": 6,
        "Y00005": 4,
        "000001": 24
      },
      "levels": {
        "L2": 115,
        "L1": 25,
        "L3": 2
      }
    },
    {
      "bukrs": "1010",
      "count": 2,
      "keys": {
        "Y00001": 2
      },
      "levels": {
        "L2": 2
      }
    },
    {
      "bukrs": "1500",
      "count": 2,
      "keys": {
        "Y00001": 2
      },
      "levels": {
        "L2": 1,
        "L3": 1
      }
    },
    {
      "bukrs": "5070",
      "count": 5,
      "keys": {
        "Y00001": 5
      },
      "levels": {
        "L2": 4,
        "L3": 1
      }
    }
  ],
  "raProjects": [
    {
      "project": "U1BW",
      "name": "Umicore Poland Wave3S Blue Wave 1",
      "bukrs": "1710",
      "wbsCount": 28,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "UZ1BW",
      "name": "Umicore Wave3S Blue Wave 1 (Contract)",
      "bukrs": "1710",
      "wbsCount": 14,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "A0003",
      "name": "Nebula",
      "bukrs": "1710",
      "wbsCount": 7,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "A0007",
      "name": "Starship Enterprise",
      "bukrs": "1710",
      "wbsCount": 7,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "A0011",
      "name": "Rover Landing",
      "bukrs": "1710",
      "wbsCount": 7,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "A0005",
      "name": "FA1234-02-C-8855 - Jan Demo -",
      "bukrs": "1710",
      "wbsCount": 6,
      "keys": [
        "Y00001",
        "YM1205"
      ]
    },
    {
      "project": "H E17800641",
      "name": "UB1F",
      "bukrs": "1710",
      "wbsCount": 6,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "U1RY",
      "name": "Fluor Demo Intercompany PoC -",
      "bukrs": "1710",
      "wbsCount": 5,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "H E17799200",
      "name": "UB1W",
      "bukrs": "1710",
      "wbsCount": 4,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "H E17800026",
      "name": "UB1Z",
      "bukrs": "1710",
      "wbsCount": 4,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "U1CM",
      "name": "Fluor Change Management Test",
      "bukrs": "1710",
      "wbsCount": 4,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "H F17799200",
      "name": "UB1W",
      "bukrs": "1710",
      "wbsCount": 3,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "VMOG-00001",
      "name": "V-MOG Build Project -00001",
      "bukrs": "1710",
      "wbsCount": 3,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "D-0026",
      "name": "Inter Segment Processing - 234",
      "bukrs": "5070",
      "wbsCount": 2,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "H EFULLTREA",
      "name": "FULL-TREE-A",
      "bukrs": "1710",
      "wbsCount": 2,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "M12G",
      "name": "Test C",
      "bukrs": "1710",
      "wbsCount": 2,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M12H",
      "name": "Moog Demo POC",
      "bukrs": "1710",
      "wbsCount": 2,
      "keys": [
        "000001",
        "YM1205"
      ]
    },
    {
      "project": "M12I",
      "name": "Moog Test Project 1",
      "bukrs": "1710",
      "wbsCount": 2,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M12J",
      "name": "Moog Demo Day Project 1",
      "bukrs": "1710",
      "wbsCount": 2,
      "keys": [
        "000001",
        "YM1205"
      ]
    },
    {
      "project": "M12K",
      "name": "Moog Demo Day Project 1",
      "bukrs": "1710",
      "wbsCount": 2,
      "keys": [
        "000001",
        "YM1205"
      ]
    },
    {
      "project": "U1RZ",
      "name": "RY - Umicore Pre-Feed Test",
      "bukrs": "1010",
      "wbsCount": 2,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "X U1BW",
      "name": "Umicore Wave3S Blue Wave 1 - Execution",
      "bukrs": "1710",
      "wbsCount": 2,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "A0020",
      "name": "Project Definition A-0020",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "A0111",
      "name": "FA1234-02-C-8855 - Jan Demo -",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00005"
      ]
    },
    {
      "project": "A0112",
      "name": "Project Definition A-0112",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00005"
      ]
    },
    {
      "project": "A0115",
      "name": "Test MRO Settlement/RA",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00005"
      ]
    },
    {
      "project": "D-0002",
      "name": "Project Definition D-0002",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "D-0006",
      "name": "Contract VBAT XXXX Accounting Project",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "D-0020",
      "name": "Inter Segment Processing - 234",
      "bukrs": "5070",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "D-0021",
      "name": "Contract VBAT XXXX Accounting Project",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "D-0022",
      "name": "Contract VBAT XXXX Accounting Project",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "D-0023",
      "name": "Contract VBAT XXXX Accounting Project",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "D-0024",
      "name": "Contract VBAT XXXX Accounting Project",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "D-0025",
      "name": "PP TEST 03 - 0123",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "D0016",
      "name": "Demo Project 1",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "H EASYNC1TS",
      "name": "ASYNC-TEST-1",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "H ETREE02TS",
      "name": "TREE-TEST-02",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00001"
      ]
    },
    {
      "project": "M12-T1",
      "name": "Mach12 Servovalve Test",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M120",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M121",
      "name": "M121",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M122",
      "name": "M122",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M123",
      "name": "M123",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M124",
      "name": "M124",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M125",
      "name": "M125",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M126",
      "name": "M126",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M127",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M128",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M129",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M12A",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M12B",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M12C",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M12D",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M12E",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "YM1205"
      ]
    },
    {
      "project": "M12F",
      "name": "Test 6",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "YM1205"
      ]
    },
    {
      "project": "M12T",
      "name": "M12T",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "M12U",
      "name": "M12U",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "000001"
      ]
    },
    {
      "project": "WW-BOUSA",
      "name": "Boeing_JDAM_USA Project",
      "bukrs": "1710",
      "wbsCount": 1,
      "keys": [
        "Y00005"
      ]
    }
  ],
  "assignments": [
    {
      "relationship": "Controlling Area → Company Code",
      "via": "TKA02 (assign company code to controlling area)",
      "count": 5,
      "note": "1:N — one CO area spans many company codes; FI/CO integration on (TKA01-KOKFI)"
    },
    {
      "relationship": "Company Code → Plant",
      "via": "T001K (valuation area) → T001W",
      "count": 10,
      "note": "Plant assigned to company code through its valuation area"
    },
    {
      "relationship": "Plant → Storage Location",
      "via": "T001L",
      "count": 31,
      "note": "Inventory-managing sub-locations within a plant"
    },
    {
      "relationship": "Company Code → Sales Organization",
      "via": "TVKO",
      "count": 7,
      "note": "Each sales org posts to exactly one company code"
    },
    {
      "relationship": "Company Code → Purchasing Organization",
      "via": "T024E (+ T024W plant assignment)",
      "count": 5,
      "note": "Purch. org can be company-code-specific or cross-company"
    },
    {
      "relationship": "Controlling Area → Profit Center",
      "via": "CEPC / CEPC_BUKRS (company-code assignment)",
      "count": 120,
      "note": "Profit centers live at CO-area level, assigned to company codes"
    },
    {
      "relationship": "Controlling Area → Cost Center",
      "via": "CSKS (carries BUKRS + PRCTR)",
      "count": 143,
      "note": "Each cost center ties to one company code and one profit center"
    },
    {
      "relationship": "Controlling Area → Business Area",
      "via": "TGSB (global, cross-company)",
      "count": 1,
      "note": "Business areas are client-wide, not company-code-scoped"
    },
    {
      "relationship": "Company Code → Project / WBS",
      "via": "PROJ-VBUKR / PRPS-PBUKR",
      "count": 57,
      "note": "57 projects carry RA-keyed WBS in A000"
    },
    {
      "relationship": "WBS → Revenue Recognition (RA)",
      "via": "PRPS-ABGSL (Results Analysis key)",
      "count": 151,
      "note": "RA key set on the WBS element marks the revenue-recognition / results-analysis level"
    }
  ],
  "profitCentersByCompanyCode": {
    "1010": [
      {
        "prctr": "YB902",
        "name": "Dummy Text"
      }
    ],
    "1500": [
      {
        "prctr": "0100000001",
        "name": "Home Office"
      },
      {
        "prctr": "0110000001",
        "name": "737 Profit Center"
      },
      {
        "prctr": "0111000001",
        "name": "BCA Group Office"
      },
      {
        "prctr": "0120000001",
        "name": "BDS Group Office"
      },
      {
        "prctr": "0121000001",
        "name": "BDS DIV1 Group Off"
      },
      {
        "prctr": "0121000002",
        "name": "Program A PC"
      },
      {
        "prctr": "0121000003",
        "name": "Program B PC"
      },
      {
        "prctr": "0122000001",
        "name": "BDS DIV2 Group Off"
      },
      {
        "prctr": "0122000002",
        "name": "Program C PC"
      },
      {
        "prctr": "0131000001",
        "name": "BGS Commercial"
      },
      {
        "prctr": "0132000001",
        "name": "BGS Def Group Off"
      },
      {
        "prctr": "0133000001",
        "name": "BGS Def Div1 Grp"
      },
      {
        "prctr": "0133000002",
        "name": "Program C PC"
      },
      {
        "prctr": "YB110",
        "name": "Product A"
      },
      {
        "prctr": "YB903",
        "name": "Profit center"
      },
      {
        "prctr": "YB907",
        "name": "Profit Center 7"
      },
      {
        "prctr": "YB908",
        "name": "Profit Center 8"
      },
      {
        "prctr": "YB909",
        "name": "Profit Center 9"
      }
    ],
    "1710": [
      {
        "prctr": "0100000001",
        "name": "Home Office"
      },
      {
        "prctr": "0110000001",
        "name": "737 Profit Center"
      },
      {
        "prctr": "0111000001",
        "name": "BCA Group Office"
      },
      {
        "prctr": "0120000001",
        "name": "BDS Group Office"
      },
      {
        "prctr": "0121000001",
        "name": "BDS DIV1 Group Off"
      },
      {
        "prctr": "0121000002",
        "name": "Program A PC"
      },
      {
        "prctr": "0121000003",
        "name": "Program B PC"
      },
      {
        "prctr": "0122000001",
        "name": "BDS DIV2 Group Off"
      },
      {
        "prctr": "0122000002",
        "name": "Program C PC"
      },
      {
        "prctr": "0131000001",
        "name": "BGS Commercial"
      },
      {
        "prctr": "0132000001",
        "name": "BGS Def Group Off"
      },
      {
        "prctr": "0133000001",
        "name": "BGS Def Div1 Grp"
      },
      {
        "prctr": "0133000002",
        "name": "Program C PC"
      },
      {
        "prctr": "YB110",
        "name": "Product A"
      },
      {
        "prctr": "YB903",
        "name": "Profit center"
      },
      {
        "prctr": "YB907",
        "name": "Profit Center 7"
      },
      {
        "prctr": "YB908",
        "name": "Profit Center 8"
      },
      {
        "prctr": "YB909",
        "name": "Profit Center 9"
      }
    ],
    "5070": [
      {
        "prctr": "0110000001",
        "name": "737 Profit Center"
      },
      {
        "prctr": "0111000001",
        "name": "BCA Group Office"
      },
      {
        "prctr": "0120000001",
        "name": "BDS Group Office"
      },
      {
        "prctr": "0121000001",
        "name": "BDS DIV1 Group Off"
      },
      {
        "prctr": "0121000002",
        "name": "Program A PC"
      },
      {
        "prctr": "0121000003",
        "name": "Program B PC"
      },
      {
        "prctr": "0122000001",
        "name": "BDS DIV2 Group Off"
      },
      {
        "prctr": "0122000002",
        "name": "Program C PC"
      },
      {
        "prctr": "0131000001",
        "name": "BGS Commercial"
      },
      {
        "prctr": "0132000001",
        "name": "BGS Def Group Off"
      },
      {
        "prctr": "0133000001",
        "name": "BGS Def Div1 Grp"
      },
      {
        "prctr": "0133000002",
        "name": "Program C PC"
      }
    ],
    "6050": [
      {
        "prctr": "0110000001",
        "name": "737 Profit Center"
      },
      {
        "prctr": "0111000001",
        "name": "BCA Group Office"
      },
      {
        "prctr": "0120000001",
        "name": "BDS Group Office"
      },
      {
        "prctr": "0121000001",
        "name": "BDS DIV1 Group Off"
      },
      {
        "prctr": "0121000002",
        "name": "Program A PC"
      },
      {
        "prctr": "0121000003",
        "name": "Program B PC"
      },
      {
        "prctr": "0122000001",
        "name": "BDS DIV2 Group Off"
      },
      {
        "prctr": "0122000002",
        "name": "Program C PC"
      },
      {
        "prctr": "0131000001",
        "name": "BGS Commercial"
      },
      {
        "prctr": "0132000001",
        "name": "BGS Def Group Off"
      },
      {
        "prctr": "0133000001",
        "name": "BGS Def Div1 Grp"
      },
      {
        "prctr": "0133000002",
        "name": "Program C PC"
      }
    ]
  },
  "costCentersByCompanyCode": {
    "1010": [
      {
        "kostl": "10101101",
        "name": "Financials (DE)",
        "prctr": "YB600"
      },
      {
        "kostl": "10101201",
        "name": "Purch &amp; Store 1 (DE)",
        "prctr": "YB700"
      },
      {
        "kostl": "10101202",
        "name": "Purch &amp; Store 2 (DE)",
        "prctr": "YB700"
      },
      {
        "kostl": "10101301",
        "name": "Manufacturing 1 (DE)",
        "prctr": "YB110"
      },
      {
        "kostl": "10101302",
        "name": "Manufacturing 2 (DE)",
        "prctr": "YB111"
      },
      {
        "kostl": "10101321",
        "name": "Services/Consltg(DE)",
        "prctr": "YB111"
      },
      {
        "kostl": "10101401",
        "name": "QM (DE)",
        "prctr": "YB600"
      },
      {
        "kostl": "10101501",
        "name": "R&amp;D (DE)",
        "prctr": "YB600"
      },
      {
        "kostl": "10101601",
        "name": "Marketing (DE)",
        "prctr": "YB600"
      },
      {
        "kostl": "10101602",
        "name": "Sales (DE)",
        "prctr": "YB600"
      },
      {
        "kostl": "10101701",
        "name": "Plant &amp; Maint (DE)",
        "prctr": "YB600"
      },
      {
        "kostl": "10101750",
        "name": "Build. &amp; Maint (DE)",
        "prctr": "YB900"
      },
      {
        "kostl": "10101751",
        "name": "HR Services (DE)",
        "prctr": "YB600"
      },
      {
        "kostl": "10101752",
        "name": "HR Recruitment (DE)",
        "prctr": "YB600"
      },
      {
        "kostl": "10101753",
        "name": "IT Services (DE)",
        "prctr": "YB600"
      },
      {
        "kostl": "10101801",
        "name": "Other Inc.&amp;Exp (DE)",
        "prctr": "YB600"
      },
      {
        "kostl": "10101901",
        "name": "Back Office (DE)",
        "prctr": "YB600"
      },
      {
        "kostl": "10101902",
        "name": "Csltg Unit A (DE)",
        "prctr": "YB101"
      },
      {
        "kostl": "10101903",
        "name": "Csltg Unit B (DE)",
        "prctr": "YB102"
      },
      {
        "kostl": "10101904",
        "name": "Customer Dev (DE)",
        "prctr": "YB103"
      },
      {
        "kostl": "KSDTC1",
        "name": "ADMIN 1",
        "prctr": "SAP-DUMMY"
      },
      {
        "kostl": "KSDTC2",
        "name": "ADMIN 2",
        "prctr": "SAP-DUMMY"
      },
      {
        "kostl": "KSDTC3",
        "name": "ADMIN 3",
        "prctr": "SAP-DUMMY"
      },
      {
        "kostl": "KSDTC4",
        "name": "ADMIN 4",
        "prctr": "SAP-DUMMY"
      },
      {
        "kostl": "KSDTC5",
        "name": "ADMIN 5",
        "prctr": "SAP-DUMMY"
      },
      {
        "kostl": "KSDTLANGU",
        "name": "EN_ADMIN",
        "prctr": "SAP-DUMMY"
      }
    ],
    "1500": [
      {
        "kostl": "15001303",
        "name": "Con Field Staff",
        "prctr": "YB110"
      },
      {
        "kostl": "15001304",
        "name": "Con Field Staff",
        "prctr": "YB110"
      }
    ],
    "1710": [
      {
        "kostl": "11010000",
        "name": "Fringe AUO",
        "prctr": "YB600"
      },
      {
        "kostl": "11010001",
        "name": "Fringe Exp",
        "prctr": "YB600"
      },
      {
        "kostl": "12010000",
        "name": "FAC AUO",
        "prctr": "SAP-DUMMY"
      },
      {
        "kostl": "12010001",
        "name": "Bldg Mgmt",
        "prctr": "YB600"
      },
      {
        "kostl": "12010002",
        "name": "Jan Services",
        "prctr": "YB600"
      },
      {
        "kostl": "12876",
        "name": "Quality - UK",
        "prctr": "0121000001"
      },
      {
        "kostl": "12878",
        "name": "Proj Mgmt-FB",
        "prctr": "0121000001"
      },
      {
        "kostl": "12881",
        "name": "Proj Ctrls-FB",
        "prctr": "0121000001"
      },
      {
        "kostl": "12888",
        "name": "Piping-FB",
        "prctr": "0121000001"
      },
      {
        "kostl": "12889",
        "name": "Elect/Ctrl Sys-FB",
        "prctr": "0121000001"
      },
      {
        "kostl": "13010000",
        "name": "ENG AUO",
        "prctr": "YB600"
      },
      {
        "kostl": "13010001",
        "name": "Mech Engineering",
        "prctr": "YB600"
      },
      {
        "kostl": "13010002",
        "name": "Elec Engineering",
        "prctr": "YB600"
      },
      {
        "kostl": "13010003",
        "name": "Eng Mgmt",
        "prctr": "YB600"
      },
      {
        "kostl": "13570",
        "name": "HSE - Farnborough",
        "prctr": "0121000001"
      },
      {
        "kostl": "14010000",
        "name": "MFG AUO",
        "prctr": "YB600"
      },
      {
        "kostl": "14010001",
        "name": "Shop Floor Svc",
        "prctr": "YB600"
      },
      {
        "kostl": "14010002",
        "name": "Mach and Equip",
        "prctr": "YB600"
      },
      {
        "kostl": "14597",
        "name": "PDDM-FB",
        "prctr": "0121000001"
      },
      {
        "kostl": "14598",
        "name": "Proj Info Mgmt-FB",
        "prctr": "0121000001"
      },
      {
        "kostl": "14706",
        "name": "Mechanical-FB",
        "prctr": "0121000001"
      },
      {
        "kostl": "14813",
        "name": "Eng Mgmt-Farnborough",
        "prctr": "0121000001"
      },
      {
        "kostl": "15010000",
        "name": "MAT AUO",
        "prctr": "YB600"
      },
      {
        "kostl": "15010001",
        "name": "Purchasing",
        "prctr": "YB600"
      },
      {
        "kostl": "15010002",
        "name": "Whse Svcs",
        "prctr": "YB600"
      },
      {
        "kostl": "15031",
        "name": "SC Mgmt - FB",
        "prctr": "0121000001"
      },
      {
        "kostl": "15033",
        "name": "Const Perm-FB",
        "prctr": "0121000001"
      },
      {
        "kostl": "16010000",
        "name": "G&amp;A AUO",
        "prctr": "YB600"
      },
      {
        "kostl": "16010001",
        "name": "Finance",
        "prctr": "YB600"
      },
      {
        "kostl": "16010002",
        "name": "Accounting",
        "prctr": "YB600"
      },
      {
        "kostl": "16010003",
        "name": "Prog Mgmt",
        "prctr": "YB600"
      },
      {
        "kostl": "16010004",
        "name": "Exec Mgmt",
        "prctr": "YB600"
      },
      {
        "kostl": "17100100",
        "name": "Operated Cost Cntr",
        "prctr": "YB600"
      },
      {
        "kostl": "17100200",
        "name": "Non Op Cost Cntr",
        "prctr": "YB600"
      },
      {
        "kostl": "17100300",
        "name": "Crp Cost Cntr",
        "prctr": "YB600"
      },
      {
        "kostl": "17101101",
        "name": "Financials (US)",
        "prctr": "YB600"
      },
      {
        "kostl": "17101201",
        "name": "Purch &amp; Store 1 (US)",
        "prctr": "YB700"
      },
      {
        "kostl": "17101202",
        "name": "Purch &amp; Store 2 (US)",
        "prctr": "YB700"
      },
      {
        "kostl": "17101301",
        "name": "Manufacturing 1 (US)",
        "prctr": "YB110"
      },
      {
        "kostl": "17101302",
        "name": "Manufacturing 2 (US)",
        "prctr": "YB111"
      },
      {
        "kostl": "17101303",
        "name": "Con Field Staff",
        "prctr": "YB110"
      },
      {
        "kostl": "17101304",
        "name": "Con Field Craft",
        "prctr": "YB110"
      },
      {
        "kostl": "17101321",
        "name": "Services/Consltg(US)",
        "prctr": "YB111"
      },
      {
        "kostl": "17101401",
        "name": "QM (US)",
        "prctr": "YB600"
      },
      {
        "kostl": "17101501",
        "name": "R&amp;D (US)",
        "prctr": "YB600"
      },
      {
        "kostl": "17101601",
        "name": "Marketing (US)",
        "prctr": "YB600"
      },
      {
        "kostl": "17101602",
        "name": "Sales (US)",
        "prctr": "YB600"
      },
      {
        "kostl": "17101701",
        "name": "Plant &amp; Maint (US)",
        "prctr": "YB600"
      },
      {
        "kostl": "17101750",
        "name": "Build. &amp; Maint (US)",
        "prctr": "YB900"
      },
      {
        "kostl": "17101751",
        "name": "HR Services-(US)",
        "prctr": "YB600"
      },
      {
        "kostl": "17101752",
        "name": "HR Recruitment-(US)",
        "prctr": "YB600"
      },
      {
        "kostl": "17101753",
        "name": "IT Services-(US)",
        "prctr": "YB600"
      },
      {
        "kostl": "17101801",
        "name": "Other Inc.&amp;Exp (US)",
        "prctr": "YB600"
      },
      {
        "kostl": "17101901",
        "name": "Back Office-(US)",
        "prctr": "YB600"
      },
      {
        "kostl": "17101902",
        "name": "Csltg Unit A (US)",
        "prctr": "YB101"
      },
      {
        "kostl": "17101903",
        "name": "Csltg Unit B-(US)",
        "prctr": "YB102"
      },
      {
        "kostl": "17101904",
        "name": "Customer Dev-(US)",
        "prctr": "YB103"
      },
      {
        "kostl": "21143",
        "name": "Proj Admin Svcs-FB",
        "prctr": "0121000001"
      },
      {
        "kostl": "2201010",
        "name": "Mechanical Eng",
        "prctr": "0121000001"
      },
      {
        "kostl": "23937",
        "name": "Contracts Mgmt - FB",
        "prctr": "0121000001"
      },
      {
        "kostl": "50010001",
        "name": "HQ",
        "prctr": "0100000001"
      },
      {
        "kostl": "51000001",
        "name": "Corp Fringe",
        "prctr": "0100000001"
      },
      {
        "kostl": "51000002",
        "name": "BCA Fringe",
        "prctr": "0111000001"
      },
      {
        "kostl": "6201010",
        "name": "Mechanical Eng GB",
        "prctr": "0121000001"
      },
      {
        "kostl": "US10_ADM1",
        "name": "Finance Operations",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_ADM2",
        "name": "Accounts Receivable",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_ADM3",
        "name": "Accounts Payable",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_ADM4",
        "name": "Purchasing",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_ADM5",
        "name": "Inventory Management",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_CORP1",
        "name": "Cafeteria",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_CORP2",
        "name": "Telecommunications",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_CORP3",
        "name": "Motor Fleet",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_CORP4",
        "name": "Utilities",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_CORP5",
        "name": "Marketing Event Mngt",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_FM",
        "name": "Facilities Mngt",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_HR1",
        "name": "HR-Selling-Cycles",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_HR2",
        "name": "HR-G/A - Cycles",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_HR3",
        "name": "HR-Selling-Accessori",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_HR4",
        "name": "HR-G/A - Accessories",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_HR5",
        "name": "Development&amp;Training",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_HR6",
        "name": "Payroll Administrati",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_HR7",
        "name": "Workforce Plannnig",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_HR8",
        "name": "HR Info. Systems",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_IT1",
        "name": "IT Infra - Cycles",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_IT2",
        "name": "IT Infra-Accessories",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_IT3",
        "name": "System Development",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_IT4",
        "name": "System Hardware",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_M1",
        "name": "General Operations",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_M2",
        "name": "Executive Board",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_MKT1",
        "name": "Advertising - Cycles",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_MKT2",
        "name": "Advertising-Accessor",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_OH",
        "name": "Overhead",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_OTH1",
        "name": "Prov. for Doubt.debt",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_OTH2",
        "name": "Other Income",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_OTH3",
        "name": "Interest Income &amp;Exp",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_OTH4",
        "name": "Other Non-Operating",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_OTH5",
        "name": "Income Taxes",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_OTH6",
        "name": "Other Taxes",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_OTH7",
        "name": "Earnings on Eq. Inv",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_OTH8",
        "name": "Extraordinary Gain",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_OTH9",
        "name": "Extraordinary Loss",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_PLC",
        "name": "ProdLine_Cruise",
        "prctr": "US10_PLC"
      },
      {
        "kostl": "US10_PLM",
        "name": "ProdLine_Mountain",
        "prctr": "US10_PLM"
      },
      {
        "kostl": "US10_PLR",
        "name": "ProdLine_Racing",
        "prctr": "US10_PLR"
      },
      {
        "kostl": "US10_PM",
        "name": "Plant Maintenance",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_QM",
        "name": "Quality Assurance",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_RD",
        "name": "R&amp;D - Cycles",
        "prctr": "US10_PC11"
      },
      {
        "kostl": "US10_TGY1",
        "name": "Trading Good_Youth",
        "prctr": "US10_TGY1"
      },
      {
        "kostl": "US10_TGY2",
        "name": "Transportation In_Yo",
        "prctr": "US10_TGY2"
      },
      {
        "kostl": "US10_WM",
        "name": "Warehouse Management",
        "prctr": "US10_PC11"
      }
    ],
    "5070": [
      {
        "kostl": "51000003",
        "name": "BDS Fringe",
        "prctr": "0120000001"
      },
      {
        "kostl": "53000001",
        "name": "BDS Elec Eng",
        "prctr": "0121000002"
      }
    ],
    "6050": [
      {
        "kostl": "51000004",
        "name": "BGS Fringe",
        "prctr": "0132000001"
      },
      {
        "kostl": "53000000",
        "name": "AuO Engineering",
        "prctr": "0132000001"
      },
      {
        "kostl": "53000002",
        "name": "BGS Elec Eng",
        "prctr": "0133000002"
      }
    ]
  },
  "wbsRa": [
    {
      "posid": "U1RZ001",
      "name": "Umicore Pre-Feed Lead Office PBWBS Study",
      "bukrs": "1010",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1RZ"
    },
    {
      "posid": "U1RZ002",
      "name": "Umicore Pre-Feed Support GB PBWBS Study",
      "bukrs": "1010",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1RZ"
    },
    {
      "posid": "U1RY002",
      "name": "Umicore Pre-Feed Support GB PBWBS Study",
      "bukrs": "1500",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1RY"
    },
    {
      "posid": "U1RY00201",
      "name": "Umicore Pre-Feed GB IBWBS Study",
      "bukrs": "1500",
      "level": "3",
      "raKey": "Y00001",
      "project": "U1RY"
    },
    {
      "posid": "A000301",
      "name": "Program Management &amp; Governance",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0003"
    },
    {
      "posid": "A000302",
      "name": "Solution Design &amp; Architecture",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0003"
    },
    {
      "posid": "A000303",
      "name": "Build &amp; Configuration",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0003"
    },
    {
      "posid": "A000304",
      "name": "Testing &amp; Quality Assurance",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0003"
    },
    {
      "posid": "A000305",
      "name": "Deployment &amp; Transition",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0003"
    },
    {
      "posid": "A000306",
      "name": "Training &amp; Knowledge Transfer",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0003"
    },
    {
      "posid": "A000307",
      "name": "Sustainment &amp; Support",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0003"
    },
    {
      "posid": "A000501",
      "name": "FA1234-02-C-8855 - J Perf Obligation 01",
      "bukrs": "1710",
      "level": "2",
      "raKey": "YM1205",
      "project": "A0005"
    },
    {
      "posid": "A000502",
      "name": "FA1234-02-C-8855 - J Perf Obligation 02",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0005"
    },
    {
      "posid": "A000503",
      "name": "FA1234-02-C-8855 - J Perf Obligation 03",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0005"
    },
    {
      "posid": "A000504",
      "name": "FA1234-02-C-8855 - J Perf Obligation 04",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0005"
    },
    {
      "posid": "A000505",
      "name": "FA1234-02-C-8855 - J Perf Obligation 05",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0005"
    },
    {
      "posid": "A000506",
      "name": "FA1234-02-C-8855 - J Perf Obligation 06",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0005"
    },
    {
      "posid": "A000701",
      "name": "Program Management &amp; Governance",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0007"
    },
    {
      "posid": "A000702",
      "name": "Solution Design &amp; Architecture",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0007"
    },
    {
      "posid": "A000703",
      "name": "Build &amp; Configuration",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0007"
    },
    {
      "posid": "A000704",
      "name": "Testing &amp; Quality Assurance",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0007"
    },
    {
      "posid": "A000705",
      "name": "Deployment &amp; Transition",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0007"
    },
    {
      "posid": "A000706",
      "name": "Training &amp; Knowledge Transfer",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0007"
    },
    {
      "posid": "A000707",
      "name": "Sustainment &amp; Support",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0007"
    },
    {
      "posid": "A001101",
      "name": "Program Management &amp; Governance",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0011"
    },
    {
      "posid": "A001102",
      "name": "Solution Design &amp; Architecture",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0011"
    },
    {
      "posid": "A001103",
      "name": "Build &amp; Configuration",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0011"
    },
    {
      "posid": "A001104",
      "name": "Testing &amp; Quality Assurance",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0011"
    },
    {
      "posid": "A001105",
      "name": "Deployment &amp; Transition",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0011"
    },
    {
      "posid": "A001106",
      "name": "Training &amp; Knowledge Transfer",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0011"
    },
    {
      "posid": "A001107",
      "name": "Sustainment &amp; Support",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0011"
    },
    {
      "posid": "A0020 1",
      "name": "WBS Element A-0020.1",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "A0020"
    },
    {
      "posid": "A011101",
      "name": "FA1234-02-C-8855 - J Perf Obligation 01",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00005",
      "project": "A0111"
    },
    {
      "posid": "A0112 1",
      "name": "test",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00005",
      "project": "A0112"
    },
    {
      "posid": "A011501",
      "name": "POG",
      "bukrs": "1710",
      "level": "1",
      "raKey": "Y00005",
      "project": "A0115"
    },
    {
      "posid": "D-0002.01",
      "name": "Level 2 WBS",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "D-0002"
    },
    {
      "posid": "D-0006.01",
      "name": "Performance Obligation - RA for W16X364",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "D-0006"
    },
    {
      "posid": "D-0021.01",
      "name": "Performance Obligation - RA for W16X364",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "D-0021"
    },
    {
      "posid": "D-0022.01",
      "name": "Performance Obligation - RA for W16X364",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "D-0022"
    },
    {
      "posid": "D-0023.01",
      "name": "Performance Obligation - RA for W16X364",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "D-0023"
    },
    {
      "posid": "D-0024.01",
      "name": "Performance Obligation - RA for W16X364",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "D-0024"
    },
    {
      "posid": "D-0025.01",
      "name": "PP TEST 03 - 0123 Perf Obligation 01",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "D-0025"
    },
    {
      "posid": "D0016.01",
      "name": "WBS Element D0016-1",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "D0016"
    },
    {
      "posid": "H E17799200001",
      "name": "General",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H E17799200"
    },
    {
      "posid": "H E17799200002",
      "name": "Non-Process Buildings",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H E17799200"
    },
    {
      "posid": "H E17799200003",
      "name": "Process Buildings",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H E17799200"
    },
    {
      "posid": "H E17799200004",
      "name": "Utilities, Racks &amp; Infrastructure",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H E17799200"
    },
    {
      "posid": "H E17800026001",
      "name": "General",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H E17800026"
    },
    {
      "posid": "H E17800026002",
      "name": "Non-Process Buildings",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H E17800026"
    },
    {
      "posid": "H E17800026003",
      "name": "Process Buildings",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H E17800026"
    },
    {
      "posid": "H E17800026004",
      "name": "Utilities, Racks &amp; Infrastructure",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H E17800026"
    },
    {
      "posid": "H E178006410001",
      "name": "Blue Wave Project",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H E17800641"
    },
    {
      "posid": "H E178006410002",
      "name": "General",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H E17800641"
    },
    {
      "posid": "H E17800641001",
      "name": "Non-Process Buildings",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H E17800641"
    },
    {
      "posid": "H E17800641002",
      "name": "Process Buildings",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H E17800641"
    },
    {
      "posid": "H E17800641003",
      "name": "Utilities, Racks &amp; Infrastructure",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H E17800641"
    },
    {
      "posid": "H E17800641004",
      "name": "General",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H E17800641"
    },
    {
      "posid": "H EASYNC1TS001",
      "name": "Child",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H EASYNC1TS"
    },
    {
      "posid": "H EFULLTREA001",
      "name": "Child A",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H EFULLTREA"
    },
    {
      "posid": "H EFULLTREA002",
      "name": "Child B",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H EFULLTREA"
    },
    {
      "posid": "H ETREE02TS001",
      "name": "Bare bus2054 test",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H ETREE02TS"
    },
    {
      "posid": "H F17799200001",
      "name": "Phase 1 - Engineering",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H F17799200"
    },
    {
      "posid": "H F17799200002",
      "name": "Phase 2 - Procurement",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H F17799200"
    },
    {
      "posid": "H F17799200003",
      "name": "Phase 3 - Construction",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "H F17799200"
    },
    {
      "posid": "M12-T1.01",
      "name": "Mach12 SV Build",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M12-T1"
    },
    {
      "posid": "M120.01",
      "name": "Mach12 SV Build",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M120"
    },
    {
      "posid": "M121.01",
      "name": "M121.01",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M121"
    },
    {
      "posid": "M122.01",
      "name": "M122.01",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M122"
    },
    {
      "posid": "M123.01",
      "name": "M123.01",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M123"
    },
    {
      "posid": "M124.01",
      "name": "M124.01",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M124"
    },
    {
      "posid": "M125.01",
      "name": "Mach12 SV Build",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M125"
    },
    {
      "posid": "M126.01",
      "name": "Mach12 SV Build",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M126"
    },
    {
      "posid": "M127.01",
      "name": "Mach12 SV Build",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M127"
    },
    {
      "posid": "M128.01",
      "name": "Mach12 SV Build",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M128"
    },
    {
      "posid": "M129.01",
      "name": "Mach12 SV Build",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M129"
    },
    {
      "posid": "M12A.01",
      "name": "Mach12 SV Build",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M12A"
    },
    {
      "posid": "M12B.01",
      "name": "Mach12 SV Build",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M12B"
    },
    {
      "posid": "M12C.01",
      "name": "Mach12 SV Build",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M12C"
    },
    {
      "posid": "M12D.01",
      "name": "Mach12 SV Build",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M12D"
    },
    {
      "posid": "M12E",
      "name": "Mach12 SV Build",
      "bukrs": "1710",
      "level": "1",
      "raKey": "YM1205",
      "project": "M12E"
    },
    {
      "posid": "M12F",
      "name": "Mach12 SV Build",
      "bukrs": "1710",
      "level": "1",
      "raKey": "YM1205",
      "project": "M12F"
    },
    {
      "posid": "M12G",
      "name": "Test C",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M12G"
    },
    {
      "posid": "M12G.01",
      "name": "Mach12 SV Build",
      "bukrs": "1710",
      "level": "2",
      "raKey": "000001",
      "project": "M12G"
    },
    {
      "posid": "M12H",
      "name": "Moog Demo POC",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M12H"
    },
    {
      "posid": "M12H.01",
      "name": "Mach12 SV Build",
      "bukrs": "1710",
      "level": "2",
      "raKey": "YM1205",
      "project": "M12H"
    },
    {
      "posid": "M12I",
      "name": "Moog Test Project 1",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M12I"
    },
    {
      "posid": "M12I.01",
      "name": "Mach12 SV Build",
      "bukrs": "1710",
      "level": "2",
      "raKey": "000001",
      "project": "M12I"
    },
    {
      "posid": "M12J",
      "name": "Moog Demo Day Project 1",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M12J"
    },
    {
      "posid": "M12J.01",
      "name": "Mach12 SV Build",
      "bukrs": "1710",
      "level": "2",
      "raKey": "YM1205",
      "project": "M12J"
    },
    {
      "posid": "M12K",
      "name": "Moog Demo Day Project 1",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M12K"
    },
    {
      "posid": "M12K.01",
      "name": "Mach12 SV Build",
      "bukrs": "1710",
      "level": "2",
      "raKey": "YM1205",
      "project": "M12K"
    },
    {
      "posid": "M12T.01",
      "name": "M12T.01",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M12T"
    },
    {
      "posid": "M12U.01",
      "name": "M12U.01",
      "bukrs": "1710",
      "level": "1",
      "raKey": "000001",
      "project": "M12U"
    },
    {
      "posid": "U1BW001",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS Study",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW002",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS BD",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW003",
      "name": "Umicore Blue Project PBWBS Bridging",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW004",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS PL",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW005",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS Study",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW006",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS BD",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW007",
      "name": "Umicore Blue Project PBWBS Bridging",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW008",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS GB",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW009",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS BD",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW010",
      "name": "Umicore Blue Project PBWBS Bridging",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW011",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS PH",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW012",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS BD",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW013",
      "name": "Umicore Blue Project PBWBS Bridging",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW014",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS IN",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW015",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS BD",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW016",
      "name": "Umicore Blue Project PBWBS Bridging",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW017",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS US",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW018",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS EPCm",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW019",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS EPCm",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW020",
      "name": "Umicore Wave3S BlueW1 Topside 0066 PBWBS",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW021",
      "name": "Umicore Wave3S BlueW1 Topside 1726 PBWBS",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW022",
      "name": "Umicore Wave3S BlueW1 Topside 9999 PBWBS",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW023",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS EPCm",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW024",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS EPCm",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW025",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS EPCm",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW026",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS EPCm",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW027",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS EPCm",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1BW028",
      "name": "Umicore Wave3S Blue Wave 1 PBWBS EPCm",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1BW"
    },
    {
      "posid": "U1CM001",
      "name": "Pre-Feed Lead Office PBWBS Study",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1CM"
    },
    {
      "posid": "U1CM00101",
      "name": "Pre-Feed Lead Office IBWBS Study",
      "bukrs": "1710",
      "level": "3",
      "raKey": "Y00001",
      "project": "U1CM"
    },
    {
      "posid": "U1RY 01",
      "name": "Fluor Demo Intercomp Perf Obligation 01",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1RY"
    },
    {
      "posid": "U1RY 02",
      "name": "Fluor Demo External Perf Obligation 02",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1RY"
    },
    {
      "posid": "U1RY001",
      "name": "Umicore Pre-Feed Lead Office PBWBS Study",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1RY"
    },
    {
      "posid": "UZ1BW01",
      "name": "Umicore Poland Wave3S Blue Wave 1 PL",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "UZ1BW"
    },
    {
      "posid": "UZ1BW02",
      "name": "Umicore Wave3S Blue Wave 1 GB",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "UZ1BW"
    },
    {
      "posid": "UZ1BW03",
      "name": "Umicore Wave3S Blue Wave 1 PH",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "UZ1BW"
    },
    {
      "posid": "UZ1BW04",
      "name": "Umicore Wave3S Blue Wave 1 ND",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "UZ1BW"
    },
    {
      "posid": "UZ1BW05",
      "name": "Umicore Wave3S Blue Wave 1 US",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "UZ1BW"
    },
    {
      "posid": "UZ1BW06",
      "name": "Umicore Wave3S Blue Wave 1 NL",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "UZ1BW"
    },
    {
      "posid": "UZ1BW07",
      "name": "Umicore Wave3S Blue Wave 1 AB",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "UZ1BW"
    },
    {
      "posid": "UZ1BW08",
      "name": "Umicore Wave3S Blue Wave 1 Topside 0066",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "UZ1BW"
    },
    {
      "posid": "UZ1BW09",
      "name": "Umicore Wave3S Blue Wave 1 PL",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "UZ1BW"
    },
    {
      "posid": "UZ1BW10",
      "name": "Umicore Wave3S Blue Wave 1 GB",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "UZ1BW"
    },
    {
      "posid": "UZ1BW11",
      "name": "Umicore Wave3S Blue Wave 1 NL",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "UZ1BW"
    },
    {
      "posid": "UZ1BW12",
      "name": "Umicore Wave3S Blue Wave 1 US",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "UZ1BW"
    },
    {
      "posid": "UZ1BW13",
      "name": "Umicore Wave3S Blue Wave 1 DE",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "UZ1BW"
    },
    {
      "posid": "UZ1BW14",
      "name": "Umicore Wave3S Blue Wave 1 PL",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "UZ1BW"
    },
    {
      "posid": "VMOG-00001.01",
      "name": "Propulsion Systems",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "VMOG-00001"
    },
    {
      "posid": "VMOG-00001.02",
      "name": "Pointing Systems and Motion Control",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "VMOG-00001"
    },
    {
      "posid": "VMOG-00001.03",
      "name": "Electrical Power Systems (EPS)",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "VMOG-00001"
    },
    {
      "posid": "WW-BOUSA.0001.01",
      "name": "END Item #1 Contract #1",
      "bukrs": "1710",
      "level": "3",
      "raKey": "Y00005",
      "project": "WW-BOUSA"
    },
    {
      "posid": "X B",
      "name": "Blue Wave Project",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "X U1BW"
    },
    {
      "posid": "X G",
      "name": "General",
      "bukrs": "1710",
      "level": "2",
      "raKey": "Y00001",
      "project": "X U1BW"
    },
    {
      "posid": "D-0020.01",
      "name": "Inter Segment Proces Perf Obligation 01",
      "bukrs": "5070",
      "level": "2",
      "raKey": "Y00001",
      "project": "D-0020"
    },
    {
      "posid": "D-0026.01",
      "name": "BDS Performance Obligation",
      "bukrs": "5070",
      "level": "2",
      "raKey": "Y00001",
      "project": "D-0026"
    },
    {
      "posid": "D-0026.02",
      "name": "BGS Performance Obligation",
      "bukrs": "5070",
      "level": "2",
      "raKey": "Y00001",
      "project": "D-0026"
    },
    {
      "posid": "U1CM002",
      "name": "Pre-Feed Support Office PBWBS Study",
      "bukrs": "5070",
      "level": "2",
      "raKey": "Y00001",
      "project": "U1CM"
    },
    {
      "posid": "U1CM00201",
      "name": "Pre-Feed Support IBWBS Study",
      "bukrs": "5070",
      "level": "3",
      "raKey": "Y00001",
      "project": "U1CM"
    }
  ]
} as const
